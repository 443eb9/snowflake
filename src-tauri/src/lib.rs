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
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(LevelFilter::Info)
                .build(),
        )
        .setup(|app| {
            let crash_reports = app.path().app_data_dir().unwrap().join("crashReports");
            let _ = std::fs::create_dir_all(&crash_reports);
            std::panic::set_hook(Box::new(move |info| {
                log::error!("Main thread panic.");
                let _ = std::fs::write(
                    crash_reports.join(&format!(
                        "crash-{}.txt",
                        chrono::Local::now().to_rfc3339().replace(':', "_")
                    )),
                    info.to_string(),
                );
                let _ = tauri_plugin_opener::open_path(&crash_reports, None::<&str>);
                log::info!("Crash report saved.");
            }));

            app.manage(Mutex::new(Option::<Storage>::None));
            app.manage(ResourceCache::new(app.handle()).unwrap());
            app.manage(Mutex::new(AppData::read(app.handle()).unwrap()));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd::crash_test,
            cmd::open_crash_reports_dir,
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
            cmd::recover_assets,
            cmd::get_recycle_bin,
            cmd::get_duplicated_assets,
            cmd::get_asset_abs_path,
            cmd::get_tag_virtual_path,
            cmd::get_collection_tree,
            cmd::get_special_collections,
            cmd::get_all_tags,
            cmd::get_all_assets,
            cmd::get_all_uncategorized_assets,
            cmd::modify_tag,
            cmd::get_asset,
            cmd::get_tags_on_asset,
            cmd::get_removed_asset,
            cmd::get_assets,
            cmd::get_items,
            cmd::get_tags,
            cmd::modify_src_of,
            cmd::get_assets_containing_tag,
            cmd::delete_assets,
            cmd::delete_tags,
            cmd::delete_collections,
            cmd::create_tags,
            cmd::create_collections,
            cmd::rename_item,
            cmd::recolor_collection,
            cmd::move_tags_to,
            cmd::regroup_tag,
            cmd::add_tag_to_assets,
            cmd::remove_tag_from_assets,
            cmd::move_collections_to,
            cmd::open_with_default_app,
            cmd::quick_ref,
            cmd::compute_camera_pos,
            cmd::save_render_cache,
            cmd::get_render_cache,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
