import { HotKeys, HotKeysProps } from "react-hotkeys";
import { GetUserSettings, SaveLibrary } from "../backend";
import { useToastController } from "@fluentui/react-components";
import { GlobalToasterId } from "../main";
import ErrToast from "../widgets/toasts/err-toast";
import { useContext, useEffect, useState } from "react";
import { fileManipulationContext, settingsChangeFlagContext, selectedItemsContext } from "./context-provider";
import SuccessToast from "../widgets/toasts/success-toast";
import { t } from "../i18n";


export default function ShortcutKeyProvider(props: HotKeysProps) {
    const selectedItems = useContext(selectedItemsContext)
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
            if (selectedItems?.data) {
                fileManipulation?.setter({
                    id: selectedItems.data,
                    op: "deletion",
                    submit: [],
                })
            }
        },
        rename: () => {
            if (selectedItems?.data && selectedItems.data.length == 1) {
                fileManipulation?.setter({
                    id: selectedItems.data,
                    op: "rename",
                    submit: undefined,
                })
            }
        },
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
