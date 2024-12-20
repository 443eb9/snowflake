import { useContext, useEffect, useState } from "react"
import { HeadlessFlatTreeItemProps, Input, makeStyles, Text, useToastController } from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";
import { Folder, GetFolderTree, GetRootFolderId } from "../backend";
import { browsingFolderContext, contextMenuPropContext, fileManipulationContext, selectedItemsContext } from "../helpers/context-provider";
import ErrToast from "./toasts/err-toast";
import { GlobalToasterId } from "../main";
import { SelectedClassTag } from "./items-grid";
import ItemTree from "../components/item-tree";
import { Folder20Regular } from "@fluentui/react-icons";
import { CtxMenuId } from "./context-menus/context-menu";

const inputStyleHook = makeStyles({
    root: {
        "width": "100px",
    }
})

type FlatTreeNode = HeadlessFlatTreeItemProps & { name: string }

export function FolderTree() {
    const nav = useNavigate()
    const [folderData, setFolderMap] = useState<{ map: Map<string, Folder>, root: string } | undefined>()

    const browsingFolder = useContext(browsingFolderContext)
    const selectedItems = useContext(selectedItemsContext)
    const fileManipulation = useContext(fileManipulationContext)
    const contextMenuProp = useContext(contextMenuPropContext)

    const inputStyle = inputStyleHook()

    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        async function fetch() {
            const map = await GetFolderTree()
            const rootFolderId = await GetRootFolderId()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            if (map && rootFolderId) {
                setFolderMap({ map, root: rootFolderId })
            } else {
                nav("/startup")
            }
        }

        if (fileManipulation?.data?.id.length == 1 && fileManipulation?.data?.id[0].ty == "folder") { return }

        fetch()
    }, [fileManipulation?.data])

    const updateBrowsingFolder = (folderId: string) => {
        if (folderId == browsingFolder?.data?.id) {
            return
        }

        const folder = folderData?.map.get(folderId)
        if (folder) {
            selectedItems?.setter([])
            document.querySelectorAll(`.${SelectedClassTag}`)
                .forEach(elem => elem.classList.remove(SelectedClassTag))
            browsingFolder?.setter({
                id: folderId,
                name: folder.name,
                content: folder.content.map(a => { return { id: a, ty: "asset" } }),
                subTy: "folder",
            })
        }
    }

    const isEditing = (id: string) => {
        return fileManipulation?.data?.op != undefined
            && fileManipulation.data.id.find(i => i.id == id) != undefined
    }

    function FolderNode({ node }: { node: FlatTreeNode }) {
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

    if (!folderData) {
        return <></>
    }

    return (
        <ItemTree<{ name: string }, Folder>
            rootItemId={folderData.root}
            itemTree={folderData.map}
            onItemClick={(_, folder) => updateBrowsingFolder(folder.id)}
            onItemContextMenu={(_, folder) => {
                contextMenuProp?.setter({
                    extra: folder.id,
                    target: "folder",
                })
                fileManipulation?.setter({
                    id: [{ id: folder.id, ty: "folder" }],
                    op: undefined,
                    submit: undefined,
                })
            }}
            isNodeExpandable={id => !isEditing(id)}
            renderItem={node => <FolderNode node={node} />}
            itemToNode={folder => {
                return {
                    value: folder.id,
                    name: folder.name,
                    parentValue: folder.parent ?? undefined,
                }
            }}
            itemChildrenIds={folder => folder.children}
            icon={() => <Folder20Regular />}
            relatedContextMenu={CtxMenuId}
        />
    )
}
