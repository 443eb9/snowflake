use std::sync::Mutex;

use log::LevelFilter;
use tauri::Manager;

use crate::models::{FsCache, Storage};

mod cmd;
mod err;
mod models;
mod util;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            app.manage(Mutex::new(Option::<FsCache>::None));
            app.manage(Mutex::new(Option::<Storage>::None));
            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            cmd::load_library,
            cmd::save_library,
            cmd::get_folder_tree,
            cmd::get_root_folder_id,
            cmd::get_all_tags,
            cmd::modify_tag,
            cmd::get_assets_at,
            cmd::get_folder,
            cmd::get_asset,
            cmd::get_assets,
            cmd::get_tags_of,
            cmd::modify_tags_of,
            cmd::get_assets_containing_tag,
            cmd::compute_checksum,
            cmd::delete_folders,
            cmd::delete_assets,
            cmd::rename_folder,
            cmd::rename_asset,
            cmd::move_folders_to,
            cmd::move_assets_to
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
