import { HotKeys, HotKeysProps } from "react-hotkeys";
import { GetUserSettings, SaveLibrary } from "../backend";
import { useToastController } from "@fluentui/react-components";
import { GlobalToasterId } from "../main";
import ErrToast from "../widgets/toasts/err-toast";
import { useContext, useEffect, useState } from "react";
import { fileManipulationContext, settingsChangeFlagContext, selectedItemsContext, overlaysContext } from "./context-provider";
import SuccessToast from "../widgets/toasts/success-toast";
import { t } from "../i18n";

export default function ShortcutKeyProvider(props: HotKeysProps) {
    const selectedItems = useContext(selectedItemsContext)
    const fileManipulation = useContext(fileManipulationContext)
    const settingsChangeFlag = useContext(settingsChangeFlagContext)
    const overlay = useContext(overlaysContext)

    const [keyMap, setKeyMap] = useState<{ [key: string]: string } | undefined>()
    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        async function fetch() {
            const sets = await GetUserSettings()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            if (sets) {
                const keyMap = sets["keyMapping"]
                keyMap["overlayClose"] = ["escape"]

                setKeyMap(Object.fromEntries(Object.entries(keyMap).map(([action, keys]) => [action, (keys as string[]).reduce((prev, key) => prev + "+" + key)])))
            }
        }

        fetch()
    }, [settingsChangeFlag?.data])

    const handlers = {
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
        overlayClose: () => {
            if (overlay?.data) {
                overlay.setter(undefined)
            }
        },
        globalSearch: () => {
            if (!overlay?.data) {
                overlay?.setter({
                    ty: "globalSearch",
                })
            }
        }
    }

    return (
        <HotKeys
            {...props}
            keyMap={keyMap}
            handlers={handlers}
            allowChanges
        >
            {props.children}
        </HotKeys>
    )
}
