import { useContext, useEffect, useState } from "react"
import { Button, FlatTree, HeadlessFlatTreeItemProps, Input, makeStyles, Text, TreeItem, TreeItemLayout, useHeadlessFlatTree_unstable } from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";
import { Checkmark20Regular, Folder20Regular } from "@fluentui/react-icons";
import { Folder, GetFolderTree, GetRootFolderId } from "../backend";
import { browsingFolderContext, fileManipulationContext, selectedAssetsContext } from "../context-provider";
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
    const [newName, setNewName] = useState("")
    const browsingFolder = useContext(browsingFolderContext)
    const selectedAssets = useContext(selectedAssetsContext)
    const fileManipulation = useContext(fileManipulationContext)

    const inputStyle = inputStyleHook()

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

        if (fileManipulation && fileManipulation.data?.is_folder) { return }

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
                .forEach(elem => {
                    elem.dispatchEvent(new Event("deselect"))
                    elem.classList.remove("selected-asset")
                })
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
            {...flatTree.getTreeProps()}
            aria-label="Folder Tree"
        >
            {
                Array.from(flatTree.items(), (flatTreeItem, index) => {
                    const { name, ...treeItemProps } = flatTreeItem.getTreeItemProps()
                    const editing = fileManipulation?.data?.id == treeItemProps.value as string && fileManipulation.data.ty != undefined

                    return (
                        <TreeItem {...treeItemProps} key={index} onClick={ev => { if (editing) { ev.preventDefault() } }}>
                            <TreeItemLayout
                                iconBefore={<Folder20Regular />}
                                onClick={() => updateBrowsingFolder(treeItemProps.value as string)}
                                onContextMenu={(e) => {
                                    fileManipulation?.setter({
                                        id: treeItemProps.value as string,
                                        is_folder: true,
                                        ty: undefined,
                                        submit: undefined,
                                    })
                                    showContextMenu({ event: e })
                                }}
                            >
                                {
                                    editing
                                        ? <div className="flex gap-1">
                                            <Input
                                                className={inputStyle.root}
                                                onChange={ev => setNewName(ev.target.value)}
                                            />
                                            <Button
                                                icon={<Checkmark20Regular />}
                                                onClick={() => {
                                                    if (fileManipulation.data) {
                                                        fileManipulation.setter({
                                                            ...fileManipulation.data,
                                                            submit: newName,
                                                        })
                                                    }
                                                }}
                                            />
                                        </div>
                                        : <Text>
                                            {name}
                                        </Text>
                                }
                            </TreeItemLayout>
                        </TreeItem>
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