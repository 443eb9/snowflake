import { useContext, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { browsingFolderContext, contextMenuPropContext, fileManipulationContext, selectedItemsContext } from "../helpers/context-provider"
import { HeadlessFlatTreeItemProps, Input, makeStyles, Text, useToastController } from "@fluentui/react-components"
import { Collection, GetAllTags, GetAssetsContainingTag, GetCollectionTree, GetRootCollectionId, Tag } from "../backend"
import { GlobalToasterId } from "../main"
import ErrToast from "./toasts/err-toast"
import { SelectedClassTag } from "./items-grid"
import ItemTree from "../components/item-tree"
import { Collections20Regular, Tag20Regular } from "@fluentui/react-icons"
import { CollectionTagCtxMenuId } from "./context-menus/collection-tag-context-menu"

const inputStyleHook = makeStyles({
    root: {
        "width": "100px",
    }
})

type CollectionOrTag = {
    type: "collection",
} & Collection | {
    type: "tag",
} & Tag

type FlatTreeNode = HeadlessFlatTreeItemProps & { name: string }

export default function CollectionTree() {
    const nav = useNavigate()
    const [collectionOrTags, setCollectionOrTags] = useState<{ map: Map<string, CollectionOrTag>, root: string } | undefined>()

    const browsingFolder = useContext(browsingFolderContext)
    const selectedItems = useContext(selectedItemsContext)
    const fileManipulation = useContext(fileManipulationContext)
    const contextMenuProp = useContext(contextMenuPropContext)

    const inputStyle = inputStyleHook()

    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        async function fetch() {
            const allCollections = await GetCollectionTree()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            const allTags = await GetAllTags()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            const rootCollectionId = await GetRootCollectionId()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            if (allCollections && rootCollectionId && allTags) {
                let data = new Map<string, CollectionOrTag>()

                allCollections.forEach(collection => data.set(collection.id, { type: "collection", ...collection }))
                allTags.forEach(tag => data.set(tag.id, { type: "tag", ...tag }))
                console.log(allCollections, allTags)

                setCollectionOrTags({ map: new Map(data), root: rootCollectionId })
            } else {
                nav("/startup")
            }
        }

        if (fileManipulation?.data?.id.length == 1 && fileManipulation?.data?.id[0].ty == "folder") { return }

        fetch()
    }, [fileManipulation?.data])

    const updateBrowsingFolder = async (item: CollectionOrTag) => {
        if (item.id == browsingFolder?.data?.id) {
            return
        }

        if (item.type == "tag") {
            const assets = await GetAssetsContainingTag({ tag: item.id })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            if (!assets) { return }

            selectedItems?.setter([])
            document.querySelectorAll(`.${SelectedClassTag}`)
                .forEach(elem => elem.classList.remove(SelectedClassTag))
            browsingFolder?.setter({
                id: item.id,
                name: item.name,
                content: assets.map(a => { return { id: a, ty: "asset" } }),
                subTy: item.type,
            })
        }
    }

    const isEditing = (id: string) => {
        return fileManipulation?.data?.op != undefined
            && fileManipulation.data.id.find(i => i.id == id) != undefined
    }

    function CollectionNode({ node }: { node: FlatTreeNode }) {
        if (!fileManipulation) { return }

        const id = node.value as string

        return isEditing(id)
            ? <Input
                className={inputStyle.root}
                defaultValue={node.name}
                autoFocus
                onKeyDown={ev => {
                    if (ev.key == "Enter") {
                        if (fileManipulation.data) {
                            fileManipulation.setter({
                                ...fileManipulation.data,
                                submit: [ev.currentTarget.value],
                            })
                        }
                    } else if (ev.key == "Escape") {
                        fileManipulation.setter(undefined)
                    }
                }}
            />
            : <Text
                id={id}
            >
                {node.name}
            </Text>
    }

    if (!collectionOrTags) {
        return <></>
    }

    return (
        <ItemTree<{ name: string, type: "collection" | "tag" }, CollectionOrTag>
            rootItemId={collectionOrTags.root}
            itemTree={collectionOrTags.map}
            onItemClick={(_, item) => updateBrowsingFolder(item)}
            onItemContextMenu={(_, item) => {
                contextMenuProp?.setter({
                    extra: item.id,
                    target: item.type,
                })
                fileManipulation?.setter({
                    id: [{ id: item.id, ty: item.type }],
                    op: undefined,
                    submit: undefined,
                })
            }}
            isNodeExpandable={id => !isEditing(id)}
            renderItem={node => <CollectionNode node={node} />}
            itemToNode={item => {
                return {
                    value: item.id,
                    name: item.name,
                    parentValue: item.parent ?? undefined,
                    type: item.type,
                }
            }}
            itemChildrenIds={item => item.type == "collection" ? item.children.concat(item.content) : []}
            icon={item => {
                switch (item.type) {
                    case "collection":
                        return <Collections20Regular />
                    case "tag":
                        return <Tag20Regular />
                }
            }}
            relatedContextMenu={CollectionTagCtxMenuId}
        />
    )
}
