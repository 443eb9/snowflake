import { Tag as FluentTag, TagGroup, Text, useToastController, Popover, PopoverTrigger, Button, PopoverSurface, makeStyles, mergeClasses, TabList, Tab } from "@fluentui/react-components";
import { useContext, useEffect, useState } from "react";
import { AddTagToAssets, Collection, GetAllTags, GetCollectionTree, GetItems, GetTagsOnAsset, GetTagsWithoutConflict, GetUserSetting, RemoveTagFromAssets, Tag } from "../backend";
import { browsingFolderContext, selectedItemsContext } from "../helpers/context-provider";
import { t } from "../i18n";
import ErrToast from "./toasts/err-toast";
import { GlobalToasterId } from "../main";
import FallbackableText from "../components/fallbackable-text";
import { Collections20Regular, Tag20Regular } from "@fluentui/react-icons";

const popoverStyleHook = makeStyles({
    root: {
        backgroundColor: "var(--colorNeutralBackground2)",
    }
})

export default function TagsContainer({
    associatedItem, tags, readonly,
}: {
    associatedItem?: string, tags: string[], readonly?: boolean
}) {
    const [curBrowsingGroup, setCurBrowsingGroup] = useState<string | undefined>()
    const [allCollections, setAllCollections] = useState<Map<string, Collection> | undefined>()
    const [available, setAvailable] = useState<Tag[] | undefined>()
    const [selected, setSelected] = useState<Tag[]>([])
    const [selectedIds, setSelectedIds] = useState(tags)

    const browsingFolder = useContext(browsingFolderContext)
    const selectedItems = useContext(selectedItemsContext)
    const popoverStyle = popoverStyleHook()
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

    async function fetchAvailableTags() {
        const hideConflict = await GetUserSetting({ category: "general", item: "hideConflictTagsWhenPickingNewTags" })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" })) as boolean | undefined
        if (hideConflict == undefined) { return }

        const available = await (hideConflict ? GetTagsWithoutConflict({ tags: selectedIds }) : GetAllTags())
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        if (available) {
            setAvailable(available)
        }
    }

    useEffect(() => {
        async function fetchTags() {
            const selected = await GetItems({ items: selectedIds.map(id => { return { id, ty: "tag" } }), filter: "all" })
                .then(data => data.map(item => item.data as Tag))
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            if (selected) {
                setSelected(selected)
            }
        }

        fetchAvailableTags()
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
        async function fetchAllCollections() {
            const allCollections = await GetCollectionTree({ noSpecial: false })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            if (allCollections) {
                setAllCollections(allCollections)
            }
        }

        fetchAllCollections()
        fetchAvailableTags()
    }, [])

    if (!available || !allCollections) {
        return <></>
    }

    const allGroups = new Set(available.map(tag => tag.group))
    const candidateTags = curBrowsingGroup ? available.filter(tag => tag.group == curBrowsingGroup) : available.filter(tag => tag.group == undefined)

    return (
        <div className="flex flex-col gap-2 overflow-hidden">
            <TagGroup
                className="flex-wrap gap-1"
                onDismiss={(_, data) => update(data.value, true)}
            >
                {
                    selected.length == 0
                        ? <FallbackableText fallback={t("tagsContainer.none")} />
                        : selected.map((tag, index) =>
                            <FluentTag
                                key={index}
                                dismissible={!readonly}
                                value={tag.id}
                                style={tag.color ? { color: `#${tag.color}` } : undefined}
                            >
                                {
                                    <FallbackableText fallback={t("tagName.unnamed")} text={tag.name} />
                                }
                            </FluentTag>
                        )
                }
            </TagGroup>

            {
                !readonly &&
                <Popover>
                    <PopoverTrigger>
                        <Button onClick={() => fetchAvailableTags()}>{t("tagsContainer.add")}</Button>
                    </PopoverTrigger>

                    <PopoverSurface className={mergeClasses("flex gap-4 max-h-96 h-96", popoverStyle.root)}>
                        <div
                            className="flex flex-col min-w-36 rounded-md p-2 gap-1 overflow-y-scroll"
                            style={{ backgroundColor: "var(--colorNeutralBackground1)" }}
                        >
                            <TabList
                                vertical
                                onTabSelect={(_, data) => setCurBrowsingGroup(data.value as string | undefined)}
                            >
                                <Tab value={undefined} icon={<Collections20Regular />}>
                                    <Text>
                                        {t("tagsContainer.ungrouped")}
                                    </Text>
                                </Tab>
                                {
                                    Array.from(allGroups, (group, index) => {
                                        if (group == undefined) { return <></> }

                                        const collection = allCollections.get(group)
                                        return (
                                            <Tab key={index} value={group} icon={<Collections20Regular />}>
                                                <FallbackableText
                                                    fallback={t("collectionName.unnamed")}
                                                    style={{
                                                        color: collection?.color ? `#${collection.color}` : undefined
                                                    }}
                                                    text={collection?.name}
                                                />
                                            </Tab>
                                        )
                                    })
                                }
                            </TabList>
                        </div>
                        <div
                            className="flex flex-col min-w-64 rounded-md p-2 gap-1 overflow-y-scroll"
                            style={{ backgroundColor: "var(--colorNeutralBackground1)" }}
                        >
                            {
                                candidateTags.length == 0
                                    ? <div className="flex items-center justify-center h-full">
                                        <FallbackableText fallback={t("tagsContainer.noAvailable")} italic className="opacity-50" />
                                    </div>
                                    : Array.from(candidateTags, (tag, index) =>
                                        <Button
                                            key={index}
                                            appearance="subtle"
                                            icon={<Tag20Regular />}
                                            style={{ justifyContent: "start" }}
                                            onClick={() => update(tag.id, false)}
                                        >
                                            <FallbackableText
                                                style={{
                                                    color: tag.color ? `#${tag.color}` : undefined
                                                }}
                                                text={tag.name}
                                                fallback={t("tagName.unnamed")}
                                            />
                                        </Button>
                                    )
                            }
                        </div>
                    </PopoverSurface>
                </Popover>
            }
        </div>
    )
}
