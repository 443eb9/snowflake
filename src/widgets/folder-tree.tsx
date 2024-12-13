import { useContext, useEffect, useState } from "react"
import { FlatTree, FlatTreeItem, HeadlessFlatTreeItemProps, Input, makeStyles, Text, TreeItemLayout, useHeadlessFlatTree_unstable, useToastController } from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";
import { Folder20Regular } from "@fluentui/react-icons";
import { Folder, GetFolderTree, GetRootFolderId } from "../backend";
import { browsingFolderContext, contextMenuPropContext, fileManipulationContext, selectedItemsContext } from "../helpers/context-provider";
import { useContextMenu } from "react-contexify";
import { CtxMenuId } from "./context-menus/context-menu";
import ErrToast from "./toasts/err-toast";
import { GlobalToasterId } from "../main";
import { SelectedClassTag } from "./items-grid";

const inputStyleHook = makeStyles({
    root: {
        "width": "100px",
    }
})

type FlatTreeNode = HeadlessFlatTreeItemProps & { name: string }

export function FolderTree() {
    const nav = useNavigate()
    const [folderTree, setFolderTree] = useState<FlatTreeNode[] | undefined>()
    const [folderMap, setFolderMap] = useState<Map<string, Folder> | undefined>()

    const browsingFolder = useContext(browsingFolderContext)
    const selectedItems = useContext(selectedItemsContext)
    const fileManipulation = useContext(fileManipulationContext)
    const contextMenuProp = useContext(contextMenuPropContext)

    const inputStyle = inputStyleHook()

    const [newName, setNewName] = useState("")
    const { show: showContextMenu } = useContextMenu({ id: CtxMenuId })
    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        async function fetch() {
            const map = await GetFolderTree()
            const rootFolderId = await GetRootFolderId()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            if (map && rootFolderId) {
                setFolderMap(map)
                setFolderTree(convertFolderTreeToFlatTree(rootFolderId, map))
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

        const folder = folderMap?.get(folderId)
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

    const flatTree = useHeadlessFlatTree_unstable(folderTree ?? [])

    if (!folderTree) {
        return <></>
    }

    return (
        <FlatTree
            className="overflow-hidden"
            {...flatTree.getTreeProps()}
            aria-label="Folder Tree"
        >
            {
                Array.from(flatTree.items(), (flatTreeItem, index) => {
                    const { name, ...treeItemProps } = flatTreeItem.getTreeItemProps()

                    const id = treeItemProps.value as string
                    const editing = fileManipulation?.data?.op != undefined && fileManipulation.data.id.includes({ id: id, ty: "folder" })

                    return (
                        <FlatTreeItem
                            id={id}
                            key={index}
                            {...treeItemProps}
                            onClick={ev => {
                                if (editing) {
                                    ev.preventDefault()
                                }
                            }}
                        >
                            <TreeItemLayout
                                id={id}
                                iconBefore={<Folder20Regular />}
                                onClick={() => updateBrowsingFolder(id)}
                                onContextMenu={(e) => {
                                    contextMenuProp?.setter({
                                        extra: id,
                                        target: "folder",
                                    })
                                    fileManipulation?.setter({
                                        id: [{ id, ty: "folder" }],
                                        op: undefined,
                                        submit: undefined,
                                    })
                                    showContextMenu({ event: e })
                                }}
                            >
                                {
                                    editing
                                        ? <Input
                                            className={inputStyle.root}
                                            defaultValue={name}
                                            onChange={ev => setNewName(ev.target.value)}
                                            autoFocus
                                            onKeyDown={ev => {
                                                if (ev.key == "Enter") {
                                                    if (fileManipulation.data) {
                                                        fileManipulation.setter({
                                                            ...fileManipulation.data,
                                                            submit: [newName],
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
                                            {name}
                                        </Text>
                                }
                            </TreeItemLayout>
                        </FlatTreeItem>
                    )
                })
            }
        </FlatTree>
    )
}

function convertFolderTreeToFlatTree(root: string, nodes: Map<string, Folder>) {
    let result = new Array<FlatTreeNode>()

    function collectTree(parent: string | undefined, node: string) {
        const folder = nodes.get(node) as Folder
        result.push({
            value: node,
            name: folder.name,
            parentValue: parent,
        })

        folder.children.forEach(child => collectTree(node, child))
    }

    collectTree(undefined, root)
    return result
}
