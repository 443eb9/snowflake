import { useContext, useEffect, useState } from "react"
import { GetUserSettings, UserSettings } from "./backend"
import i18n from "./i18n"
import { refreshEntireUiContext } from "./context-provider"
import MsgToast from "./widgets/toast"
import { useToastController } from "@fluentui/react-components"
import { GlobalToasterId } from "./main"

export default function LanguageSwitch() {
    const [userSettings, setUserSettings] = useState<UserSettings | undefined>()
    const refreshEntireUi = useContext(refreshEntireUiContext)

    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        async function fetch() {
            const sets = await GetUserSettings()
                .catch(err => dispatchToast(<MsgToast title="Error" body={err} />, { intent: "error" }))
            if (sets) {
                setUserSettings(sets)
            }
        }

        fetch()
    }, [refreshEntireUi?.data])

    if (!userSettings) { return }

    i18n.changeLanguage((userSettings["general"]["lng"] as any)["selected"])
        .catch(err => {
            dispatchToast(<MsgToast title="Error" body={err} />)
        })

    return <></>
}
