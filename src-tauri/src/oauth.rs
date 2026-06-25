use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri_plugin_opener::OpenerExt;

// Desktop OAuth client created in GCP project runway-40912 (see BUILD-MACOS.md).
// Injected at compile time; absent in plain `cargo build`, so we fail gracefully.
const CLIENT_ID: Option<&str> = option_env!("RUNWAY_GOOGLE_CLIENT_ID");
const CLIENT_SECRET: Option<&str> = option_env!("RUNWAY_GOOGLE_CLIENT_SECRET");

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
    let client_id = CLIENT_ID.ok_or("RUNWAY_GOOGLE_CLIENT_ID not set at build time")?;
    let client_secret = CLIENT_SECRET.ok_or("RUNWAY_GOOGLE_CLIENT_SECRET not set at build time")?;

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
&client_id={client_id}&redirect_uri={redirect_uri}&scope=openid%20email%20profile\
&code_challenge={challenge}&code_challenge_method=S256&state={state}"
    );

    app.opener()
        .open_url(auth_url, None::<&str>)
        .map_err(|e| e.to_string())?;

    // Wait for the loopback redirect off the async executor (tiny_http is blocking).
    let expected_state = state.clone();
    let (code, ok_state) = tauri::async_runtime::spawn_blocking(move || {
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
        let body = "<html><body style='font-family:-apple-system,sans-serif;text-align:center;padding-top:80px'>\
            <h2>Signed in to Runway</h2><p>You can close this window.</p></body></html>";
        let header = "Content-Type: text/html".parse::<tiny_http::Header>().unwrap();
        let _ = request.respond(tiny_http::Response::from_string(body).with_header(header));
        Ok::<(Option<String>, Option<String>), String>((code, got_state))
    })
    .await
    .map_err(|e| e.to_string())??;

    if ok_state.as_deref() != Some(&expected_state) {
        return Err("OAuth state mismatch".into());
    }
    let code = code.ok_or("No authorization code returned")?;

    // Exchange code -> tokens (PKCE). The Desktop client secret is non-confidential.
    let client = reqwest::Client::new();
    let resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("code", code.as_str()),
            ("code_verifier", verifier.as_str()),
            ("grant_type", "authorization_code"),
            ("redirect_uri", redirect_uri.as_str()),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let id_token = json["id_token"]
        .as_str()
        .ok_or_else(|| format!("No id_token in token response: {json}"))?
        .to_string();
    let access_token = json["access_token"].as_str().unwrap_or("").to_string();

    Ok(SignInTokens {
        id_token,
        access_token,
    })
}
