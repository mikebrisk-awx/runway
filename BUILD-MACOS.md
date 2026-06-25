# Building the Runway macOS App (Tauri)

The macOS app is a thin [Tauri v2](https://tauri.app) shell that loads the live
site at `https://runway-steel.vercel.app/`. Normal app changes ship through
Vercel — you only rebuild the `.app` when the Tauri shell or the OAuth flow
changes.

## Prerequisites (one-time)

1. **Xcode command-line tools** — `xcode-select --install`
2. **Rust** — `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y`
3. **macOS build targets** — `rustup target add aarch64-apple-darwin x86_64-apple-darwin`
4. **Dependencies** — `pnpm install`

## Google "Desktop app" OAuth client (one-time, required for sign-in)

Google blocks OAuth inside WebViews, so the app signs in through the system
browser using a **Desktop app** OAuth client.

1. Open the [Google Cloud Console](https://console.cloud.google.com/) for project
   **`runway-40912`**.
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
3. **Application type: Desktop app**. Name it `Runway macOS`. Click **Create**.
4. Copy the **Client ID** and **Client secret**.
   - Desktop clients allow loopback redirects (`http://127.0.0.1:<any-port>`),
     which is what the app uses. No redirect URI needs to be registered.
   - The client secret for a Desktop (installed) app is **not confidential** and
     is embedded in the build — this is expected per Google's OAuth spec.

Put the values in your shell (do **not** commit them):

```bash
export RUNWAY_GOOGLE_CLIENT_ID="…apps.googleusercontent.com"
export RUNWAY_GOOGLE_CLIENT_SECRET="…"
```

See `src-tauri/.env.example` for the variable names.

## ⚠️ Deploy the auth change first

The app loads the **remote** site, so the Tauri sign-in branch added to
`app/auth.js` must be **deployed to Vercel** before the desktop app can use it.
Push `main` (or merge the PR) and let Vercel deploy before testing sign-in in the
app.

## Develop

```bash
source "$HOME/.cargo/env"
pnpm tauri:dev
```

Opens the app against the live site with hot-reload of the Rust shell.

## Build a release `.dmg`

```bash
source "$HOME/.cargo/env"
RUNWAY_GOOGLE_CLIENT_ID="…" RUNWAY_GOOGLE_CLIENT_SECRET="…" pnpm tauri:build
```

Artifacts (universal Apple Silicon + Intel):

```
src-tauri/target/universal-apple-darwin/release/bundle/macos/Runway.app
src-tauri/target/universal-apple-darwin/release/bundle/dmg/Runway_1.0.0_universal.dmg
```

The build is **ad-hoc signed** (`signingIdentity: "-"` in `tauri.conf.json`).

## For teammates installing the `.dmg`

Because the app is ad-hoc signed (not notarized), macOS Gatekeeper will warn on
first launch. To open it:

1. Drag **Runway** to Applications from the `.dmg`.
2. **Right-click → Open**, then confirm **Open** in the dialog (once only).

If you later obtain an Apple **Developer ID** certificate, set it as the
`signingIdentity` in `src-tauri/tauri.conf.json` and notarize for a warning-free
install — no other changes needed.
