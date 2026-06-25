# Building the Runway macOS App (Tauri)

The macOS app is a thin [Tauri v2](https://tauri.app) shell that loads the live
site at `https://runway-steel.vercel.app/`. Normal app changes ship through
Vercel — you only rebuild the `.app` when the Tauri shell itself changes.

## How sign-in works

Google blocks OAuth inside embedded WebViews. Two things make sign-in work in
the desktop app:

1. The window uses a **clean desktop Safari user-agent** (set in
   `src-tauri/tauri.conf.json`), so Google sees Safari rather than a WebView.
2. On every page load the shell runs `window.__RUNWAY_DESKTOP__ = true` via
   `eval` (see `src-tauri/src/lib.rs`). The site (`app/auth.js`) checks that flag
   and uses `signInWithRedirect` (full-page) instead of a popup.

This uses the existing Firebase web OAuth config — **no Google Cloud "Desktop
app" client and no secrets are required**. (If you created a Desktop OAuth client
for an earlier attempt, you can delete it.)

> ⚠️ This relies on a full-page redirect inside the WebView with a Safari
> user-agent. It works for internal use but is sensitive to Google tightening
> embedded-WebView detection. If Google ever blocks it, switch to bundling the
> app locally (IPC works on `tauri://localhost`) — see the project spec.

## Prerequisites (one-time)

1. **Xcode command-line tools** — `xcode-select --install`
2. **Rust** — `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y`
3. **macOS build targets** — `rustup target add aarch64-apple-darwin x86_64-apple-darwin`
4. **Dependencies** — `pnpm install`

## ⚠️ Deploy the auth change first

The app loads the **remote** site, so the redirect branch in `app/auth.js` must
be **deployed to Vercel** before the desktop app can use it. Push `main` (or run
`vercel --prod`) before testing sign-in in the app.

## Develop

```bash
source "$HOME/.cargo/env"
pnpm tauri:dev
```

## Build a release `.dmg`

```bash
source "$HOME/.cargo/env"
pnpm tauri:build
```

Artifacts (universal Apple Silicon + Intel):

```
src-tauri/target/universal-apple-darwin/release/bundle/macos/Runway.app
src-tauri/target/universal-apple-darwin/release/bundle/dmg/Runway_1.0.0_universal.dmg
```

The build is **ad-hoc signed** (`signingIdentity: "-"` in `tauri.conf.json`).

## For teammates installing the `.dmg`

Because the app is ad-hoc signed (not notarized), macOS Gatekeeper warns on first
launch:

1. Drag **Runway** to Applications from the `.dmg`.
2. **Right-click → Open**, then confirm **Open** (once only).

If you later obtain an Apple **Developer ID** certificate, set it as the
`signingIdentity` in `src-tauri/tauri.conf.json` and notarize for a warning-free
install.
