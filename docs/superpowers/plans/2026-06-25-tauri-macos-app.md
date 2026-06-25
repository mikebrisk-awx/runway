# Runway macOS App (Tauri v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the deployed Runway site (`https://runway-steel.vercel.app/`) in a native Tauri v2 macOS app for internal team use, with Google sign-in rerouted through the system browser.

**Architecture:** A thin Tauri v2 shell whose main window loads the live Vercel URL. A Rust command performs Google OAuth via a loopback (auth-code + PKCE) flow in the system browser and returns an ID token; `app/auth.js` gains a Tauri-only branch that calls it and signs into Firebase via `signInWithCredential`. Built as a universal binary, ad-hoc signed, packaged as a `.dmg`.

**Tech Stack:** Tauri v2, Rust (rustup), `@tauri-apps/cli` (pnpm), `tauri-plugin-opener`, `reqwest`, `tiny_http`, Firebase JS SDK (already present).

## Global Constraints

- Target OS: **macOS only**, universal binary (`aarch64-apple-darwin` + `x86_64-apple-darwin`).
- Content source: **remote URL** `https://runway-steel.vercel.app/` — do not bundle the app's static files.
- Bundle identifier: `com.accuweather.runway`.
- Existing static site files (`index.html`, `app/`, `styles.css`) must remain untouched except for the single OAuth branch in `app/auth.js`.
- Package manager: **pnpm**.
- Firebase project: `runway-40912`.
- Distribution: internal — **ad-hoc signing** (`signingIdentity: "-"`), no notarization.

---

### Task 1: Install Rust toolchain & Tauri CLI

**Files:**
- Modify: `package.json` (add devDependency + scripts)

**Interfaces:**
- Produces: `cargo`/`rustc` on PATH; `pnpm tauri` runnable; macOS rust targets installed.

- [ ] **Step 1: Install rustup non-interactively**

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
rustc --version && cargo --version
```
Expected: prints rustc/cargo versions (1.7x+).

- [ ] **Step 2: Add macOS targets for universal build**

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
```
Expected: both targets "installed" (or "up to date").

- [ ] **Step 3: Add Tauri CLI dev dependency**

```bash
pnpm add -D @tauri-apps/cli@^2
```
Expected: `@tauri-apps/cli` appears in `package.json` devDependencies.

- [ ] **Step 4: Add scripts to package.json**

In `package.json` `"scripts"`:
```json
"tauri": "tauri",
"tauri:dev": "tauri dev",
"tauri:build": "tauri build --target universal-apple-darwin"
```

- [ ] **Step 5: Verify CLI**

```bash
pnpm tauri --version
```
Expected: prints `tauri-cli 2.x`.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add Rust/Tauri toolchain and scripts"
```

---

### Task 2: Scaffold `src-tauri/` with remote-URL window + offline fallback

**Files:**
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `src-tauri/dist/offline.html`
- Create: `src-tauri/icons/` (generated)
- Create: `src-tauri/.gitignore`

**Interfaces:**
- Produces: a launchable Tauri app whose window loads the remote URL; `pnpm tauri:dev` opens it.

- [ ] **Step 1: Create `src-tauri/.gitignore`**

```
/target
/gen
```

- [ ] **Step 2: Create offline fallback `src-tauri/dist/offline.html`**

```html
<!doctype html>
<html><head><meta charset="utf-8"><title>Runway — Offline</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;display:flex;height:100vh;margin:0;align-items:center;justify-content:center;background:#0f1115;color:#e6e9ef;flex-direction:column}button{margin-top:16px;padding:8px 18px;border-radius:8px;border:0;background:#3b82f6;color:#fff;font-size:14px;cursor:pointer}</style>
</head><body>
<h2>You're offline</h2>
<p>Runway needs an internet connection.</p>
<button onclick="location.href='https://runway-steel.vercel.app/'">Retry</button>
</body></html>
```

- [ ] **Step 3: Create `src-tauri/Cargo.toml`**

```toml
[package]
name = "runway"
version = "1.0.0"
description = "Runway"
edition = "2021"

[lib]
name = "runway_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
tiny_http = "0.12"
url = "2"
sha2 = "0.10"
base64 = "0.22"
rand = "0.8"
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }
```

- [ ] **Step 4: Create `src-tauri/build.rs`**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 5: Create `src-tauri/tauri.conf.json`**

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Runway",
  "version": "1.0.0",
  "identifier": "com.accuweather.runway",
  "build": {
    "frontendDist": "./dist"
  },
  "app": {
    "windows": [
      {
        "title": "Runway",
        "url": "https://runway-steel.vercel.app/",
        "width": 1440,
        "height": 900,
        "minWidth": 960,
        "minHeight": 600
      }
    ],
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": ["app", "dmg"],
    "icon": ["icons/icon.icns"],
    "macOS": { "signingIdentity": "-" }
  }
}
```

