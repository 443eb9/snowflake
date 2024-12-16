import { useContext, useEffect } from "react"
import { GetUserSettings } from "../backend"
import i18n from "../i18n"
import { settingsChangeFlagContext } from "./context-provider"
import ErrToast from "../widgets/toasts/err-toast"
import { useToastController } from "@fluentui/react-components"
import { GlobalToasterId } from "../main"

export default function LanguageSwitch() {
    const settingsChangeFlag = useContext(settingsChangeFlagContext)

    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        async function fetch() {
            const userSettings = await GetUserSettings()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            if (userSettings) {
                i18n.changeLanguage((userSettings["general"]["lng"] as any)["selected"])
                    .catch(err => {
                        dispatchToast(<ErrToast body={err} />)
                    })
            }
        }

        fetch()
    }, [settingsChangeFlag?.data])

    return <></>
}
