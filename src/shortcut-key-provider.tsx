import { HotKeys, HotKeysProps } from "react-hotkeys";
import { SaveLibrary } from "./backend";
import { useToastController } from "@fluentui/react-components";
import { GlobalToasterId } from "./main";
import MsgToast from "./widgets/toast";
import { useContext } from "react";
import { browsingFolderContext, fileManipulationContext, selectedAssetsContext } from "./context-provider";


export default function ShortcutKeyProvider(props: HotKeysProps) {
    const selectedAssets = useContext(selectedAssetsContext)
    const browsingFolder = useContext(browsingFolderContext)
    const fileManipulation = useContext(fileManipulationContext)

    const { dispatchToast } = useToastController(GlobalToasterId)

    const KeyMap = {
        save: "ctrl+s",
        delete: "del",
        rename: "f2",
        newFolder: "ctrl+shift+n",
    }

    const Handlers = {
        save: async () => {
            await SaveLibrary()
                .catch(err => dispatchToast(<MsgToast title="Error" body={err} />))
        },
        delete: () => {
            if (selectedAssets?.data) {
                fileManipulation?.setter({
                    id: selectedAssets.data,
                    id_ty: "assets",
                    ty: "deletion",
                    submit: [],
                })
            }
        },
        rename: () => {
            if (selectedAssets?.data && selectedAssets.data.length == 1) {
                fileManipulation?.setter({
                    id: selectedAssets.data,
                    ty: "rename",
                    id_ty: "assets",
                    submit: undefined,
                })
            }
        },
        newFolder: () => {
            if (browsingFolder?.data?.id && !browsingFolder.data.collection) {
                fileManipulation?.setter({
                    id: [browsingFolder.data.id],
                    ty: "create",
                    id_ty: "folder",
                    submit: ["New Folder"],
                })
            }
        }
    }

    return (
        <HotKeys
            {...props}
            keyMap={KeyMap}
            handlers={Handlers}
        >
            {props.children}
        </HotKeys>
    )
}
