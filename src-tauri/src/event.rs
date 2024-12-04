use std::{fs::metadata, path::PathBuf, sync::Mutex};

use crossbeam_channel::Receiver;
use notify::{
    event::{CreateKind, MetadataKind, ModifyKind, RemoveKind},
    EventKind,
};
use notify_debouncer_full::DebouncedEvent;
use tauri::{AppHandle, Manager};

use crate::models::{Asset, Folder, FsCache, Metadata, Storage};

pub fn fs_change_watch(
    app: AppHandle,
    rx: Receiver<Result<Vec<DebouncedEvent>, Vec<notify::Error>>>,
) {
    while let Ok(event) = rx.recv() {
        match event {
            Ok(changes) => {
                for DebouncedEvent { event, time } in changes {
                    let path = event.paths;
                    match event.kind {
                        EventKind::Create(_) => handle_creation(path, &app),
                        EventKind::Modify(modify) => match modify {
                            ModifyKind::Any => todo!(),
                            ModifyKind::Data(_) => {}
                            ModifyKind::Metadata(meta) => {
                                if matches!(meta, MetadataKind::WriteTime) {
                                    handle_meta_modify(path, &app);
                                }
                            }
                            ModifyKind::Name(rename) => todo!(),
                            ModifyKind::Other => todo!(),
                        },
                        EventKind::Remove(remove) => match remove {
                            RemoveKind::Any => todo!(),
                            RemoveKind::File => todo!(),
                            RemoveKind::Folder => todo!(),
                            RemoveKind::Other => todo!(),
                        },
                        _ => {}
                    }
                }
            }
            Err(err) => {
                log::error!("Encountered error while watching path.");
                for e in err {
                    log::error!("{}", e);
                }
                break;
            }
        }
    }
    log::info!("End watching path.");
}

fn handle_creation(path: Vec<PathBuf>, app: &AppHandle) {
    let (cache, storage) = (app.state::<Mutex<FsCache>>(), app.state::<Mutex<Storage>>());
    let mut cache = cache.lock().unwrap();
    let storage = storage.lock().unwrap();

    for path in path {
        let std_meta = metadata(&path).unwrap();
        let meta = Metadata::from_std_meta(&std_meta);
        let relative = cache.relativize_path(&path);
        let parent_path = relative.parent().map(|p| cache.relativize_path(p)).unwrap();

        if std_meta.is_file() {
            if let Some(folder) = cache.folders.get_mut(&parent_path) {
                folder.content.insert(relative.clone());
            }

            let asset = Asset::new(&relative, meta);
            cache.assets.insert(relative, asset);
        } else {
            if let Some(folder) = cache.folders.get_mut(&parent_path) {
                folder.children.insert(relative.clone());
            }

            let folder = Folder::new(&relative, meta);
            cache.folders.insert(relative, folder);
        }
    }
}

fn handle_meta_modify(path: Vec<PathBuf>, app: &AppHandle) {
    let cache = app.state::<Mutex<FsCache>>();
    let mut cache = cache.lock().unwrap();

    for path in path {}
}
