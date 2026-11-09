# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The **J&T Express Australia email signature generator**. Staff can sign in with Feishu to pre-fill their name and avatar (and email/title/mobile when those scopes are granted), pick a banner, preview the signature, then copy it into Outlook/Gmail or download it as a PNG. The page still works without signing in.

## Commands

```bash
npm install
cp .dev.vars.example .dev.vars   # Feishu credentials for local login
npm run dev                      # webpack --watch + wrangler dev on http://localhost:3000
npm run build                    # webpack production build into dist/public
npm run typecheck                # tsc for worker/ only
npm run deploy                   # build + wrangler deploy
```

There is no test suite or linter. CI (`.github/workflows/deploy.yml`) builds and deploys on every push to `main` or `feature/feishu-integration`.

## Layout

- `src/client` — the page, React 19 + shadcn/ui (Radix UI + Tailwind CSS v4), plain JSX bundled by Webpack with ts-loader (`allowJs`, `transpileOnly`) and PostCSS (`postcss.config.js`) from `src/client/index.jsx`. `@/` is an alias for `src/client` (webpack, tsconfig `paths`, `components.json`).
  - `App.jsx` — page layout and state.
  - `components/ui/` — shadcn/ui components (new-york style, JSX). Add more with `npx shadcn add <name>`.
  - `components/` — `SignaturePreview`, `BannerPicker`, `FeishuAccount` (header menu + status card), `PhotoCropper` (Dialog), `AdminSheet`, `InstallGuide`.
  - `lib/signature.js` — brand constants, validators, banner presets and both export paths. `lib/feishu.js` — Feishu profile helpers and the browser-saved fields.
  - `assets.js` — embedded base64 artwork (~0.8 MB on a few very long lines). Do not `Read` or `cat` it whole; use `cut -c1-200`.
  - `styles.css` — Tailwind import and the shadcn theme variables (primary = J&T red `#D9291C`).
- `worker/` — a single Cloudflare Worker (`jt-signature`, see `wrangler.toml`) that serves the built page as static assets and handles `/api/*`:
  - `GET /api/auth/feishu/login` → redirect to Feishu with a signed CSRF `state` cookie.
  - `GET /api/auth/feishu/callback` → exchanges the code, seals the user token (AES-GCM, `SESSION_SECRET`, `worker/crypto.ts`) into an HttpOnly cookie, redirects to `/` (or `/?feishu=<error>`).
  - `GET /api/me` → Feishu profile (`worker/feishu.ts`), avatar returned as a data URL so the client can draw it on a canvas. 401 when signed out.
  - `POST /api/auth/logout`, `GET /api/health`.
  - Stateless: no KV or database. Secrets (`FEISHU_APP_ID`, `FEISHU_APP_SECRET`, `SESSION_SECRET`) live in Cloudflare. Optional scopes are listed in `FEISHU_OAUTH_SCOPE` in `wrangler.toml`; every listed scope must be enabled in the Feishu console or login fails. The job title comes from `job_title`, or, when that is empty (as in this tenant), from the directory custom attribute `FEISHU_TITLE_ATTR_ID`.
- Root `index.html` — the **old** self-contained build. It is no longer the source of truth; do not edit it for new work.

## Architecture

The signature is rendered **three separate ways**, which must be kept visually in sync by hand. Any layout, copy, colour or field change usually needs to be applied to all three:

The page UI uses Tailwind classes, but the signature itself never does: email clients need inline styles and Arial.

1. **`SignaturePreview`** (`components/SignaturePreview.jsx`, on-screen) — flexbox layout sized with container-query units. `cq(px)` converts a px value on the 650px design baseline (`BASELINE = 650`) into `cqw`.
2. **`buildEmailSignatureHtml`** / `copySignatureToClipboard` (`lib/signature.js`, clipboard) — builds a separate fixed-width **nested `<table>` HTML string** (650px: 6px red bar + 644px content) for Outlook/Gmail. Text stays real, clickable text; the banner (+ logo overlay) and the LinkedIn badge are flattened to canvas images as data URLs. Uses spacer cells instead of padding (Outlook rewrites padding). Writes `text/html` + `text/plain` via `ClipboardItem`, falling back to an off-screen `contenteditable` + `execCommand("copy")`.
3. **`renderSignatureCanvas`** (`lib/signature.js`) → PNG download — redraws the whole signature with Canvas 2D at hard-coded coordinates, exported at @2x or @3x.

Shared rules:
- Brand colours come from `BRAND`; the font is always Arial (`FONT`).
- The banner keeps its natural aspect ratio; its height is computed from the image, never fixed.
- `bannerMode === "none"` leaves the banner out of all three (`hasBanner(admin)`).
- The J&T logo is overlaid on the banner **only** when `bannerMode === "official"`.
- Photo and LinkedIn appear only when their toggle is on **and** a value exists.

### State

- `form`: `name`, `title`, `mobile`, `email`, `linkedin`, `photoDataUrl`. `title`, `mobile`, `email`, `linkedin` are persisted to `localStorage` (`jt-sig-saved-fields`) so staff type them once.
- `feishu`: `{ status: "loading" | "signed-in" | "signed-out", profile, error }`, loaded from `/api/me` on mount. `applyProfile` only overwrites fields Feishu actually returned; the name prefers nickname → English name → display name; the avatar is redrawn as a 400×400 circular PNG (`toCircularPng`). `FeishuAccountMenu` (header) and `FeishuStatus` (above the form) render sign-in / re-fill / sign-out. `fromFeishu` remembers which values came from Feishu so those fields show a badge.
- `admin`: `website`, `logoUrl`, `bannerMode` (`official` | `dsp` | `custom` | `none`), `customBannerUrl`, `customBannerLink`. Banner presets go through `BANNER_MODE_OPTIONS` plus `getActiveBannerUrl` / `getActiveBannerLink` / `getBannerModeMeta`; a new preset needs an option there and a branch in both getters.
- `validate()` in `App.jsx` gates both export paths and writes `errors` keyed by field name; results are shown with Sonner toasts. Custom banners must be about 4:1 (±0.08), JPG/PNG, under 10 MB. Photos must be JPG/PNG under 5 MB and go through `PhotoCropper` (drag + zoom circular crop).

### Notes

- User-facing copy is English with Australian conventions ("J&T Express Australia", `jtexpress.au`).
