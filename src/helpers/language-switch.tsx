import { useContext, useEffect } from "react"
import { GetUserSettings } from "../backend"
import i18n from "../i18n"
import { refreshEntireUiContext } from "./context-provider"
import ErrToast from "../widgets/err-toast"
import { useToastController } from "@fluentui/react-components"
import { GlobalToasterId } from "../main"

export default function LanguageSwitch() {
    const refreshEntireUi = useContext(refreshEntireUiContext)

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
    }, [refreshEntireUi?.data])

    return <></>
}
