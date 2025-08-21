use iced::{
    Length::Fill,
    Task,
    widget::{Image, button, column, container, image::Handle, row, text},
};
use snowflake_storage::data::{AssetMetadata, Id, Tag};

use crate::{
    LibraryCache, LibrarySource,
    widgets::{Column, Element, Row},
};

#[derive(Debug, Clone)]
pub enum Message {
    AllAssets,
    AllUntaggedAssets,
    SelectTag(Tag),
    SelectAsset(AssetMetadata),
}

pub struct LibraryScreen {}

impl LibraryScreen {
    pub fn view(&self, source: &LibrarySource, cache: &LibraryCache) -> Element<Message> {
        let presets = column![
            button(text("All Assets"))
                .width(Fill)
                .on_press(Message::AllAssets),
            button(text("All Untagged Assets"))
                .width(Fill)
                .on_press(Message::AllUntaggedAssets),
        ];
        let tags = Column::from_iter(cache.tags.iter().map(|tag| {
            button(text(tag.name.clone()))
                .width(Fill)
                .on_press(Message::SelectTag(tag.clone()))
                .into()
        }));

        let assets = Row::from_iter(cache.displayed_assets.iter().map(|asset| {
            button(column![
                container(Image::new(Handle::from_path(
                    source.root.join(&asset.original_file(source))
                )))
                .max_height(200),
                text(asset.name.clone())
            ])
            .on_press(Message::SelectAsset(asset.clone()))
            .into()
        }))
        .wrap();

        let selected = match cache.selected_assets.len() {
            0 => Element::from(text("No asset selected.").width(240)),
            1 => {
                let asset = cache.selected_assets.values().next().unwrap();
                Element::from(
                    column![
                        container(Image::new(Handle::from_path(
                            source.root.join(asset.original_file(source))
                        )))
                        .max_height(200),
                        text(asset.name.clone()),
                        text(asset.src.clone()),
                        text(asset.desc.clone()),
                        text(format!("Size: {} bytes", asset.size_bytes)),
                        text(format!("Format: {}", asset.extension)),
                        text(format!(
                            "Created at: {}",
                            asset.created_at.map(|d| d.to_string()).unwrap_or_default()
                        )),
                        text(format!("Imported at: {}", asset.imported_at)),
                    ]
                    .width(240),
                )
            }
            _ => Element::from(text("Multiple assets selected.").width(240)),
        };

        row![column![presets, tags].width(240), assets, selected].into()
    }
}
