import { useEffect, useState } from "react"
import { FlatTree, HeadlessFlatTreeItemProps, TreeItem, TreeItemLayout, useHeadlessFlatTree_unstable } from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";
import { Folder20Regular } from "@fluentui/react-icons";
import { Folder, GetFolderTree, GetRootFolderId } from "../backend";

type FlatTreeNode = HeadlessFlatTreeItemProps & { name: string }

export function FolderTree({
    setBrowsingFolderCallback
}: {
    setBrowsingFolderCallback: (id: string) => void,
}
) {
    const nav = useNavigate()
    const [folderTree, setFolderTree] = useState<FlatTreeNode[] | undefined>()

    useEffect(() => {
        if (folderTree) { return }

        async function fetch() {
            const tree = await GetFolderTree()
            const rootFolderId = await GetRootFolderId()
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })

            if (tree && rootFolderId) {
                setFolderTree(convertFolderTreeToFlatTree(rootFolderId, tree))
            } else {
                nav("/startup")
            }
        }

        fetch()
    }, [])

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
                                onClick={() => {
                                    if (treeItemProps.itemType == "leaf") {
                                        setBrowsingFolderCallback(treeItemProps.value as string)
                                    }
                                }}
                            >
                                {name}
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
