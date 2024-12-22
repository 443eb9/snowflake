import { useEffect, useState } from "react"

export type LayoutResizeDir = "horizontal" | "vertical"

export default function LayoutResizeBar({
    resizeDir, factor = 1, size, onResize, onStartResize, onEndResize, onCancelResize, defaultValue,
}: {
    resizeDir: LayoutResizeDir,
    factor?: number,
    size: string,
    defaultValue: number,
    onResize?: (val: number) => void,
    onStartResize?: (val: number) => void,
    onEndResize?: (val: number) => void,
    onCancelResize?: (val: number) => void,
}) {
    const [resizing, setResizing] = useState(false)
    const [initialPos, setInitialPos] = useState(0)

    function computeSize(ev: MouseEvent) {
        const curPos = resizeDir == "horizontal" ? ev.clientX : ev.clientY
        return (curPos - initialPos) * factor + defaultValue
    }

    useEffect(() => {
        const resizeHandler = (ev: MouseEvent) => {
            if (resizing) {
                onResize?.(computeSize(ev))
            }
        }

        const endResizeHandler = (ev: MouseEvent) => {
            if (ev.button == 0) {
                onEndResize?.(computeSize(ev))
                setResizing(false)
            }
        }

        const cancelResizeHandler = (ev: KeyboardEvent) => {
            if (ev.key == "Escape") {
                setResizing(false)
                onCancelResize?.(defaultValue)
            }
        }

        document.addEventListener("mousemove", resizeHandler)
        document.addEventListener("mouseup", endResizeHandler)
        document.addEventListener("keydown", cancelResizeHandler)

        return () => {
            document.removeEventListener("mousemove", resizeHandler)
            document.removeEventListener("mouseup", endResizeHandler)
            document.removeEventListener("keydown", cancelResizeHandler)
        }
    }, [resizing])

    return (
        <div
            className="hover:bg-[#000000cc]"
            style={{
                width: resizeDir == "horizontal" ? size : undefined,
                height: resizeDir == "vertical" ? size : undefined,
                cursor: resizeDir == "horizontal" ? "col-resize" : "row-resize",
                backgroundColor: resizing ? "#000000cc" : undefined,
            }}
            onMouseDown={ev => {
                if (ev.button == 0) {
                    setResizing(true)
                    setInitialPos(resizeDir == "horizontal" ? ev.clientX : ev.clientY)
                    onStartResize?.(defaultValue)
                }
            }}
        />
    )
}
