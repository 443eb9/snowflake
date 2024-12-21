import { Menu, MenuButton, MenuItem, MenuList, MenuPopover, MenuTrigger, Tag as FluentTag, TagGroup, Text, useToastController } from "@fluentui/react-components";
import { useContext, useEffect, useState } from "react";
import { AddTagToAssets, GetAllTags, GetAllUncategorizedAssets, GetAssetsContainingTag, GetTags, GetTagsOnAsset, RemoveTagFromAssets, Tag } from "../backend";
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
    const [allTags, setAllTags] = useState<Tag[] | undefined>()
    const [selected, setSelected] = useState<Tag[]>([])
    const [selectedIds, setSelectedIds] = useState(tags)
    const browsingFolder = useContext(browsingFolderContext)
    const selectedItems = useContext(selectedItemsContext)

    const { dispatchToast } = useToastController(GlobalToasterId)

    const update = async (tag: Tag | undefined, isDismiss: boolean) => {
        if (!browsingFolder?.data?.subTy || !associatedItem || !tag) {
            return
        }

        if (isDismiss) {
            await RemoveTagFromAssets({ assets: [associatedItem], tag: tag.id })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        } else {
            await AddTagToAssets({ assets: [associatedItem], tag: tag.id })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        }

        const selectedIds = await GetTagsOnAsset({ asset: associatedItem })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        if (selectedIds) {
            console.log(selectedIds)
            setSelectedIds(selectedIds)
        }

        let assets: string[] | void = undefined;
        switch (browsingFolder.data.subTy) {
            case "tag":
                if (browsingFolder.data.id) {
                    assets = await GetAssetsContainingTag({ tag: browsingFolder.data.id })
                        .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                }
                break
            case "uncategorized":
                assets = await GetAllUncategorizedAssets()
                    .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                break
        }

        if (assets) {
            if (selectedItems?.data) {
                console.log(selectedItems.data, assets)
                selectedItems.setter(selectedItems.data.filter(id => assets.includes(id.id)))
            }

            browsingFolder.setter({
                ...browsingFolder.data,
                content: assets.map(a => { return { id: a, ty: "asset" } }),
            })
        }
    }

    async function fetchAllTags() {
        const allTags = await GetAllTags()
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        if (allTags) {
            setAllTags(allTags)
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

    const available = allTags?.filter(tag => selected.find(t => t.id == tag.id) == undefined)

    return (
        <div className="flex flex-col gap-2 overflow-hidden">
            <TagGroup
                className="flex-wrap gap-1"
                onDismiss={(_, data) => update(allTags?.find(t => t.id == data.value), true)}
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
                                            onClick={() => update(tag, false)}
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
