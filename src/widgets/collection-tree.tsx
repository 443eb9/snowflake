import { useContext, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { browsingFolderContext, contextMenuPropContext, fileManipulationContext, selectedItemsContext } from "../helpers/context-provider"
import { Button, makeStyles, Text, useToastController } from "@fluentui/react-components"
import { Collection, GetAllAssets, GetAllTags, GetAllUncategorizedAssets, GetAssetsContainingTag, GetCollectionTree, GetSpecialCollections, SpecialCollections, Tag } from "../backend"
import { GlobalToasterId } from "../main"
import ErrToast from "./toasts/err-toast"
import { SelectedClassTag } from "./items-grid"
import ItemTree from "../components/item-tree"
import { Collections20Regular, Tag20Regular } from "@fluentui/react-icons"
import { CollectionTagCtxMenuId } from "./context-menus/collection-tag-context-menu"
import { encodeId } from "../util"
import { t } from "../i18n"
import ResponsiveInput from "../components/responsive-input"

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
            : <Text
                id={encodeId(item.id, item.ty)}
                style={item.color ? { color: `#${item.color}` } : undefined}
                wrap={false}
            >
                {item.name}
            </Text>
    }

    if (!treeContext) {
        return <></>
    }

    return (
        <div className="flex flex-col h-full">
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
                <ItemTree<{ name: string, type: "collection" | "tag" }, CollectionOrTag>
                    rootItemId={treeContext.spCollections.root}
                    itemTree={treeContext.items}
                    onItemClick={(_, item) => updateBrowsingFolder(item)}
                    onItemContextMenu={(_, item) => contextMenuProp?.setter(item)}
                    isNodeExpandable={id => !isEditing(id)}
                    renderNode={item => <CollectionNode item={item} />}
                    itemToNode={item => {
                        return {
                            value: item.id,
                            name: item.name,
                            parentValue: item.parent ?? undefined,
                            type: item.ty,
                        }
                    }}
                    itemChildrenIds={item => item.ty == "collection" ? item.children.concat(item.content) : []}
                    icon={item => {
                        switch (item.type) {
                            case "collection":
                                return <Collections20Regular />
                            case "tag":
                                return <Tag20Regular />
                        }
                    }}
                    relatedContextMenu={CollectionTagCtxMenuId}
                    itemId={item => encodeId(item.id, item.ty)}
                    className="flex flex-grow"
                />
            </div>
        </div>
    )
}