- [ ] **Step 6: Create `src-tauri/src/lib.rs` (minimal, command added in Task 3)**

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 7: Create `src-tauri/src/main.rs`**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    runway_lib::run()
}
```

- [ ] **Step 8: Generate app icons**

Use any 1024x1024 PNG source (export from the site's favicon or a placeholder):
```bash
pnpm tauri icon path/to/source-1024.png
```
Expected: populates `src-tauri/icons/` including `icon.icns`.

- [ ] **Step 9: Run the dev app**

```bash
pnpm tauri:dev
```
Expected: a native window opens showing the live Runway site (first build compiles Rust deps — slow).

- [ ] **Step 10: Commit**

```bash
git add src-tauri package.json pnpm-lock.yaml
git commit -m "feat: scaffold Tauri v2 macOS shell loading remote URL"
```

---

### Task 3: Rust `google_sign_in` command (loopback OAuth + PKCE)

**Files:**
- Create: `src-tauri/src/oauth.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: Tauri command `google_sign_in() -> Result<SignInTokens, String>` where
  `SignInTokens { id_token: String, access_token: String }` (serde-serialized to
  `{ idToken, accessToken }` for JS). Reads env/consts `GOOGLE_CLIENT_ID` and
  `GOOGLE_CLIENT_SECRET` (Desktop client — see Task 5).

- [ ] **Step 1: Create `src-tauri/src/oauth.rs`**

```rust
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::io::Read;
use tauri_plugin_opener::OpenerExt;

// Desktop OAuth client created in GCP project runway-40912 (see plan Task 5).
const CLIENT_ID: &str = env!("RUNWAY_GOOGLE_CLIENT_ID");
const CLIENT_SECRET: &str = env!("RUNWAY_GOOGLE_CLIENT_SECRET");

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignInTokens {
    pub id_token: String,
    pub access_token: String,
}

fn rand_string(n: usize) -> String {
    let bytes: Vec<u8> = (0..n).map(|_| rand::thread_rng().gen()).collect();
    URL_SAFE_NO_PAD.encode(bytes)
}

#[tauri::command]
pub async fn google_sign_in(app: tauri::AppHandle) -> Result<SignInTokens, String> {
    // PKCE + state
    let verifier = rand_string(48);
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let state = rand_string(16);

    // Loopback server on an ephemeral port
    let server = tiny_http::Server::http("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = server.server_addr().to_ip().unwrap().port();
    let redirect_uri = format!("http://127.0.0.1:{port}");

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?response_type=code\
&client_id={CLIENT_ID}&redirect_uri={redirect_uri}&scope=openid%20email%20profile\
&code_challenge={challenge}&code_challenge_method=S256&state={state}"
    );

    app.opener().open_url(auth_url, None::<&str>).map_err(|e| e.to_string())?;

    // Wait for the redirect, extract ?code=...&state=...
    let request = server.recv().map_err(|e| e.to_string())?;
    let full = format!("http://127.0.0.1{}", request.url());
    let parsed = url::Url::parse(&full).map_err(|e| e.to_string())?;
    let mut code = None;
    let mut got_state = None;
    for (k, v) in parsed.query_pairs() {
        match k.as_ref() {
            "code" => code = Some(v.to_string()),
            "state" => got_state = Some(v.to_string()),
            _ => {}
        }
    }
    let _ = request.respond(tiny_http::Response::from_string(
        "<html><body style='font-family:sans-serif'>Signed in. You can close this window.</body></html>",
    ).with_header("Content-Type: text/html".parse::<tiny_http::Header>().unwrap()));

    if got_state.as_deref() != Some(&state) {
        return Err("OAuth state mismatch".into());
    }
    let code = code.ok_or("No authorization code returned")?;

    // Exchange code -> tokens (PKCE; client_secret for Desktop client is non-confidential)
    let client = reqwest::Client::new();
    let resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", CLIENT_ID),
            ("client_secret", CLIENT_SECRET),
            ("code", &code),
            ("code_verifier", &verifier),
            ("grant_type", "authorization_code"),
            ("redirect_uri", &redirect_uri),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let id_token = json["id_token"].as_str().ok_or("No id_token in response")?.to_string();
    let access_token = json["access_token"].as_str().unwrap_or("").to_string();

    Ok(SignInTokens { id_token, access_token })
}
```

- [ ] **Step 2: Register the command in `src-tauri/src/lib.rs`**

```rust
mod oauth;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![oauth::google_sign_in])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Verify it compiles (env vars set by Task 5; use placeholders to compile)**

```bash
RUNWAY_GOOGLE_CLIENT_ID=placeholder RUNWAY_GOOGLE_CLIENT_SECRET=placeholder \
  cargo build --manifest-path src-tauri/Cargo.toml
```
Expected: compiles successfully.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src
git commit -m "feat: add google_sign_in loopback OAuth command"
```

---

### Task 4: Frontend Tauri branch in `app/auth.js`

**Files:**
- Modify: `app/auth.js` (around the existing `signInWithGoogle` at line ~118)

