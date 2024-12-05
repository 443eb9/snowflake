import { Menu as CtxMenu, Item as CtxItem, ItemParams } from "react-contexify";
import "../context.css"
import { Text } from "@fluentui/react-components";
import { Delete20Regular, Edit20Regular } from "@fluentui/react-icons";
import { useContext } from "react";
import { browsingFolderContext, contextMenuPropContext, fileManipulationContext, selectedAssetsContext } from "../context-provider";

export const CtxMenuId = "context-menu"

export default function ContextMenu() {
    const browsingFolder = useContext(browsingFolderContext)
    const selectedAssets = useContext(selectedAssetsContext)
    const fileManipulation = useContext(fileManipulationContext)
    const contextMenuProp = useContext(contextMenuPropContext)

    const handleDelete = (ev: ItemParams) => {
        const folderId = (ev.triggerEvent.target as HTMLElement).id
        if (folderId.length > 0) {
            fileManipulation?.setter({
                id: [folderId],
                is_folder: true,
                ty: "deletion",
                submit: [],
            })
        } else if (selectedAssets?.data && browsingFolder && selectedAssets && fileManipulation) {
            fileManipulation.setter({
                id: selectedAssets.data,
                is_folder: false,
                ty: "deletion",
                submit: [],
            })
        }
    }

    const handleRename = () => {
        if (fileManipulation?.data?.is_folder) {
            fileManipulation.setter({
                ...fileManipulation.data,
                ty: "rename",
            })
        }

        if (selectedAssets?.data?.length == 1 && browsingFolder && selectedAssets && fileManipulation) {
            fileManipulation.setter({
                id: selectedAssets.data,
                is_folder: false,
                ty: "rename",
                submit: undefined,
            })
        }
    }

    const multipleSelected = contextMenuProp?.data?.target == "assets" &&
        selectedAssets?.data?.length != undefined && selectedAssets.data.length > 1

    return (
        <CtxMenu id={CtxMenuId} theme="dark">
            <CtxItem onClick={handleDelete}>
                <div className="flex gap-2 items-center">
                    <Delete20Regular />
                    <Text>Delete</Text>
                </div>
            </CtxItem>
            <CtxItem onClick={handleRename} disabled={multipleSelected}>
                <div className="flex gap-2 items-center">
                    <Edit20Regular />
                    <Text>Rename</Text>
                </div>
            </CtxItem>
        </CtxMenu>
    )
}
