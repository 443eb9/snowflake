import { Menu as CtxMenu, Item as CtxItem, ItemParams } from "react-contexify";
import "../context.css"
import { Button, makeStyles } from "@fluentui/react-components";
import { Delete20Regular, Edit20Regular } from "@fluentui/react-icons";
import { useContext } from "react";
import { browsingFolderContext, fileManipulationContext, selectedAssetsContext } from "../context-provider";

export const CtxMenuId = "context-menu"

const buttonStyleHook = makeStyles({
    root: {
        "width": "100%",
        "justifyContent": "start",
    }
})

export default function ContextMenu() {
    const buttonStyle = buttonStyleHook()

    const browsingFolder = useContext(browsingFolderContext)
    const selectedAssets = useContext(selectedAssetsContext)
    const fileManipulation = useContext(fileManipulationContext)

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

    return (
        <CtxMenu id={CtxMenuId} theme="dark">
            <CtxItem onClick={handleDelete}>
                <Button
                    className={buttonStyle.root}
                    icon={<Delete20Regular />}
                    appearance="subtle"
                >
                    Delete
                </Button>
            </CtxItem>
            <CtxItem onClick={handleRename}>
                <Button
                    className={buttonStyle.root}
                    icon={<Edit20Regular />}
                    appearance="subtle"
                >
                    Rename
                </Button>
            </CtxItem>
        </CtxMenu>
    )
}
