import { useContext, useEffect, useState } from "react"
import { GetUserSettings, UserSettings } from "./backend"
import i18n from "./i18n"
import { refreshEntireUiContext } from "./context-provider"

export default function LanguageSwitch() {
    const [userSettings, setUserSettings] = useState<UserSettings | undefined>()
    const refreshEntireUi = useContext(refreshEntireUiContext)

    useEffect(() => {
        async function fetch() {
            const sets = await GetUserSettings()
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })
            if (sets) {
                setUserSettings(sets)
            }
        }

        fetch()
    }, [refreshEntireUi?.data])

    if (!userSettings) { return }

    i18n.changeLanguage((userSettings["general"]["lng"] as any)["selected"])

    return <></>
}
