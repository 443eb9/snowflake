import { FlatTree, FlatTreeItem, HeadlessFlatTreeItemProps, Slot, TreeItemLayout, useHeadlessFlatTree_unstable } from "@fluentui/react-components"
import { MenuId, useContextMenu } from "react-contexify"
import { MouseEvent, ReactNode } from "react"

type ItemTreeNode<T> = HeadlessFlatTreeItemProps & T

export default function ItemTree<T, I>(
    props: {
        rootItemId: string,
        itemTree: Map<string, I>,
        onItemClick: (ev: MouseEvent, id: I) => void,
        onItemContextMenu: (ev: MouseEvent, id: I) => void,
        renderItem: (node: ItemTreeNode<T>) => ReactNode,
        isNodeExpandable: (id: string) => boolean,
        itemToNode: (item: I) => ItemTreeNode<T>,
        itemChildrenIds: (item: I) => string[],
        icon: (item: T) => Slot<"div">,
        relatedContextMenu: MenuId,
    }
) {
    const { show: showContextMenu } = useContextMenu()

    const flatTree = useHeadlessFlatTree_unstable(convertItemTreeToFlatTree())

    function convertItemTreeToFlatTree() {
        let result = new Array<ItemTreeNode<T> & I>()

        function collectTree(id: string) {
            const item = props.itemTree.get(id) as I
            result.push({ ...props.itemToNode(item), ...item })
            props.itemChildrenIds(item).forEach(child => collectTree(child))
        }

        collectTree(props.rootItemId)
        return result
    }

    return (
        <FlatTree
            {...flatTree.getTreeProps()}
            className="overflow-hidden"
            aria-label="Item Tree"
        >
            {
                Array.from(flatTree.items(), (flatTreeItem, index) => {
                    const treeItemProps = flatTreeItem.getTreeItemProps()
                    const id = treeItemProps.value as string

                    return (
                        // @ts-ignore
                        <FlatTreeItem
                            {...treeItemProps}
                            itemType={treeItemProps.itemType!}
                            id={id}
                            key={index}
                            onClick={ev => {
                                if (!props.isNodeExpandable(id)) {
                                    ev.preventDefault()
                                }
                            }}
                        >
                            <TreeItemLayout
                                id={id}
                                iconBefore={props.icon(treeItemProps as T)}
                                onClick={ev => props.onItemClick(ev, treeItemProps as I)}
                                onContextMenu={ev => {
                                    props.onItemContextMenu(ev, treeItemProps as I)
                                    showContextMenu({ event: ev, id: props.relatedContextMenu })
                                }}
                            >
                                {
                                    props.renderItem(treeItemProps)
                                }
                            </TreeItemLayout>
                        </FlatTreeItem>
                    )
                })
            }
        </FlatTree>
    )
}
