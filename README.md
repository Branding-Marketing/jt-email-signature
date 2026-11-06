# J&T Express Australia — Email Signature Generator

Staff sign in with Feishu and the form is pre-filled with their name and avatar. Job
title, mobile, email and LinkedIn are typed in once and remembered in the browser. Every
field stays editable, and the page still works without signing in.

## Architecture

A single **Cloudflare Worker** (`jt-signature`) serves everything:

- **Page** — `src/client`, React 19 (`App.jsx`) bundled by Webpack (ts-loader with
  `allowJs`) into `dist/public`, served as Worker static assets.
- **API** — `worker/`, handles `/api/*`, holds the Feishu App Secret and runs the OAuth
  flow. It is stateless: the Feishu user token is sealed (AES-GCM, keyed by
  `SESSION_SECRET`) into an HttpOnly cookie, so login needs no KV or database.
- **Email images** — Gmail and the new Outlook / Outlook on the web drop base64 (`data:`)
  images in a pasted signature, so the copied signature links every image by URL:
  - Fixed artwork in `src/client/email/` (official banner with logo, Australia DSP banner,
    LinkedIn icon) is emitted as `/email/<name>` static files. Keep these file names: pasted
    signatures link to them for years, and replacing a file updates every signature.
  - Per-person images (profile photo, custom banner) are uploaded by `worker/images.ts`
    (`POST /api/images`, signed-in users only, PNG/JPEG up to 2 MB) to Workers KV and linked
    as `/img/<sha256>.<ext>`. KV is on the free plan and needs no payment method. If the user
    is not signed in, or the upload fails, that image stays embedded and the page asks them
    to sign in and copy again.

`.github/workflows/deploy.yml` builds and deploys the Worker on every push to `main` or
`feature/feishu-integration`. Manual deploys with the wrangler CLI still work.

The root `index.html` is the old self-contained build and is no longer the source of truth.

## Login flow

1. "Sign in with Feishu" opens `/api/auth/feishu/login`, which redirects to Feishu with a
   signed CSRF `state` cookie.
2. Feishu redirects to `/api/auth/feishu/callback`. The Worker exchanges the code for a
   user token, stores it in the sealed session cookie and redirects to `/`.
3. The page calls `/api/me`, which reads `authen/v1/user_info` (name, English name,
   avatar, plus email/mobile when those scopes are granted). The avatar is returned as a data URL so the page can draw it on a canvas.

## One-time setup

### Feishu Developer Console

1. Enable the **Web App** capability.
2. Security Settings → Redirect URLs: add `https://<worker host>/api/auth/feishu/callback`
   (`npm run deploy` prints the Worker host; add a custom domain's URL too if you attach one).
3. Permissions: none are required beyond login (name, English name, avatar). Optional
   user-identity scopes, enabled in the console and then listed in `FEISHU_OAUTH_SCOPE`
   in `wrangler.toml`, fill more fields via `contact/v3/users/:id`:
   `contact:contact.base:readonly` (required for the lookup itself),
   `contact:user.base:readonly` (nickname, used as the signature name),
   `contact:user.employee:readonly` (job title), `contact:user.email:readonly`,
   `contact:user.phone:readonly`. Never list a scope that is not enabled, or login fails.
4. Publish a version so the tenant admin can approve it.

## Deploy

### CI (GitHub Actions)

Pushing deploys automatically. The workflow needs two repository secrets
(Settings → Secrets and variables → Actions):

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token from the "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (`npx wrangler whoami`) |

The Feishu and session secrets are stored in Cloudflare (below), not in GitHub.

### Local CLI

```bash
npm ci
npx wrangler login                     # once per machine
npx wrangler kv namespace create IMAGES   # once: paste the printed id into wrangler.toml
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
