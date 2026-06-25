# Runway as a macOS App (Tauri v2) — Design

**Date:** 2026-06-25
**Status:** Approved (design)
**Author:** Mike Brisk (with Claude Code)

## Goal

Ship Runway (the static vanilla-JS + Firebase kanban app, deployed at
`https://runway-steel.vercel.app/`) as a native macOS `.app` for internal team
use. The app should feel native (Dock icon, own window, native menus) while
reusing the existing deployed site so normal updates require no app rebuild.

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Wrapper | Tauri v2 (system WKWebView, small binary) |
| Content source | Loads the **live Vercel URL**, not bundled static files |
| OAuth | **System-browser loopback** (Approach A) via `signInWithCredential` |
| Distribution | Internal team — **ad-hoc code signing** + `.dmg` |
| Architecture | **Universal binary** (Apple Silicon + Intel) |

## Architecture

- New `src-tauri/` directory at the repo root containing the Rust project,
  `tauri.conf.json`, `Cargo.toml`, `build.rs`, and `src/`. The existing static
  site (`index.html`, `app/`, `styles.css`, etc.) is **untouched**.
- The **main window loads the remote URL** `https://runway-steel.vercel.app/`
  directly. Because the app is a thin shell over the live site, normal feature
  changes ship through Vercel with **no app rebuild**.
- A minimal local `offline.html` is bundled as `frontendDist` and shown as a
  fallback when there is no network connection.
- **Off-origin navigation** (any URL not on `runway-steel.vercel.app`) opens in
  the user's **system browser** rather than inside the app window. In-origin
  navigation stays in the window.
- Built as a **universal binary** (`aarch64-apple-darwin` +
  `x86_64-apple-darwin`) so every teammate's Mac can run it.

## Google OAuth (system-browser loopback)

**Problem:** `signInWithPopup` (`app/auth.js:121`) fails inside a WebView —
Google blocks OAuth from embedded user agents (`disallowed_useragent`).

**Solution:** Add a desktop-only sign-in path that runs the OAuth in the real
browser and hands the resulting Google ID token back to Firebase.

### Flow

1. **Rust command `google_sign_in()`** (in `src-tauri`):
   1. Generate PKCE verifier/challenge, `state`, and `nonce`.
   2. Start a temporary `localhost` (loopback) HTTP server on an ephemeral port.
   3. Open Google's OAuth consent URL in the **default system browser**
      (`response_type=code`, `redirect_uri=http://127.0.0.1:<port>`, the Desktop
      client ID, PKCE challenge, scopes `openid email profile`).
   4. Capture the `code` from the loopback redirect; validate `state`.
   5. Exchange the code at Google's token endpoint (auth-code + PKCE) for an
      **ID token** (and access token). The exchange happens **in Rust** so no
      client secret is ever exposed to the WebView.
   6. Return the ID token (+ access token) to the frontend; respond to the
      browser tab with a small "You can close this window" page.

2. **Frontend branch in `app/auth.js`** — `signInWithGoogle()`:
   - If running inside Tauri (`window.__TAURI__` is present), call
     `invoke('google_sign_in')`, then
     `signInWithCredential(auth, GoogleAuthProvider.credential(idToken, accessToken))`.
   - Otherwise, keep the existing `signInWithPopup` browser path unchanged.

3. **Session persistence:** Firebase persists auth state in the WebView
   (IndexedDB/localStorage), so it is a sign-in-once experience across launches.

### Required manual Google Cloud config (one-time)

- In the **`runway-40912`** GCP project, create a new **OAuth 2.0 Client ID** of
  type **Desktop app**. Desktop clients permit loopback redirects
  (`http://127.0.0.1:<any-port>`), which the Web client type does not.
- Record the resulting **client ID** (and the non-confidential client secret,
  which is acceptable to embed for an installed app) for the Tauri build config.
- This is a web-console step that must be done by a human with access to the GCP
  project; the implementation plan will include exact click-by-click steps.

## Tooling & Scripts

- Install **`rustup`** (Rust toolchain) — currently missing. Xcode command-line
  tools are already present.
- Add the **Tauri CLI** as a dev dependency (`@tauri-apps/cli`) using `pnpm`
  (the repo uses pnpm).
- Add scripts to `package.json`:
  - `tauri:dev` — run the app in dev mode against the remote URL.
  - `tauri:build` — produce the universal `.app` / `.dmg`.

## Distribution (internal team)

- **Ad-hoc code signing** of the `.app`, packaged as a `.dmg`.
- Teammates **right-click → Open** the first launch to clear Gatekeeper (one
  time). Document this in a short README/handoff note.
- If a **Developer ID** certificate becomes available later, upgrade to full
  signing + notarization — no structural change to the project required.

## Out of Scope

- Auto-updater.
- Custom native menus beyond Tauri defaults.
- Public share pages (`review-share.html`, `task-share.html`) — the desktop app
  only opens the main board (`index.html`).
- Windows/Linux builds (macOS only for now).

## Risks & Notes

- **GCP Desktop client requirement** is a hard prerequisite for Approach A; sign-in
  will not work in the app until it exists.
- Google's token endpoint may reject browser-origin requests (CORS); performing
  the exchange in Rust avoids this.
- Loading a remote URL means the app **requires network** for normal use; the
  `offline.html` fallback covers the disconnected case gracefully.
