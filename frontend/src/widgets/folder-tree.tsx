import { useEffect, useMemo, useState } from "react"
import { GetFolderTree } from "../../wailsjs/go/main/App"
import { main } from "../../wailsjs/go/models";
import { FlatTree, HeadlessFlatTreeItemProps, TreeItem, TreeItemLayout, TreeItemValue, useHeadlessFlatTree_unstable } from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";
import { Folder20Regular } from "@fluentui/react-icons";

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
            if (tree) {
                setFolderTree(convertFolderTreeToFlatTree(tree))
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

function convertFolderTreeToFlatTree(root: main.FolderTreeNode) {
    let result = new Array<FlatTreeNode>()

    function collectTree(node: main.FolderTreeNode, parent?: TreeItemValue) {
        result.push({
            value: node.meta.id,
            name: node.meta.name,
            parentValue: parent,
        })
        node.subFolders.forEach(subFolder => collectTree(subFolder, node.meta.id))
    }

    collectTree(root, undefined)
    return result
}
