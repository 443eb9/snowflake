use std::sync::Mutex;

use log::LevelFilter;
use tauri::Manager;

use crate::app::{AppData, ResourceCache, Storage};

mod app;
mod cmd;
mod err;
mod event;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            app.manage(Mutex::new(Option::<Storage>::None));
            app.manage(ResourceCache::new(app.handle()).unwrap());
            app.manage(Mutex::new(AppData::read(app.handle()).unwrap()));
            let main_window = app.get_webview_window("main").unwrap();
            window_vibrancy::apply_mica(main_window, Some(true)).unwrap();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd::get_recent_libraries,
            cmd::get_user_settings,
            cmd::get_user_setting,
            cmd::get_default_settings,
            cmd::get_library_meta,
            cmd::set_user_setting,
            cmd::load_library,
            cmd::initialize_library,
            cmd::save_library,
            cmd::unload_library,
            cmd::export_library,
            cmd::gen_statistics,
            cmd::change_library_name,
            cmd::import_assets,
            cmd::import_memory_asset,
            cmd::import_web_assets,
            cmd::recover_items,
            cmd::get_recycle_bin,
            cmd::get_duplicated_assets,
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
            cmd::get_items,
            cmd::get_tags,
            cmd::modify_tags_of,
            cmd::delta_tags_of,
            cmd::modify_src_of,
            cmd::get_assets_containing_tag,
            cmd::delete_folders,
            cmd::delete_assets,
            cmd::create_folders,
            cmd::rename_folder,
            cmd::rename_asset,
            cmd::move_folders_to,
            cmd::move_assets_to,
            cmd::open_with_default_app,
            cmd::quick_ref,
            cmd::compute_camera_pos,
            cmd::save_render_cache,
            cmd::get_render_cache,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
