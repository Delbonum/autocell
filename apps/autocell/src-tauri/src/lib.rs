/// Desktop-Hülle von AutoCell. Die gesamte Logik steckt in der Weboberfläche
/// (`apps/autocell/src`) und im Rechenkern (`packages/core`). Hier liegen nur
/// die Dinge, die der Browser nicht kann: echter Dateizugriff und das Öffnen
/// von Dateien per Doppelklick im Explorer.
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Emitter, Manager, State};

/// Dateiendungen, die AutoCell lesen und schreiben darf.
const ALLOWED_EXTENSIONS: &[&str] = &["acp", "json", "csv", "rle", "txt", "png"];

/// Dateien, die AutoCell öffnen soll (Doppelklick auf eine .acp-Datei). Bis die
/// Oberfläche bereit ist, werden sie gesammelt; danach gehen sie als Ereignis
/// `open-files` direkt an die Oberfläche.
struct OpenQueue(Mutex<PendingFiles>);

struct PendingFiles {
    ready: bool,
    files: Vec<String>,
}

fn deliver(app: &AppHandle, files: Vec<String>) {
    if files.is_empty() {
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
    let queue = app.state::<OpenQueue>();
    let mut pending = queue.0.lock().unwrap();
    if pending.ready {
        drop(pending);
        let _ = app.emit("open-files", files);
    } else {
        pending.files.extend(files);
    }
}

fn check_extension(path: &Path) -> Result<(), String> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if ALLOWED_EXTENSIONS.contains(&ext.as_str()) {
        Ok(())
    } else {
        Err(format!("Dateityp „.{ext}“ wird nicht unterstützt."))
    }
}

fn io_error(path: &Path, e: std::io::Error) -> String {
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("Datei");
    match e.kind() {
        std::io::ErrorKind::NotFound => format!("„{name}“ wurde nicht gefunden."),
        std::io::ErrorKind::PermissionDenied => format!("Keine Berechtigung für „{name}“."),
        _ => format!("„{name}“: {e}"),
    }
}

/// Dekodiert einen per `encodeURIComponent` übertragenen Pfad.
fn percent_decode(s: &str) -> Result<String, String> {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).map_err(|_| "Ungültiger Pfad")?;
            out.push(u8::from_str_radix(hex, 16).map_err(|_| "Ungültiger Pfad")?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).map_err(|_| "Ungültiger Pfad".to_string())
}

/// Liest eine Datei vollständig (binär, ohne Umweg über JSON).
#[tauri::command]
fn read_file(path: String) -> Result<Response, String> {
    let path = PathBuf::from(path);
    check_extension(&path)?;
    std::fs::read(&path).map(Response::new).map_err(|e| io_error(&path, e))
}

/// Schreibt eine Datei. Der Inhalt kommt als Rohdaten, der Pfad im Kopf `path`.
/// Erst in eine temporäre Datei, dann umbenennen: Bricht das Schreiben ab,
/// bleibt die alte Datei unversehrt.
#[tauri::command]
fn write_file(request: Request<'_>) -> Result<(), String> {
    let InvokeBody::Raw(data) = request.body() else {
        return Err("Keine Daten erhalten.".into());
    };
    let header = request
        .headers()
        .get("path")
        .and_then(|v| v.to_str().ok())
        .ok_or("Kein Pfad angegeben.")?;
    let path = PathBuf::from(percent_decode(header)?);
    check_extension(&path)?;
    let name = path.file_name().ok_or("Ungültiger Pfad.")?.to_string_lossy().into_owned();
    let tmp = path.with_file_name(format!(".{name}.autocell-tmp"));
    std::fs::write(&tmp, data).map_err(|e| io_error(&path, e))?;
    std::fs::rename(&tmp, &path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        io_error(&path, e)
    })
}

/// Gesammelte Dateien abholen. Die Oberfläche ruft das auf, sobald sie auf
/// `open-files` hört; alle späteren Dateien kommen dann als Ereignis.
#[tauri::command]
fn take_initial_files(state: State<'_, OpenQueue>) -> Vec<String> {
    let mut pending = state.0.lock().unwrap();
    pending.ready = true;
    std::mem::take(&mut pending.files)
}

/// Wandelt Kommandozeilenargumente in vorhandene Dateipfade um.
fn file_args(args: impl IntoIterator<Item = String>, cwd: &Path) -> Vec<String> {
    args.into_iter()
        .filter(|a| !a.starts_with('-'))
        .map(|a| {
            let p = PathBuf::from(&a);
            if p.is_absolute() { p } else { cwd.join(p) }
        })
        .filter(|p| p.is_file())
        .map(|p| p.to_string_lossy().into_owned())
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cwd = std::env::current_dir().unwrap_or_default();
    let initial = file_args(std::env::args().skip(1), &cwd);

    let mut builder = tauri::Builder::default();
    #[cfg(desktop)]
    {
        // Läuft AutoCell schon, öffnet ein Doppelklick die Datei im vorhandenen Fenster
        // (Windows und Linux übergeben die Datei als Argument eines neuen Prozesses).
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            deliver(app, file_args(args.into_iter().skip(1), Path::new(&cwd)));
        }));
    }
    let app = builder
        .plugin(tauri_plugin_dialog::init())
        .manage(OpenQueue(Mutex::new(PendingFiles { ready: false, files: initial })))
        .invoke_handler(tauri::generate_handler![read_file, write_file, take_initial_files])
        .build(tauri::generate_context!())
        .expect("AutoCell konnte nicht gestartet werden");

    app.run(|_handle, _event| {
        // macOS übergibt per Doppelklick geöffnete Dateien nicht als Argument,
        // sondern als Ereignis – beim Start wie im laufenden Betrieb.
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = _event {
            let files = urls
                .into_iter()
                .filter_map(|u| u.to_file_path().ok())
                .filter(|p| p.is_file())
                .map(|p| p.to_string_lossy().into_owned())
                .collect();
            deliver(_handle, files);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dekodiert_pfade() {
        assert_eq!(percent_decode("C%3A%5CDaten%5CM%C3%BCller.acp").unwrap(), "C:\\Daten\\Müller.acp");
        assert_eq!(percent_decode("einfach.acp").unwrap(), "einfach.acp");
        assert!(percent_decode("kaputt%ZZ.acp").is_err());
    }

    #[test]
    fn prueft_endungen() {
        assert!(check_extension(Path::new("a.ACP")).is_ok());
        assert!(check_extension(Path::new("bild.png")).is_ok());
        assert!(check_extension(Path::new("programm.exe")).is_err());
        assert!(check_extension(Path::new("ohne")).is_err());
    }
}
