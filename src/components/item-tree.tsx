import { FlatTree, FlatTreeItem, HeadlessFlatTreeItemProps, Slot, TreeItemLayout, useHeadlessFlatTree_unstable, useToastController } from "@fluentui/react-components"
import { MenuId, useContextMenu } from "react-contexify"
import { MouseEvent, ReactNode } from "react"
import { GlobalToasterId } from "../main"
import ErrToast from "../widgets/toasts/err-toast"

type ItemTreeNode<T> = HeadlessFlatTreeItemProps & T

export default function ItemTree<T, I>(
    props: {
        rootItemId: string,
        itemTree: Map<string, I>,
        onItemClick: (ev: MouseEvent, id: I) => void,
        onItemContextMenu: (ev: MouseEvent, id: I) => void,
        renderNode: (item: I) => ReactNode,
        isNodeExpandable: (id: string) => boolean,
        itemToNode: (item: I) => ItemTreeNode<T>,
        itemChildrenIds: (item: I) => string[],
        icon: (item: T) => Slot<"div">,
        relatedContextMenu: MenuId,
        itemId: (item: I) => string,
    }
) {
    const { show: showContextMenu } = useContextMenu()
    const { dispatchToast } = useToastController(GlobalToasterId)

    const flatTree = useHeadlessFlatTree_unstable(convertItemTreeToFlatTree())

    function convertItemTreeToFlatTree() {
        let result = new Array<ItemTreeNode<T> & I>()

        function collectTree(id: string) {
            console.log(id)
            const item = props.itemTree.get(id) as I
            if (item == undefined) {
                dispatchToast(<ErrToast body="Broken tree." />, { intent: "error" })
                return
            }
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
                    const id = props.itemId(treeItemProps as I)

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
                                    props.renderNode(treeItemProps)
                                }
                            </TreeItemLayout>
                        </FlatTreeItem>
                    )
                })
            }
        </FlatTree>
    )
}
