import { randomId, seal, sign, unseal, unsign } from './crypto';
import { buildAuthorizeUrl, exchangeCode, loadProfile, type FeishuCredentials } from './feishu';

export interface Env {
  FEISHU_APP_ID: string;
  FEISHU_APP_SECRET: string;
  SESSION_SECRET: string;
  /** Full URL of the signature page (GitHub Pages); login always returns here */
  APP_URL: string;
}

interface SessionToken {
  /** Feishu user_access_token */
  t: string;
  /** Expiry, ms since epoch */
  e: number;
}

const STATE_COOKIE = 'jt_sig_oauth_state';
const CALLBACK_PATH = '/api/auth/feishu/callback';

function credentials(env: Env): FeishuCredentials {
  return { appId: env.FEISHU_APP_ID, appSecret: env.FEISHU_APP_SECRET };
}

function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get('Cookie') ?? '').split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function redirect(location: string, cookie?: string): Response {
  const headers = new Headers({ Location: location });
  if (cookie) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}

/** Returns to the page with a status flag (and, on success, the token in the fragment so it never hits server logs). */
function backToApp(env: Env, opts: { error?: string; token?: string }): string {
  const url = new URL(env.APP_URL);
  if (opts.error) url.searchParams.set('feishu', opts.error);
  if (opts.token) url.hash = `feishu_token=${opts.token}`;
  return url.toString();
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': new URL(env.APP_URL).origin,
    'Access-Control-Allow-Headers': 'Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(env: Env, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(env) },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const callbackUrl = `${url.origin}${CALLBACK_PATH}`;
    const secureFlag = url.protocol === 'https:' ? '; Secure' : '';

    // Step 1: send the browser to Feishu with a CSRF state bound to a signed cookie
    if (url.pathname === '/api/auth/feishu/login' && req.method === 'GET') {
      const state = randomId();
      const cookie = `${STATE_COOKIE}=${encodeURIComponent(await sign(state, env.SESSION_SECRET))}; Max-Age=600; Path=/; HttpOnly; SameSite=Lax${secureFlag}`;
      return redirect(buildAuthorizeUrl(credentials(env), state, callbackUrl), cookie);
    }

    // Step 2: Feishu redirects back with ?code&state; hand an encrypted token back to the page
    if (url.pathname === CALLBACK_PATH && req.method === 'GET') {
      const clear = `${STATE_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secureFlag}`;
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code) return redirect(backToApp(env, { error: 'denied' }), clear);
      const expected = await unsign(readCookie(req, STATE_COOKIE), env.SESSION_SECRET);
      if (!state || state !== expected) return redirect(backToApp(env, { error: 'invalid_state' }), clear);
      try {
        const tok = await exchangeCode(credentials(env), code, callbackUrl);
        const session: SessionToken = { t: tok.access_token, e: Date.now() + (tok.expires_in - 60) * 1000 };
        return redirect(backToApp(env, { token: await seal(session, env.SESSION_SECRET) }), clear);
      } catch (err) {
        console.error('[feishu] login failed:', (err as Error).message);
        return redirect(backToApp(env, { error: 'error' }), clear);
      }
    }

    // Step 3: the page asks for the profile with the token as a Bearer credential (no cross-site cookies)
    if (url.pathname === '/api/me') {
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(env) });
      const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
      const session = bearer ? await unseal<SessionToken>(bearer, env.SESSION_SECRET) : null;
      if (!session || session.e < Date.now()) return json(env, { error: 'not_signed_in' }, 401);
      try {
        return json(env, await loadProfile(credentials(env), session.t));
      } catch (err) {
        console.error('[feishu] profile failed:', (err as Error).message);
        return json(env, { error: 'not_signed_in' }, 401);
      }
    }

    if (url.pathname === '/api/health') return json(env, { status: 'ok' });
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
