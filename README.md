# J&T Express Australia — Email Signature Generator

Staff sign in with Feishu and the form is pre-filled with their name, position and
avatar. Every field stays editable, and the page still works without signing in.

## Architecture

- **Page** — `src/client`, React 19 (`App.jsx`) bundled by Webpack (ts-loader with
  `allowJs`). Static, hosted on **GitHub Pages**.
- **Auth Worker** — `worker/`, a **Cloudflare Worker** that holds the Feishu App Secret,
  runs the OAuth flow and returns the profile. It is stateless: after login it hands the
  page an encrypted token (AES-GCM, keyed by `SESSION_SECRET`) that wraps the Feishu
  user token, and the page sends it back as a Bearer header. No cookies cross sites.
- Both are deployed by `.github/workflows/deploy.yml` on every push to `main`.

The root `index.html` is the old self-contained build and is no longer the source of truth.

## Login flow

1. The page links to `<worker>/api/auth/feishu/login`, which redirects to Feishu with a
   signed CSRF `state` cookie.
2. Feishu redirects to `<worker>/api/auth/feishu/callback`. The Worker exchanges the code
   for a user token and redirects back to the page with `#feishu_token=<encrypted token>`.
3. The page stores the token in `sessionStorage` and calls `<worker>/api/me`, which reads
   `authen/v1/user_info` (name, English name, email, avatar) and
   `directory/v1/employees/mget` with `work_info.positions` (main position). The avatar is
   returned as a data URL so the page can draw it on a canvas.

## One-time setup

### GitHub

- Settings → Pages → Build and deployment → Source: **GitHub Actions**.
- Settings → Secrets and variables → Actions → repository secrets:

| Secret | Purpose |
| --- | --- |
| `FEISHU_APP_ID` | Feishu App ID (`cli_...`) |
| `FEISHU_APP_SECRET` | Feishu App Secret |
| `SESSION_SECRET` | Random string, e.g. `openssl rand -hex 32` |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with the "Edit Cloudflare Workers" template |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (dashboard → Workers & Pages, right sidebar) |

### Cloudflare

Create a free account and open Workers & Pages once so the account gets a
`<name>.workers.dev` subdomain. The Worker deploys as `jt-signature-auth.<name>.workers.dev`.

### Feishu Developer Console

1. Enable the **Web App** capability.
2. Security Settings → Redirect URLs: add
   `https://jt-signature-auth.<name>.workers.dev/api/auth/feishu/callback`
   (the deploy log prints the exact URL).
3. Permissions: request `directory:employee.work.positions:read`. Name and avatar come
   from the login itself and need no extra scope.
4. Publish a version so the tenant admin can approve it.

## Development

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in Feishu credentials
npm run dev   # page on http://localhost:3000, Worker on http://localhost:8787
```

For local login, also whitelist `http://localhost:8787/api/auth/feishu/callback` in Feishu.
