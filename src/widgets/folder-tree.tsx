import { useContext, useEffect, useState } from "react"
import { FlatTree, FlatTreeItem, HeadlessFlatTreeItemProps, Input, makeStyles, Text, TreeItemLayout, useHeadlessFlatTree_unstable } from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";
import { Folder20Regular } from "@fluentui/react-icons";
import { Folder, GetFolderTree, GetRootFolderId } from "../backend";
import { browsingFolderContext, contextMenuPropContext, fileManipulationContext, selectedAssetsContext } from "../context-provider";
import { useContextMenu } from "react-contexify";
import { CtxMenuId } from "./context-menu";

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
    const selectedAssets = useContext(selectedAssetsContext)
    const fileManipulation = useContext(fileManipulationContext)
    const contextMenuProp = useContext(contextMenuPropContext)

    const inputStyle = inputStyleHook()

    const [newName, setNewName] = useState("")
    const { show: showContextMenu } = useContextMenu({ id: CtxMenuId })

    useEffect(() => {
        async function fetch() {
            const map = await GetFolderTree()
            const rootFolderId = await GetRootFolderId()
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })

            if (map && rootFolderId) {
                setFolderMap(map)
                setFolderTree(convertFolderTreeToFlatTree(rootFolderId, map))
            } else {
                nav("/startup")
            }
        }

        if (fileManipulation && fileManipulation.data?.id_ty == "folder") { return }

        fetch()
    }, [fileManipulation?.data])

    const updateBrowsingFolder = (folderId: string) => {
        if (folderId == browsingFolder?.data?.id) {
            return
        }

        const folder = folderMap?.get(folderId)
        if (folder) {
            selectedAssets?.setter([])
            document.querySelectorAll(".selected-asset")
                .forEach(elem => elem.classList.remove("selected-asset"))
            browsingFolder?.setter({
                id: folderId,
                name: folder.name,
                content: folder.content,
                collection: false,
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
                    const editing = fileManipulation?.data?.ty != undefined && fileManipulation.data.id.includes(id)

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
                                        id: [id],
                                        id_ty: "folder",
                                        ty: undefined,
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
