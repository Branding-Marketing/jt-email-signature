# J&T Express Australia — Email Signature Generator

Staff sign in with Feishu and the form is pre-filled with their name, position and
avatar. Every field stays editable, and the page still works without signing in.

## Architecture

A single **Cloudflare Worker** (`jt-signature`) serves everything:

- **Page** — `src/client`, React 19 (`App.jsx`) bundled by Webpack (ts-loader with
  `allowJs`) into `dist/public`, served as Worker static assets.
- **API** — `worker/`, handles `/api/*`, holds the Feishu App Secret and runs the OAuth
  flow. It is stateless: the Feishu user token is sealed (AES-GCM, keyed by
  `SESSION_SECRET`) into an HttpOnly cookie, so no KV or database is needed.

Deployment is manual from a local machine with the wrangler CLI (no CI).

The root `index.html` is the old self-contained build and is no longer the source of truth.

## Login flow

1. "Sign in with Feishu" opens `/api/auth/feishu/login`, which redirects to Feishu with a
   signed CSRF `state` cookie.
2. Feishu redirects to `/api/auth/feishu/callback`. The Worker exchanges the code for a
   user token, stores it in the sealed session cookie and redirects to `/`.
3. The page calls `/api/me`, which reads `authen/v1/user_info` (name, English name, email,
   avatar) and `directory/v1/employees/mget` with `work_info.positions` (main position).
   The avatar is returned as a data URL so the page can draw it on a canvas.

## One-time setup

### Feishu Developer Console

1. Enable the **Web App** capability.
2. Security Settings → Redirect URLs: add `https://<worker host>/api/auth/feishu/callback`
   (`npm run deploy` prints the Worker host; add a custom domain's URL too if you attach one).
3. Permissions: request `directory:employee.work.positions:read`. Name and avatar come
   from the login itself and need no extra scope.
4. Publish a version so the tenant admin can approve it.

## Deploy (local CLI)

```bash
npm ci
npx wrangler login                     # once per machine
npm run deploy                         # builds the page and deploys the Worker

# Once (and whenever a value changes). Each command prompts for the value.
npx wrangler secret put FEISHU_APP_ID
npx wrangler secret put FEISHU_APP_SECRET
openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET
```

Secrets live in Cloudflare, not in this repository. Changing `SESSION_SECRET` signs everyone out.

## Development

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in Feishu credentials
npm run dev                      # http://localhost:3000 (webpack --watch + wrangler dev)
```

For local login, also whitelist `http://localhost:3000/api/auth/feishu/callback` in Feishu.
