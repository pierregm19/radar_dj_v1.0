// Punto de entrada nativo de Radar_DJ.
// Esto es lo que compila a un .exe independiente: abre su propia
// ventana (ver tauri.conf.json) usando el motor WebView2 del sistema,
// sin depender de un navegador externo.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_drag::init())
        .run(tauri::generate_context!())
        .expect("error al iniciar Radar_DJ");
}
