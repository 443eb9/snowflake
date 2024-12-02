import { Menu, MenuButton, MenuItem, MenuList, MenuPopover, MenuTrigger, Tag as FluentTag, TagGroup, Text } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { GetAllTags, ModifyTagsOf, Tag } from "../backend";

export default function TagsContainer({
    associatedItem, tags, readonly
}: {
    associatedItem?: string, tags: Tag[], readonly?: boolean
}) {
    const [currentItem, setCurrentItem] = useState<string | null>()
    const [allTags, setAllTags] = useState<Tag[] | undefined>()
    const [selected, setSelected] = useState<Tag[]>([])

    const update = (newTags: Tag[]) => {
        if (associatedItem) {
            setSelected(newTags)
            ModifyTagsOf({ asset: associatedItem, newTags: newTags })
                .catch(err => {
                    // TODO error handling
                    console.log(err)
                })
        }
    }

    async function fetchTags() {
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
        if (associatedItem != currentItem) {
            setCurrentItem(associatedItem)
            setSelected(tags)
        }

        if (!allTags) {
            fetchTags()
        }
    }, [associatedItem])

    if (!allTags) {
        return <></>
    }

    const available = allTags.filter(tag => selected.find(t => t.meta.id == tag.meta.id) == undefined)

    return (
        <div className="flex flex-col gap-2 overflow-hidden">
            <TagGroup
                onDismiss={(_, data) => update([...selected].filter(tag => tag.meta.id != data.value))}
            >
                {
                    selected.length == 0
                        ? <Text italic className="opacity-50">None</Text>
                        : selected.map((tag, index) =>
                            <FluentTag
                                key={index}
                                dismissible={!readonly}
                                value={tag.meta.id}
                                style={{ color: `#${tag.color}` }}
                            >
                                {tag.name}
                            </FluentTag>
                        )
                }
            </TagGroup>

            {
                !readonly &&
                <Menu inline>
                    <MenuTrigger>
                        <MenuButton onClick={() => fetchTags()}>Add Tag</MenuButton>
                    </MenuTrigger>

                    <MenuPopover>
                        <MenuList>
                            {
                                available.length == 0
                                    ? <MenuItem>No tags available.</MenuItem>
                                    : available.map((tag, index) =>
                                        <MenuItem
                                            key={index}
                                            style={{ color: `#${tag.color}` }}
                                            onClick={() => update([...selected, tag])}
                                        >
                                            {tag.name}
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
