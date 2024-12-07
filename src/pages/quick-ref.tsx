import { Image } from "@fluentui/react-components"
import { convertFileSrc } from "@tauri-apps/api/core"
import { getCurrentWindow, PhysicalSize } from "@tauri-apps/api/window"
import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { GetAssetAbsPath } from "../backend"
import { useContextMenu } from "react-contexify"
import QuickRefContextMenu, { QuickRefCtxMenuId } from "../widgets/quick-ref-context-menu"

const appWindow = getCurrentWindow()

export default function QuickRef() {
    const { id } = useParams()
    const [absPath, setAbsPath] = useState<string | undefined>()
    const { show: showContextMenu } = useContextMenu({ id: QuickRefCtxMenuId })
    const [scaleFactor, setScaleFactor] = useState(1)

    useEffect(() => {
        async function fetch() {
            if (id) {
                // TODO not working, wait for next release
                const path = await GetAssetAbsPath({ asset: id })
                    .catch(err => {
                        // TODO error handling
                        console.error(err)
                    })
                if (path) {
                    setAbsPath(path)
                }
            }
        }

        fetch()
    }, [id])

    if (!absPath) {
        return <></>
    }

    return (
        <>
            <QuickRefContextMenu />
            <Image
                src={convertFileSrc(absPath)}
                className="w-full h-full"
                data-tauri-drag-region
                onClick={ev => {
                    if (ev.buttons == 1) {
                        appWindow.startDragging()
                    }
                }}
                onWheel={async ev => {
                    const size = await appWindow.innerSize()
                    const newScale = scaleFactor * (1 - ev.deltaY * 0.01 * 0.05)
                    setScaleFactor(newScale)

                    const scaled = {
                        width: Math.round(size.width * newScale),
                        height: Math.round(size.height * newScale),
                    }
                    console.log(scaled)
                    await appWindow.setSize(new PhysicalSize(scaled))
                        .catch(err => {
                            console.error(err)
                        })
                }}
                onContextMenu={ev => showContextMenu({ event: ev })}
            />
        </>
    )
}
