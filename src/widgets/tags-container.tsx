import { Menu, MenuButton, MenuItem, MenuList, MenuPopover, MenuTrigger, Tag as FluentTag, TagGroup, Text, useToastController } from "@fluentui/react-components";
import { useContext, useEffect, useState } from "react";
import { AddTagToAssets, GetAllTags, GetTags, GetTagsOnAsset, GetTagsWithoutConflict, GetUserSetting, RemoveTagFromAssets, Tag } from "../backend";
import { browsingFolderContext, selectedItemsContext } from "../helpers/context-provider";
import TagName from "./tag-name";
import { t } from "../i18n";
import ErrToast from "./toasts/err-toast";
import { GlobalToasterId } from "../main";

export default function TagsContainer({
    associatedItem, tags, readonly,
}: {
    associatedItem?: string, tags: string[], readonly?: boolean
}) {
    const [available, setAvailable] = useState<Tag[] | undefined>()
    const [selected, setSelected] = useState<Tag[]>([])
    const [selectedIds, setSelectedIds] = useState(tags)
    const browsingFolder = useContext(browsingFolderContext)
    const selectedItems = useContext(selectedItemsContext)

    const { dispatchToast } = useToastController(GlobalToasterId)

    const update = async (tagId: string | undefined, isDismiss: boolean) => {
        if (!browsingFolder?.data?.subTy || !associatedItem || !tagId) {
            return
        }

        if (isDismiss) {
            await RemoveTagFromAssets({ assets: [associatedItem], tag: tagId })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        } else {
            await AddTagToAssets({ assets: [associatedItem], tag: tagId })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        }

        const selectedIds = await GetTagsOnAsset({ asset: associatedItem })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        if (selectedIds) {
            if (browsingFolder.data.id && !selectedIds.includes(browsingFolder.data.id)) {
                selectedItems?.setter([])
                browsingFolder.setter({
                    ...browsingFolder.data,
                    content: browsingFolder.data.content.filter(id => id.id != associatedItem)
                })
            }

            setSelectedIds(selectedIds)
        }
    }

    async function fetchAllTags() {
        const hideConflict = await GetUserSetting({ category: "general", item: "hideConflictTagsWhenPickingNewTags" })
            .catch(err => dispatchToast(<ErrToast body={err} />)) as boolean | undefined
        if (hideConflict == undefined) { return }

        const available = await (hideConflict ? GetTagsWithoutConflict({ tags: selected.map(t => t.id) }) : GetAllTags())
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        if (available) {
            setAvailable(available)
        }
    }

    useEffect(() => {
        async function fetchTags() {
            const selected = await GetTags({ tags: selectedIds })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            if (selected) {
                setSelected(selected)
            }
        }

        fetchTags()
    }, [selectedIds])

    useEffect(() => {
        async function fetch() {
            if (associatedItem) {
                const tags = await GetTagsOnAsset({ asset: associatedItem })
                    .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                if (tags) {
                    setSelectedIds(tags)
                }
            }
        }

        fetch()
    }, [associatedItem])

    useEffect(() => {
        fetchAllTags()
    }, [])

    if (!available) {
        return <></>
    }

    return (
        <div className="flex flex-col gap-2 overflow-hidden">
            <TagGroup
                className="flex-wrap gap-1"
                onDismiss={(_, data) => update(data.value, true)}
            >
                {
                    selected.length == 0
                        ? <Text italic className="opacity-50">{t("tagsContainer.none")}</Text>
                        : selected.map((tag, index) =>
                            <FluentTag
                                key={index}
                                dismissible={!readonly}
                                value={tag.id}
                                style={tag.color ? { color: `#${tag.color}` } : undefined}
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
                        <MenuButton onClick={() => fetchAllTags()}>{t("tagsContainer.add")}</MenuButton>
                    </MenuTrigger>

                    <MenuPopover>
                        <MenuList>
                            {
                                available?.length == 0
                                    ? <MenuItem>{t("tagsContainer.noAvailable")}</MenuItem>
                                    : available?.map((tag, index) =>
                                        <MenuItem
                                            key={index}
                                            style={tag.color ? { color: `#${tag.color}` } : undefined}
                                            onClick={() => update(tag.id, false)}
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
