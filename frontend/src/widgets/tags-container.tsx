import { Menu, MenuButton, MenuItem, MenuList, MenuPopover, MenuTrigger, Tag, TagGroup, Text } from "@fluentui/react-components";
import { main } from "../../wailsjs/go/models";
import { useEffect, useState } from "react";
import { GetAllTags, ModifyTagsOfAsset } from "../../wailsjs/go/main/App";

export default function TagsContainer({
    associatedItem, itemType, tags, readonly
}: {
    associatedItem?: string, itemType?: number, tags: main.TagRef[], readonly?: boolean
}) {
    const [currentItem, setCurrentItem] = useState<string | null>()
    const [allTags, setAllTags] = useState<main.TagRef[] | undefined>()
    const [selected, setSelected] = useState<main.TagRef[]>([])

    const update = (newTags: main.TagRef[]) => {
        setSelected(newTags)
        ModifyTagsOfAsset(itemType, associatedItem, newTags)
            .catch(err => {
                // TODO error handling
                console.log(err)
            })
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

    const available = allTags.filter(tag => selected.find(t => t.id == tag.id) == undefined)

    return (
        <div className="flex flex-col gap-2 overflow-hidden">
            <TagGroup
                onDismiss={(_, data) => update([...selected].filter(tag => tag.id != data.value))}
            >
                {
                    selected.length == 0
                        ? <Text italic className="opacity-50">None</Text>
                        : selected.map((tag, index) =>
                            <Tag
                                key={index}
                                dismissible={!readonly}
                                value={tag.id}
                                style={{ color: `#${tag.color}` }}
                            >
                                {tag.name}
                            </Tag>
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
