import { HotKeys, HotKeysProps } from "react-hotkeys";
import { GetUserSettings, SaveLibrary } from "../backend";
import { useToastController } from "@fluentui/react-components";
import { GlobalToasterId } from "../main";
import ErrToast from "../widgets/err-toast";
import { useContext, useEffect, useState } from "react";
import { browsingFolderContext, fileManipulationContext, settingsChangeFlagContext, selectedObjectsContext } from "./context-provider";
import SuccessToast from "../widgets/success-toast";
import { t } from "../i18n";


export default function ShortcutKeyProvider(props: HotKeysProps) {
    const selectedObjects = useContext(selectedObjectsContext)
    const browsingFolder = useContext(browsingFolderContext)
    const fileManipulation = useContext(fileManipulationContext)
    const settingsChangeFlag = useContext(settingsChangeFlagContext)
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
    }, [settingsChangeFlag?.data])

    const Handlers = {
        save: async () => {
            await SaveLibrary()
                .then(() => dispatchToast(<SuccessToast body={t("toast.save.success")} />, { intent: "success" }))
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        },
        delete: () => {
            if (selectedObjects?.data) {
                fileManipulation?.setter({
                    id: selectedObjects.data,
                    op: "deletion",
                    submit: [],
                })
            }
        },
        rename: () => {
            if (selectedObjects?.data && selectedObjects.data.length == 1) {
                fileManipulation?.setter({
                    id: selectedObjects.data,
                    op: "rename",
                    submit: undefined,
                })
            }
        },
        newFolder: () => {
            if (browsingFolder?.data?.id && !browsingFolder.data.subTy) {
                fileManipulation?.setter({
                    id: [{ id: browsingFolder.data.id, ty: "folder" }],
                    op: "create",
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
            allowChanges
        >
            {props.children}
        </HotKeys>
    )
}
