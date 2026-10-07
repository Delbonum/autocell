/// Desktop-Hülle von AutoCell. Die gesamte Logik steckt in der Weboberfläche
/// (`apps/autocell/src`) und im Rechenkern (`packages/core`).
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("AutoCell konnte nicht gestartet werden");
}
