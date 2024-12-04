import { useContext, useEffect, useState } from "react"
import { FlatTree, HeadlessFlatTreeItemProps, Text, TreeItem, TreeItemLayout, useHeadlessFlatTree_unstable } from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";
import { Folder20Regular } from "@fluentui/react-icons";
import { Folder, GetFolderTree, GetRootFolderId } from "../backend";
import { browsingFolderContext, selectedAssetsContext } from "../context-provider";

type FlatTreeNode = HeadlessFlatTreeItemProps & { name: string }

export function FolderTree() {
    const nav = useNavigate()
    const [folderTree, setFolderTree] = useState<FlatTreeNode[] | undefined>()
    const [folderMap, setFolderMap] = useState<Map<string, Folder> | undefined>()
    const browsingFolder = useContext(browsingFolderContext)
    const selectedAssets = useContext(selectedAssetsContext)

    useEffect(() => {
        if (folderTree) { return }

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

        fetch()
    }, [])

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
                    return (
                        <TreeItem {...treeItemProps} key={index}>
                            <TreeItemLayout
                                iconBefore={<Folder20Regular />}
                                onClick={() => updateBrowsingFolder(treeItemProps.value as string)}
                            >
                                <Text>
                                    {name}
                                </Text>
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
