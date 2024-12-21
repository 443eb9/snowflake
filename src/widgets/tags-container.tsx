import { Menu, MenuButton, MenuItem, MenuList, MenuPopover, MenuTrigger, Tag as FluentTag, TagGroup, Text, useToastController } from "@fluentui/react-components";
import { useContext, useEffect, useState } from "react";
import { AddTagToAssets, GetAllTags, GetTags, RemoveTagFromAssets, Tag } from "../backend";
import { browsingFolderContext, selectedItemsContext } from "../helpers/context-provider";
import TagName from "./tag-name";
import { t } from "../i18n";
import ErrToast from "./toasts/err-toast";
import { GlobalToasterId } from "../main";

export default function TagsContainer({
    associatedItem, tags, readonly
}: {
    associatedItem?: string, tags: string[], readonly?: boolean
}) {
    const [currentItem, setCurrentItem] = useState<string | null>()
    const [allTags, setAllTags] = useState<Tag[] | undefined>()
    const [selected, setSelected] = useState<Tag[]>([])
    const browsingFolder = useContext(browsingFolderContext)
    const selectedItems = useContext(selectedItemsContext)

    const { dispatchToast } = useToastController(GlobalToasterId)

    const update = async (tag: Tag | undefined, isDismiss: boolean) => {
        console.log(tag, allTags)
        if (!browsingFolder || !associatedItem || !tag) {
            return
        }

        const currentFolder = browsingFolder.data

        if ((currentFolder?.subTy == "uncategoriezed" && !isDismiss)
            || (isDismiss && tag.id == currentFolder?.id)) {
            browsingFolder.setter({
                ...currentFolder,
                content: currentFolder.content.filter(itemId => itemId.id != associatedItem)
            })
            selectedItems?.setter([])
            setSelected([...selected, tag])
        }

        if ((currentFolder?.subTy == "uncategoriezed" && isDismiss)
            || (!isDismiss && tag.id == currentFolder?.id)) {
            browsingFolder.setter({
                ...currentFolder,
                content: [...currentFolder.content, { id: associatedItem, ty: "asset" }],
            })
            setSelected(selected.filter(t => t.id == tag.id))
        }

        if (isDismiss) {
            await RemoveTagFromAssets({ assets: [associatedItem], tag: tag.id })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        } else {
            await AddTagToAssets({ assets: [associatedItem], tag: tag.id })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
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
            const selected = await GetTags({ tags: tags })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            if (selected) {
                setSelected(selected)
            }
        }

        if (associatedItem != currentItem) {
            setCurrentItem(associatedItem)
            fetchTags()
        }
        fetchAllTags()
    }, [associatedItem])

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
                                            style={{ color: `#${tag.color}` }}
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
