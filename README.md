# J&T Express Australia — Email Signature Generator

Staff sign in with Feishu and the form is pre-filled with their name, position and
avatar. Every field stays editable, and the app still works without signing in.

## Stack

- `src/client` — React 19 app (`App.jsx`), bundled by Webpack (ts-loader with `allowJs`)
- `src/server` — Express 5 (TypeScript). Holds the Feishu App Secret, runs the OAuth
  flow and serves the built client from `dist/public`

The root `index.html` is the old self-contained build and is no longer the source of truth.

## Feishu setup

In the Feishu Developer Console (self-built app on the JT tenant):

1. Enable the **Web App** capability.
2. Security Settings → Redirect URLs: add the callback, e.g.
   `http://localhost:3000/api/auth/feishu/callback` locally and the HTTPS URL in production.
3. Permissions: request `directory:employee.work.positions:read` (position). Name and avatar
   come from the login itself (`authen/v1/user_info`) and need no extra scope.
4. Publish a version so the tenant admin can approve it.

## Configuration

Copy `.env.example` to `.env`:

| Variable | Secret | Purpose |
| --- | --- | --- |
| `FEISHU_APP_ID` | no | App ID (`cli_...`) |
| `FEISHU_APP_SECRET` | **yes** | App Secret, server only |
| `FEISHU_REDIRECT_URI` | no | Must match a whitelisted redirect URL exactly |
| `SESSION_SECRET` | **yes** | Signs cookies, e.g. `openssl rand -hex 32` |
| `FEISHU_OAUTH_SCOPE` | no | Optional extra user scopes, space separated |
| `PORT` | no | Express port in production (default 3000) |

## Development

```bash
npm install
npm run dev     # client on http://localhost:3000, API on 3001 (proxied)
```

## Production

```bash
npm run build
npm start       # serves everything on $PORT
```

Sessions live in memory (8 hours), so a restart just means signing in again.

## How the auto-fill works

1. `GET /api/auth/feishu/login` redirects to Feishu with a CSRF `state` cookie.
2. `GET /api/auth/feishu/callback` exchanges the code for a user token, then reads
   `authen/v1/user_info` (name, English name, email, avatar) and
   `directory/v1/employees/mget` with `work_info.positions` (main position).
   The avatar is downloaded server-side and returned as a data URL so the browser can
   draw it on a canvas without CORS problems.
3. The client calls `GET /api/me` on load and fills any field Feishu returned.
