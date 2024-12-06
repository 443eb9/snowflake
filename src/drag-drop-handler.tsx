import { Text } from "@fluentui/react-components"
import { TauriEvent } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { useEffect, useState } from "react"

const appWindow = getCurrentWindow()

export function DragDropHandler() {
    const [hovering, setHovering] = useState(false)

    useEffect(() => {
        // const unlistener = appWindow.onDragDropEvent(ev => {
        //     if (ev.payload.type == "enter") {
        //         console.log(ev)
        //     }
        // })

        const enter_unlisten = appWindow.listen(TauriEvent.DRAG_ENTER, () => {
            setHovering(true)
        })

        const leave_unlisten = appWindow.listen(TauriEvent.DRAG_LEAVE, () => {
            setHovering(false)
        })

        const drop_unlisten = appWindow.listen(TauriEvent.DRAG_DROP, () => {
            setHovering(false)
        })

        return () => {
            async function resolve() {
                (await enter_unlisten)();
                (await drop_unlisten)();
                (await leave_unlisten)();
            }
            resolve()
        }
    }, [])

    if (!hovering) {
        return <></>
    }

    return (
        <div
            className="absolute w-full h-full flex justify-center items-center"
            style={{ backgroundColor: "#00000080" }}
        >
            <Text size={1000} weight="bold" className="opacity-50">Release to drop.</Text>
        </div>
    )
}
