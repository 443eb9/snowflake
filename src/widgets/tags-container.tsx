import { Menu, MenuButton, MenuItem, MenuList, MenuPopover, MenuTrigger, Tag as FluentTag, TagGroup, Text } from "@fluentui/react-components";
import { useContext, useEffect, useState } from "react";
import { GetAllTags, GetTags, ModifyTagsOf, Tag } from "../backend";
import { browsingFolderContext } from "../context-provider";
import TagName from "./tag-name";

export default function TagsContainer({
    associatedItem, tags, readonly
}: {
    associatedItem?: string, tags: string[], readonly?: boolean
}) {
    const [currentItem, setCurrentItem] = useState<string | null>()
    const [allTags, setAllTags] = useState<Tag[] | undefined>()
    const [selected, setSelected] = useState<Tag[]>([])
    const browsingFolder = useContext(browsingFolderContext)

    const update = (newTags: Tag[], isDismiss: boolean) => {
        if (associatedItem) {
            ModifyTagsOf({ assets: [associatedItem], newTags: newTags.map(t => t.id) })
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })

            if (!browsingFolder) {
                return
            }

            const currentFolder = browsingFolder.data

            if (isDismiss && currentFolder?.collection && newTags.find(t => t.id == currentFolder?.id) == undefined) {
                browsingFolder.setter({
                    ...currentFolder,
                    content: currentFolder.content.filter(itemId => itemId != associatedItem)
                })
            }

            if (!isDismiss && currentFolder?.collection && selected.find(t => t.id == currentFolder.id) == undefined) {
                browsingFolder.setter({
                    ...currentFolder,
                    content: [...currentFolder.content, associatedItem]
                })
            }

            setSelected(newTags)
        }
    }

    async function fetchAllTags() {
        const allTags = await GetAllTags()
            .catch(err => {
                // TODO error handling
                console.error(err)
            })

        if (allTags) {
            setAllTags(allTags)
        }
    }

    useEffect(() => {

        async function fetchTags() {
            const selected = await GetTags({ tags: tags })
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })

            if (selected) {
                setSelected(selected)
            }
        }

        if (associatedItem != currentItem) {
            setCurrentItem(associatedItem)
            fetchTags()
        }
    }, [associatedItem])

    const available = allTags?.filter(tag => selected.find(t => t.id == tag.id) == undefined)

    return (
        <div className="flex flex-col gap-2 overflow-hidden">
            <TagGroup
                className="flex-wrap gap-1"
                onDismiss={(_, data) => update([...selected].filter(tag => tag.id != data.value), true)}
            >
                {
                    selected.length == 0
                        ? <Text italic className="opacity-50">None</Text>
                        : selected.map((tag, index) =>
                            <FluentTag
                                key={index}
                                dismissible={!readonly}
                                value={tag.id}
                                style={{ color: `#${tag.color}` }}
                            >
                                <TagName name={tag.name} />
                            </FluentTag>
                        )
                }
            </TagGroup>

            {
                !readonly &&
                <Menu>
                    <MenuTrigger>
                        <MenuButton onClick={() => fetchAllTags()}>Add Tag</MenuButton>
                    </MenuTrigger>

                    <MenuPopover>
                        <MenuList>
                            {
                                available?.length == 0
                                    ? <MenuItem>No tags available.</MenuItem>
                                    : available?.map((tag, index) =>
                                        <MenuItem
                                            key={index}
                                            style={{ color: `#${tag.color}` }}
                                            onClick={() => update([...selected, tag], false)}
                                        >
                                            <TagName name={tag.name} />
                                        </MenuItem>
                                    )
                            }
                        </MenuList>
                    </MenuPopover>
                </Menu>
            }
        </div>
    )
}
