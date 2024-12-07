use std::sync::Mutex;

use log::LevelFilter;
use tauri::Manager;

use crate::app::{AppData, Storage};

mod app;
mod cmd;
mod err;
mod event;

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
            app.manage(Mutex::new(Option::<Storage>::None));
            app.manage(Mutex::new(AppData::read(app.handle().clone()).unwrap()));
            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            cmd::get_recent_libraries,
            cmd::load_library,
            cmd::initialize_library,
            cmd::save_library,
            cmd::import_assets,
            cmd::import_web_assets,
            cmd::get_asset_abs_path,
            cmd::get_asset_virtual_path,
            cmd::get_folder_virtual_path,
            cmd::get_folder_tree,
            cmd::get_root_folder_id,
            cmd::get_all_tags,
            cmd::modify_tag,
            cmd::get_assets_at,
            cmd::get_folder,
            cmd::get_asset,
            cmd::get_assets,
            cmd::get_tags,
            cmd::modify_tags_of,
            cmd::delta_tags_of,
            cmd::get_assets_containing_tag,
            cmd::compute_checksum,
            cmd::delete_folders,
            cmd::delete_assets,
            cmd::create_folders,
            cmd::rename_folder,
            cmd::rename_asset,
            cmd::move_folders_to,
            cmd::move_assets_to,
            cmd::quick_ref,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
