import { useContext, useEffect, useState } from "react"
import { Button, FlatTree, FlatTreeItem, HeadlessFlatTreeItemProps, Input, makeStyles, Text, TreeItem, TreeItemLayout, useHeadlessFlatTree_unstable } from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";
import { Checkmark20Regular, Folder20Regular } from "@fluentui/react-icons";
import { Folder, GetFolderTree, GetRootFolderId } from "../backend";
import { browsingFolderContext, fileManipulationContext, selectedAssetsContext } from "../context-provider";
import { useContextMenu } from "react-contexify";
import { CtxMenuId } from "./context-menu";
import { DndContext, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

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

    const DraggableTreeItem = ({ flatTreeItem }: { flatTreeItem: any }) => {
        const { name, ...treeItemProps } = flatTreeItem.getTreeItemProps()
        const [disabled, setDisabled] = useState(true)
        const [newName, setNewName] = useState(name)
        const id = treeItemProps.value as string
        const editing = fileManipulation?.data?.ty != undefined && fileManipulation.data.id.includes(id)

        const { attributes, listeners, setNodeRef, transform, isDragging, ...rest } = useDraggable({ id, disabled })

        return (
            <FlatTreeItem
                {...treeItemProps}
                onClick={ev => {
                    setDisabled(true)
                    if (editing) {
                        ev.preventDefault()
                    }
                }}
                style={{
                    transform: CSS.Translate.toString(transform),
                    zIndex: isDragging && "10"
                }}
                ref={setNodeRef}
                {...listeners}
                {...attributes}
                {...rest}
            >
                <TreeItemLayout
                    iconBefore={<Folder20Regular />}
                    onClick={() => updateBrowsingFolder(id)}
                    onContextMenu={(e) => {
                        fileManipulation?.setter({
                            id: [id],
                            is_folder: true,
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
                                defaultValue={newName}
                                onChange={ev => setNewName(ev.target.value)}
                                autoFocus
                                onKeyDown={ev => {
                                    if (ev.key == "Enter") {
                                        if (fileManipulation.data) {
                                            fileManipulation.setter({
                                                ...fileManipulation.data,
                                                submit: newName,
                                            })
                                        }
                                    } else if (ev.key == "Escape") {
                                        fileManipulation.setter(undefined)
                                    }
                                }}
                            />
                            : <Text>
                                {name}
                            </Text>
                    }
                </TreeItemLayout>
            </FlatTreeItem>
        )
    }

    if (!folderTree) {
        return <></>
    }

    return (
        <DndContext>
            <FlatTree
                className="overflow-hidden"
                {...flatTree.getTreeProps()}
                aria-label="Folder Tree"
            >
                {
                    Array.from(flatTree.items(), (flatTreeItem, index) =>
                        <DraggableTreeItem key={index} flatTreeItem={flatTreeItem} />
                    )
                }
            </FlatTree>
        </DndContext>
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