**Interfaces:**
- Consumes: Tauri command `google_sign_in` returning `{ idToken, accessToken }`.
- Produces: `signInWithGoogle()` that uses `signInWithCredential` when running in Tauri, else the existing `signInWithPopup`.

- [ ] **Step 1: Add `signInWithCredential` to the Firebase auth import**

In `app/auth.js`, add `signInWithCredential` to the existing import list alongside `GoogleAuthProvider`, `signInWithPopup`.

- [ ] **Step 2: Replace the body of `signInWithGoogle`**

```js
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  try {
    if (window.__TAURI__) {
      const { invoke } = window.__TAURI__.core;
      const { idToken, accessToken } = await invoke('google_sign_in');
      const credential = GoogleAuthProvider.credential(idToken, accessToken || null);
      await signInWithCredential(auth, credential);
    } else {
      await signInWithPopup(auth, provider);
    }
  } catch (err) {
    console.error('Google sign-in failed', err);
    throw err;
  }
}
```
(Preserve any existing post-sign-in logic / error handling that was in the original function — fold it into both branches.)

- [ ] **Step 3: Enable `withGlobalTauri` so `window.__TAURI__` exists**

In `src-tauri/tauri.conf.json`, add under `"app"`: `"withGlobalTauri": true`.

- [ ] **Step 4: Verify in dev app**

```bash
pnpm tauri:dev
```
Click "Sign in with Google" → system browser opens Google consent → after approving, the browser shows "You can close this window" and the app window becomes authenticated. (Requires Task 5 done first.)

- [ ] **Step 5: Commit**

```bash
git add app/auth.js src-tauri/tauri.conf.json
git commit -m "feat: route Google sign-in through system browser when in Tauri"
```

---

### Task 5: Google Cloud Desktop OAuth client (manual) + env wiring

**Files:**
- Create: `src-tauri/.env.example`
- Create: `BUILD-MACOS.md` (handoff notes)

**Interfaces:**
- Produces: `RUNWAY_GOOGLE_CLIENT_ID`, `RUNWAY_GOOGLE_CLIENT_SECRET` available at compile time.

- [ ] **Step 1: Create the Desktop OAuth client (manual, web console)**

In Google Cloud Console for project **`runway-40912`**:
1. APIs & Services → Credentials → **Create Credentials → OAuth client ID**.
2. Application type: **Desktop app**. Name: `Runway macOS`.
3. Create → copy the **Client ID** and **Client secret**.

- [ ] **Step 2: Create `src-tauri/.env.example`**

```
RUNWAY_GOOGLE_CLIENT_ID=your-desktop-client-id.apps.googleusercontent.com
RUNWAY_GOOGLE_CLIENT_SECRET=your-desktop-client-secret
```

- [ ] **Step 3: Document build + run in `BUILD-MACOS.md`**

Include: how to set the two env vars before `pnpm tauri:dev` / `pnpm tauri:build`, the GCP steps above, and the right-click→Open Gatekeeper note for teammates.

- [ ] **Step 4: Commit (do NOT commit real secrets)**

```bash
git add src-tauri/.env.example BUILD-MACOS.md
git commit -m "docs: document Desktop OAuth client setup and macOS build"
```

---

### Task 6: Build, sign, and package the universal `.dmg`

**Files:** none (produces artifacts under `src-tauri/target/`)

- [ ] **Step 1: Build the universal app with OAuth env vars set**

```bash
RUNWAY_GOOGLE_CLIENT_ID=<real-id> RUNWAY_GOOGLE_CLIENT_SECRET=<real-secret> \
  pnpm tauri:build
```
Expected: produces `Runway.app` and `Runway_1.0.0_universal.dmg` under `src-tauri/target/universal-apple-darwin/release/bundle/`.

- [ ] **Step 2: Verify ad-hoc signature**

```bash
codesign -dv --verbose=4 "src-tauri/target/universal-apple-darwin/release/bundle/macos/Runway.app" 2>&1 | grep -i "signature\|identifier"
```
Expected: shows `Signature=adhoc` and identifier `com.accuweather.runway`.

- [ ] **Step 3: Launch the packaged app and sign in end-to-end**

Open the `.app`, click Sign in with Google, complete the browser flow, confirm the board loads authenticated.

- [ ] **Step 4: Hand off the `.dmg`**

Share the `.dmg` with teammates plus the right-click→Open instruction from `BUILD-MACOS.md`.

---

## Self-Review

- **Spec coverage:** Tauri shell (T2), remote URL + offline fallback (T2), OAuth loopback (T3/T4), GCP Desktop client (T5), universal binary + ad-hoc sign + dmg (T6), tooling/scripts (T1). All spec sections covered.
- **Placeholders:** OAuth client ID/secret are intentionally external (manual GCP step) and injected via env — not plan placeholders.
- **Type consistency:** `SignInTokens` serializes to `{ idToken, accessToken }`; consumed identically in `app/auth.js` Task 4. `google_sign_in` command name consistent across T3/T4.
