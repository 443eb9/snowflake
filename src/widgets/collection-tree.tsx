import { useContext, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { browsingFolderContext, contextMenuPropContext, fileManipulationContext, selectedItemsContext } from "../helpers/context-provider"
// @ts-ignore not found TreeItemType, weird...
import { Button, FlatTree, FlatTreeItem, HeadlessFlatTreeItemProps, makeStyles, Text, TreeItemLayout, TreeItemType, TreeItemValue, useToastController } from "@fluentui/react-components"
import { Collection, GetAllAssets, GetAllTags, GetAllUncategorizedAssets, GetAssetsContainingTag, GetCollectionTree, GetSpecialCollections, SpecialCollections, Tag } from "../backend"
import { GlobalToasterId } from "../main"
import ErrToast from "./toasts/err-toast"
import { SelectedClassTag } from "./items-grid"
import { Collections20Regular, Tag20Regular } from "@fluentui/react-icons"
import { CollectionTagCtxMenuId } from "./context-menus/collection-tag-context-menu"
import { encodeId } from "../util"
import { t } from "../i18n"
import ResponsiveInput from "../components/responsive-input"
import FallbackableText from "../components/fallbackable-text"
import { useContextMenu } from "react-contexify"

const inputStyleHook = makeStyles({
    root: {
        "width": "100px",
    }
})

type CollectionOrTag = {
    ty: "collection",
} & Collection | {
    ty: "tag",
} & Tag

export default function CollectionTree() {
    const nav = useNavigate()
    const [treeContext, setTreeContext] = useState<{
        items: Map<string, CollectionOrTag>,
        spCollections: SpecialCollections,
    } | undefined>()
    const [updateFlag, setUpdateFlag] = useState(false)
    const openItems = useRef(new Set<TreeItemValue>())

    const browsingFolder = useContext(browsingFolderContext)
    const selectedItems = useContext(selectedItemsContext)
    const fileManipulation = useContext(fileManipulationContext)
    const contextMenuProp = useContext(contextMenuPropContext)

    const inputStyle = inputStyleHook()

    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        async function fetch() {
            const allCollections = await GetCollectionTree({ noSpecial: false })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            const allTags = await GetAllTags()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            const specialCollections = await GetSpecialCollections()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            if (allCollections && specialCollections && allTags) {
                let data = new Map<string, CollectionOrTag>()

                const root = allCollections.get(specialCollections.root) as Collection
                allCollections.set(root.id, {
                    ...root,
                    name: t("collection.root"),
                })
                allCollections.forEach(collection => data.set(collection.id, { ty: "collection", ...collection }))
                allTags.forEach(tag => data.set(tag.id, { ty: "tag", ...tag }))

                setTreeContext({
                    items: new Map(data),
                    spCollections: specialCollections,
                })
            } else {
                nav("/")
            }
        }

        if (fileManipulation?.data?.id.length == 1 && fileManipulation?.data?.id[0].ty == "collection") { return }

        fetch()
    }, [fileManipulation?.data])

    useEffect(() => {
        async function fetch() {
            if (!browsingFolder?.data?.id || !treeContext?.items) { return }

            let shouldUpdate = false
            let shouldOpen: string | null = browsingFolder.data.id
            while (shouldOpen && !openItems.current.has(shouldOpen)) {
                openItems.current.add(shouldOpen)
                const item = treeContext.items.get(shouldOpen)
                if (!item) { return }

                shouldOpen = item.parent
                shouldUpdate = true
            }

            if (shouldUpdate) {
                setUpdateFlag(!updateFlag)
            }
        }

        fetch()
    }, [browsingFolder?.data])

    const clearSelection = () => {
        selectedItems?.setter([])
        document.querySelectorAll(`.${SelectedClassTag}`)
            .forEach(elem => elem.classList.remove(SelectedClassTag))
    }

    const updateBrowsingFolder = async (item: CollectionOrTag) => {
        if (item.id == browsingFolder?.data?.id || !treeContext?.spCollections || item.ty != "tag") {
            return
        }

        let assets = await GetAssetsContainingTag({ tag: item.id })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        if (assets) {
            browsingFolder?.setter({
                id: item.id,
                name: item.name,
                content: assets.map(a => { return { id: a, ty: "asset" } }),
                subTy: "tag",
            })
            clearSelection()
        }
    }

    const isEditing = (id: string) => {
        return fileManipulation?.data?.id.find(i => i.id == id) != undefined
    }

    function CollectionNode({ item }: { item: CollectionOrTag }) {
        if (!fileManipulation) { return }

        return isEditing(item.id) && fileManipulation.data?.op == "rename"
            ? <ResponsiveInput
                className={inputStyle.root}
                defaultValue={item.name}
                autoFocus
                onConfirm={target => {
                    if (fileManipulation.data) {
                        fileManipulation.setter({
                            ...fileManipulation.data,
                            submit: [target.value],
                        })
                    }
                }}
                onCancel={() => {
                    if (fileManipulation.data) {
                        fileManipulation.setter(undefined)
                    }
                }}
            />
            : <FallbackableText
                id={encodeId(item.id, item.ty)}
                style={item.color ? { color: `#${item.color}` } : undefined}
                wrap={false}
                text={item.name}
                fallback={t(item.ty == "collection" ? "collectionName.unnamed" : "tagName.unnamed")}
            />
    }

    const ItemIcon = ({ item }: { item: CollectionOrTag }) => {
        switch (item.ty) {
            case "collection":
                return <Collections20Regular />
            case "tag":
                return <Tag20Regular />
        }
    }

    const ItemTree = () => {
        function convertItemTreeToFlatTree() {
            let result = new Array<HeadlessFlatTreeItemProps & { data: CollectionOrTag }>()
            if (!treeContext) { return result }

            function collectTree(id: string, depth: number) {
                const item = treeContext?.items.get(id)
                if (item == undefined) {
                    dispatchToast(<ErrToast body="Broken tree." />, { intent: "error" })
                    return
                }

                result.push({
                    value: item.id,
                    parentValue: item.parent ?? undefined,
                    itemType: item.ty == "collection" && (item.children.length != 0 || item.content.length != 0) ? "branch" : "leaf",
                    "aria-level": depth,
                    data: item,
                })

                if (openItems.current.has(item.id) && item.ty == "collection") {
                    item.children.forEach(child => collectTree(child, depth + 1))
                    item.content.forEach(child => collectTree(child, depth + 1))
                }
            }

            collectTree(treeContext.spCollections.root, 1)
            return result
        }

        const visibleNodes = convertItemTreeToFlatTree()
        const { show: showContextMenu } = useContextMenu({ id: CollectionTagCtxMenuId })

        return (
            <FlatTree
                className="flex flex-grow"
                aria-label="Collection Tree"
                openItems={openItems.current}
                onOpenChange={(_, data) => {
                    openItems.current = data.openItems
                    setUpdateFlag(!updateFlag)
                }}
            >
                {
                    visibleNodes.map((nodeItem, index) => {
                        const id = encodeId(nodeItem.data.id, nodeItem.data.ty)

                        return (
                            // @ts-ignore
                            <FlatTreeItem
                                {...nodeItem}
                                aria-posinset={index}
                                aria-setsize={visibleNodes.length}
                                id={id}
                                key={index}
                                onClick={ev => {
                                    if (isEditing(id)) {
                                        ev.preventDefault()
                                    }
                                }}
                            >
                                <TreeItemLayout
                                    id={id}
                                    iconBefore={<ItemIcon item={nodeItem.data} />}
                                    onClick={() => updateBrowsingFolder(nodeItem.data)}
                                    onContextMenu={ev => {
                                        contextMenuProp?.setter({
                                            ty: nodeItem.data.ty,
                                            data: [nodeItem.data.id],
                                        })
                                        showContextMenu({ event: ev })
                                    }}
                                >
                                    <CollectionNode item={nodeItem.data} />
                                </TreeItemLayout>
                            </FlatTreeItem>
                        )
                    })
                }
            </FlatTree>
        )
    }

    if (!treeContext) {
        return <></>
    }

    return (
        <div className="flex flex-col h-full">
            <Text className="mb-2" as="h3" size={200}>{t("browser.tagCollSectionTitle")}</Text>
            <div className="flex flex-col">
                <Button
                    appearance="subtle"
                    shape="square"
                    style={{
                        justifyContent: "start",
                    }}
                    onClick={async () => {
                        const allAssets = await GetAllAssets()
                            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                        if (allAssets) {
                            browsingFolder?.setter({
                                id: undefined,
                                name: t("collection.all"),
                                content: allAssets.map(a => { return { id: a, ty: "asset" } }),
                                subTy: "all",
                            })
                        }
                        clearSelection()
                    }}
                >
                    <Text>{t("collection.all")}</Text>
                </Button>
                <Button
                    appearance="subtle"
                    shape="square"
                    style={{
                        justifyContent: "start",
                    }}
                    onClick={async () => {
                        const allUncategorizedAssets = await GetAllUncategorizedAssets()
                            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                        if (allUncategorizedAssets) {
                            browsingFolder?.setter({
                                id: undefined,
                                name: t("collection.uncategorized"),
                                content: allUncategorizedAssets.map(a => { return { id: a, ty: "asset" } }),
                                subTy: "uncategorized",
                            })
                        }
                        clearSelection()
                    }}
                >
                    <Text>{t("collection.uncategorized")}</Text>
                </Button>
            </div>
            <div className="w-full h-full overflow-x-auto flex flex-grow">
                <ItemTree />
            </div>
        </div>
    )
}
