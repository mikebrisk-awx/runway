#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // The site loads from a remote origin, so Tauri can't inject its IPC.
        // Instead we set a flag via eval that the site reads to detect the desktop
        // app and switch Google sign-in to a full-page redirect (popups/embedded
        // OAuth don't work in a WebView).
        .on_page_load(|webview, _payload| {
            let _ = webview.eval("window.__RUNWAY_DESKTOP__ = true;");
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
