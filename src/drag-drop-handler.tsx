import { Text } from "@fluentui/react-components"
import { listen, TauriEvent } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { useEffect, useState } from "react"

export function DragDropHandler() {
    const [hovering, setHovering] = useState(false)

    useEffect(() => {
        const unlisten = listen(TauriEvent.DRAG_DROP, ev => {
            console.log(ev.payload)
        })

        return () => {
            async function resolve() {
                // (await enter_unlisten)();
                // (await drop_unlisten)();
                // (await leave_unlisten)();
                (await unlisten)()
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
