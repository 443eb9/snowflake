import { useContext, useEffect } from "react";
import { settingsChangeFlagContext } from "./context-provider";
import { GetUserSetting, SetWindowTransparency, WindowTransparency } from "../backend";
import { useToastController } from "@fluentui/react-components";
import { GlobalToasterId } from "../main";
import ErrToast from "../widgets/toasts/err-toast";

export default function WindowTransparencyManager() {
    const settingsChangeFlag = useContext(settingsChangeFlagContext)
    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        async function fetch() {
            const transparency = await GetUserSetting({ category: "appearance", item: "transparency" })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            const transparencyColor = await GetUserSetting({ category: "appearance", item: "transparencyColor" })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            if (transparency && transparencyColor) {
                document.querySelector("html")!.style.backgroundColor = ""
                const provider = document.querySelector(".fui-FluentProvider") as HTMLDivElement
                const ty = transparency as WindowTransparency
                switch (ty) {
                    case "none":
                        provider.style.backgroundColor = ""
                        break
                    case "blur":
                    case "acrylic":
                    case "mica":
                    case "tabbed":
                    case "vibrancy":
                        provider.style.backgroundColor = "transparent"
                }

                const newColor = transparencyColor as [number, number, number, number]
                await SetWindowTransparency({
                    newTransparency: transparency as WindowTransparency,
                    newColor
                })

                document.querySelector("body")!.style.backgroundColor = `rgba(${newColor[0]}, ${newColor[1]}, ${newColor[2]}, ${newColor[3]})`
            }
        }

        fetch()
    }, [settingsChangeFlag?.data])

    return <></>
}
