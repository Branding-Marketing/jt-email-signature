import crypto from 'node:crypto';
import path from 'node:path';
import express, { type Request } from 'express';
import { config } from './config';
import { buildAuthorizeUrl, loadProfileFromCode, type FeishuProfile } from './feishu';
import { MemoryStore, clearCookie, readCookie, setCookie, sign, unsign } from './session';

const SESSION_COOKIE = 'jt_sig_session';
const STATE_COOKIE = 'jt_sig_oauth_state';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/** Must exactly match a redirect URL whitelisted in the Feishu Developer Console. */
function callbackUrl(req: Request): string {
  return config.feishu.redirectUri || `${req.protocol}://${req.get('host')}/api/auth/feishu/callback`;
}

const sessions = new MemoryStore<FeishuProfile>(SESSION_TTL_MS);
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Step 1: send the browser to Feishu with a CSRF state bound to a signed cookie
app.get('/api/auth/feishu/login', (req, res) => {
  const state = crypto.randomBytes(16).toString('base64url');
  setCookie(req, res, STATE_COOKIE, sign(state), 10 * 60 * 1000);
  res.redirect(buildAuthorizeUrl(state, callbackUrl(req)));
});

// Step 2: Feishu redirects back with ?code&state
app.get('/api/auth/feishu/callback', async (req, res) => {
  const { code, state, error } = req.query as Record<string, string | undefined>;
  const expectedState = unsign(readCookie(req, STATE_COOKIE));
  clearCookie(res, STATE_COOKIE);
  if (error || !code) return res.redirect('/?feishu=denied');
  if (!state || state !== expectedState) return res.redirect('/?feishu=invalid_state');
  try {
    const profile = await loadProfileFromCode(code, callbackUrl(req));
    const sid = sessions.create(profile);
    setCookie(req, res, SESSION_COOKIE, sign(sid), SESSION_TTL_MS);
    res.redirect('/');
  } catch (err) {
    console.error('[feishu] login failed:', err);
    res.redirect('/?feishu=error');
  }
});

app.get('/api/me', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const profile = sessions.get(unsign(readCookie(req, SESSION_COOKIE)));
  if (!profile) return res.status(401).json({ error: 'not_signed_in' });
  res.json(profile);
});

app.post('/api/auth/logout', (req, res) => {
  sessions.delete(unsign(readCookie(req, SESSION_COOKIE)));
  clearCookie(res, SESSION_COOKIE);
  res.status(204).end();
});

// Serve the built React app; dist/server -> dist/public
const publicDir = path.resolve(__dirname, '../public');
app.use(express.static(publicDir, { index: false, maxAge: '1y', immutable: true }));
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Express 5 passes listen errors (e.g. EADDRINUSE) to this callback instead of throwing
app.listen(config.port, config.host, (err?: Error) => {
  if (err) {
    console.error(`Failed to listen on ${config.host}:${config.port}:`, err);
    process.exit(1);
  }
  console.log(`Server listening on http://${config.host}:${config.port}`);
});
