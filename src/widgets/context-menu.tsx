import { Menu as CtxMenu, Item as CtxItem } from "react-contexify";
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

    const handleDelete = () => {
        if (selectedAssets?.data?.length == 1 && browsingFolder && selectedAssets && fileManipulation) {
            fileManipulation.setter({
                id: selectedAssets.data,
                is_folder: false,
                ty: "deletion",
                submit: "",
            })
        }
    }

    const handleRename = () => {
        if (selectedAssets?.data?.length == 1 && browsingFolder && selectedAssets && fileManipulation) {
            fileManipulation.setter({
                id: selectedAssets.data,
                is_folder: false,
                ty: "rename",
                submit: undefined,
            })
        }

        if (fileManipulation?.data?.is_folder) {
            fileManipulation.setter({
                ...fileManipulation.data,
                ty: "rename",
            })
        }
    }

    return (
        <CtxMenu id={CtxMenuId} className="ctx-menu" theme="dark">
            <CtxItem>
                <Button
                    className={buttonStyle.root}
                    icon={<Delete20Regular />}
                    appearance="subtle"
                    onClick={handleDelete}
                >
                    Delete
                </Button>
            </CtxItem>
            <CtxItem>
                <Button
                    className={buttonStyle.root}
                    icon={<Edit20Regular />}
                    appearance="subtle"
                    onClick={handleRename}
                >
                    Rename
                </Button>
            </CtxItem>
        </CtxMenu>
    )
}
