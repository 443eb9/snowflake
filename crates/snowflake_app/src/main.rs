use std::{
    collections::{HashMap, hash_map::Entry},
    path::{Path, PathBuf},
    sync::Arc,
};

use iced::{
    Subscription, Task, event,
    keyboard::{self, Modifiers},
    widget::column,
    window,
};
use snowflake_storage::{
    LibrarySource,
    data::{AssetExtension, AssetMetadata, Id, Tag},
    sql::main_db::MainDatabase,
};

use crate::{
    cache::LibraryCache,
    screens::library::{self, LibraryScreen},
    widgets::Element,
};

mod cache;
mod screens;
mod widgets;

fn main() {
    iced::daemon("Snowflake", Snowflake::update, Snowflake::view)
        .subscription(Snowflake::subscription)
        .run_with(Snowflake::new)
        .unwrap();
}

pub enum Screen {
    Library(LibraryScreen),
    Other,
}

#[derive(Debug)]
pub enum Message {
    Window(window::Id, window::Event),
    Keyboard(window::Id, keyboard::Event),
    Library(library::Message),
    LibrarySourceUpdate(Option<LibrarySource>),
    LibraryCacheUpdate(LibraryCache),
    // TODO
    Toast,
}

#[derive(Debug)]
pub enum WindowUpdate {
    Open(window::Id),
    Close(window::Id),
}

#[derive(Debug, Default, Clone, Copy)]
pub struct ModifierState {
    pub ctrl: bool,
    pub shift: bool,
}

pub struct Snowflake {
    main_window: window::Id,
    screen: Screen,
    source: Option<Arc<LibrarySource>>,
    cache: LibraryCache,
    modifier_state: ModifierState,
}

impl Snowflake {
    pub fn new() -> (Self, Task<Message>) {
        let mut tasks = Vec::new();

        let (id, window_open) = window::open(window::Settings::default());
        tasks.push(window_open.then(|_| Task::none()));

        tasks.push(Task::perform(LibrarySource::new("test"), |s| {
            Message::LibrarySourceUpdate(Some(s.unwrap()))
        }));

        (
            Self {
                main_window: id,
                screen: Screen::Library(LibraryScreen {}),
                source: None,
                cache: Default::default(),
                modifier_state: Default::default(),
            },
            Task::batch(tasks),
        )
    }

    pub fn update(&mut self, message: Message) -> Task<Message> {
        match message {
            Message::Window(id, event) => {
                if id == self.main_window {
                    match event {
                        window::Event::Closed => return iced::exit(),
                        window::Event::FileDropped(path) => {
                            let Some(source) = self.source.clone() else {
                                return Task::none();
                            };

                            return Task::perform(
                                async move {
                                    let source = source;
                                    AssetMetadata::import(path, &source).await
                                },
                                |_| Message::Toast,
                            );
                        }
                        _ => {}
                    }
                }

                Task::none()
            }
            Message::Library(message) => {
                let Screen::Library(screen) = &mut self.screen else {
                    return Task::none();
                };

                let Some(source) = self.source.clone() else {
                    return Task::none();
                };

                match message {
                    library::Message::SelectTag(tag) => {
                        let tags = self.cache.tags.clone();
                        let new_selected_tags = if self.modifier_state.ctrl {
                            let mut t = self.cache.selected_tags.clone();
                            match t.entry(tag.id) {
                                Entry::Occupied(e) => {
                                    e.remove();
                                }
                                Entry::Vacant(e) => {
                                    e.insert(tag);
                                }
                            }
                            t
                        } else {
                            HashMap::from([(tag.id, tag)])
                        };

                        let ids = new_selected_tags
                            .iter()
                            .map(|(id, _)| *id)
                            .collect::<Vec<_>>();

                        Task::future(async move {
                            let Ok(new_assets) =
                                source.main_db.get_assets_with_tag(&ids, false).await
                            else {
                                return Message::Toast;
                            };

                            Message::LibraryCacheUpdate(LibraryCache {
                                tags,
                                displayed_assets: new_assets,
                                selected_tags: new_selected_tags,
                                selected_assets: Default::default(),
                            })
                        })
                    }
                    library::Message::SelectAsset(asset) => {
                        Task::done(Message::LibraryCacheUpdate(LibraryCache {
                            selected_assets: {
                                if self.modifier_state.ctrl {
                                    let mut a = self.cache.selected_assets.clone();
                                    match a.entry(asset.id) {
                                        Entry::Occupied(e) => {
                                            e.remove();
                                        }
                                        Entry::Vacant(e) => {
                                            e.insert(asset);
                                        }
                                    }
                                    a
                                } else {
                                    HashMap::from([(asset.id, asset)])
                                }
                            },
                            ..self.cache.clone()
                        }))
                    }
                }
            }
            Message::LibrarySourceUpdate(source) => match source {
                Some(new) => {
                    let task = Task::perform(LibraryCache::new(new.clone()), |cache| match cache {
                        Ok(cache) => Message::LibraryCacheUpdate(cache),
                        Err(err) => Message::Toast,
                    });
                    self.source = Some(Arc::new(new));
                    task
                }
                None => todo!(),
            },
            Message::LibraryCacheUpdate(cache) => {
                self.cache = cache;
                Task::none()
            }
            Message::Keyboard(id, event) => match event {
                keyboard::Event::ModifiersChanged(modifiers) => {
                    self.modifier_state.ctrl = modifiers.contains(Modifiers::COMMAND);
                    self.modifier_state.shift = modifiers.contains(Modifiers::SHIFT);
                    Task::none()
                }
                _ => Task::none(),
            },
            Message::Toast => Task::none(),
        }
    }

    pub fn view(&self, id: window::Id) -> Element<'_, Message> {
        match &self.screen {
            Screen::Library(library_screen) => {
                let Some(source) = &self.source else {
                    return column![].into();
                };
                library_screen
                    .view(&source, &self.cache)
                    .map(|m| Message::Library(m))
            }
            Screen::Other => todo!(),
        }
    }

    pub fn subscription(&self) -> Subscription<Message> {
        Subscription::batch(vec![
            window::events().map(|(id, e)| Message::Window(id, e)),
            event::listen_with(|ev, st, id| match ev {
                iced::Event::Keyboard(ev) => Some(Message::Keyboard(id, ev)),
                _ => None,
            }),
        ])
    }
}

fn import_local_asset(path: PathBuf) {}
