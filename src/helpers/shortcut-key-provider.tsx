import { HotKeys, HotKeysProps } from "react-hotkeys";
import { GetUserSettings, SaveLibrary } from "../backend";
import { useToastController } from "@fluentui/react-components";
import { GlobalToasterId } from "../main";
import ErrToast from "../widgets/err-toast";
import { useContext, useEffect, useState } from "react";
import { browsingFolderContext, fileManipulationContext, selectedAssetsContext } from "./context-provider";
import SuccessToast from "../widgets/success-toast";
import { t } from "../i18n";


export default function ShortcutKeyProvider(props: HotKeysProps) {
    const selectedAssets = useContext(selectedAssetsContext)
    const browsingFolder = useContext(browsingFolderContext)
    const fileManipulation = useContext(fileManipulationContext)
    const [keyMap, setKeyMap] = useState<{ [key: string]: string } | undefined>()

    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        async function fetch() {
            const sets = await GetUserSettings()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            if (sets) {
                const keyMap = Object.entries(sets["keyMapping"])
                    .map(([action, keys], _) => {
                        const trigger = keys as string[]
                        let combined = ""
                        trigger.forEach((key, index) => {
                            combined += index == trigger.length - 1 ? key : (key + "+")
                        })
                        return [action, combined]
                    })

                setKeyMap(Object.fromEntries(keyMap))
            }
        }

        fetch()
    }, [])

    const Handlers = {
        save: async () => {
            await SaveLibrary()
                .then(() => dispatchToast(<SuccessToast body={t("toast.save.success")} />, { intent: "success" }))
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
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
            keyMap={keyMap}
            handlers={Handlers}
        >
            {props.children}
        </HotKeys>
    )
}
