import { randomId, seal, sign, unseal, unsign } from './crypto';
import { FeishuError, buildAuthorizeUrl, exchangeCode, loadProfile, type FeishuCredentials } from './feishu';

export interface Env {
  FEISHU_APP_ID: string;
  FEISHU_APP_SECRET: string;
  SESSION_SECRET: string;
  /** Optional override for the scopes requested at login, see wrangler.toml */
  FEISHU_OAUTH_SCOPE?: string;
  /** Static assets built by Webpack (dist/public), see wrangler.toml */
  ASSETS: Fetcher;
}

interface Session {
  /** Feishu user_access_token */
  t: string;
  /** Expiry, ms since epoch */
  e: number;
}

const STATE_COOKIE = 'jt_sig_oauth_state';
const SESSION_COOKIE = 'jt_sig_session';
const CALLBACK_PATH = '/api/auth/feishu/callback';

function credentials(env: Env): FeishuCredentials {
  return {
    appId: env.FEISHU_APP_ID,
    appSecret: env.FEISHU_APP_SECRET,
    scope: (env.FEISHU_OAUTH_SCOPE ?? '').trim(),
  };
}

function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get('Cookie') ?? '').split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function cookie(req: Request, name: string, value: string, maxAgeSec: number): string {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSec}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

function redirect(location: string, ...cookies: string[]): Response {
  const headers = new Headers({ Location: location });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(null, { status: 302, headers });
}

function json(body: unknown, status = 200, ...cookies: string[]): Response {
  const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(JSON.stringify(body), { status, headers });
}

async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  const callbackUrl = `${url.origin}${CALLBACK_PATH}`;

  // Step 1: send the browser to Feishu with a CSRF state bound to a signed cookie
  if (url.pathname === '/api/auth/feishu/login' && req.method === 'GET') {
    const state = randomId();
    return redirect(
      buildAuthorizeUrl(credentials(env), state, callbackUrl),
      cookie(req, STATE_COOKIE, await sign(state, env.SESSION_SECRET), 600),
    );
  }

  // Step 2: Feishu redirects back with ?code&state. The user token is sealed (AES-GCM)
  // into an HttpOnly cookie, so the Worker needs no storage.
  if (url.pathname === CALLBACK_PATH && req.method === 'GET') {
    const clearState = cookie(req, STATE_COOKIE, '', 0);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code) return redirect('/?feishu=denied', clearState);
    const expected = await unsign(readCookie(req, STATE_COOKIE), env.SESSION_SECRET);
    if (!state || state !== expected) return redirect('/?feishu=invalid_state', clearState);
    try {
      const tok = await exchangeCode(credentials(env), code, callbackUrl);
      const ttl = Math.max(tok.expires_in - 60, 60);
      const session: Session = { t: tok.access_token, e: Date.now() + ttl * 1000 };
      return redirect('/', clearState, cookie(req, SESSION_COOKIE, await seal(session, env.SESSION_SECRET), ttl));
    } catch (err) {
      console.error('[feishu] login failed:', (err as Error).message);
      return redirect('/?feishu=error', clearState);
    }
  }

  if (url.pathname === '/api/me' && req.method === 'GET') {
    const sealed = readCookie(req, SESSION_COOKIE);
    const session = sealed ? await unseal<Session>(sealed, env.SESSION_SECRET) : null;
    if (!session || session.e < Date.now()) return json({ error: 'not_signed_in' }, 401);
    try {
      return json(await loadProfile(session.t));
    } catch (err) {
      console.error('[feishu] profile failed:', (err as Error).message);
      // Only drop the session when Feishu says the token is invalid or expired.
      // Anything else (network, rate limit, 5xx) keeps the session so a retry works.
      if (err instanceof FeishuError && err.isInvalidToken) {
        return json({ error: 'not_signed_in' }, 401, cookie(req, SESSION_COOKIE, '', 0));
      }
      const res = json({ error: 'feishu_unavailable' }, 503);
      res.headers.set('Retry-After', '5');
      return res;
    }
  }

  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    return new Response(null, { status: 204, headers: { 'Set-Cookie': cookie(req, SESSION_COOKIE, '', 0) } });
  }

  if (url.pathname === '/api/health') return json({ status: 'ok' });
  return json({ error: 'not_found' }, 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) return handleApi(req, env, url);
    // Everything else is the static signature page
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
