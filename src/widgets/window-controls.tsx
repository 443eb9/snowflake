import { Button, makeStyles } from "@fluentui/react-components";
import { Dismiss20Regular, FullScreenMaximize20Regular, FullScreenMinimize20Regular } from "@fluentui/react-icons";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { HTMLAttributes } from "react";

const useCloseWindowStyles = makeStyles({
    root: {
        ":hover": {
            backgroundColor: "var(--colorPaletteRedBackground3)"
        },
    },
})

const appWindow = getCurrentWindow()

export default function WindowControls(props: HTMLAttributes<HTMLDivElement>) {
    const closeWindow = useCloseWindowStyles()

    return (
        <div
            className={`flex gap-1 w-full justify-end ${props.className}`}
            data-tauri-drag-region
            onClick={ev => {
                if (ev.buttons == 1) {
                    ev.detail == 2
                        ? appWindow.toggleMaximize()
                        : appWindow.startDragging()
                }
            }}
        >
            <Button
                icon={<FullScreenMinimize20Regular />}
                onClick={() => appWindow.minimize()}
                appearance="outline"
            >
            </Button>
            <Button
                icon={<FullScreenMaximize20Regular />}
                onClick={() => appWindow.toggleMaximize()}
                appearance="outline"
            ></Button>
            <Button
                className={closeWindow.root}
                icon={<Dismiss20Regular />}
                onClick={() => appWindow.close()}
                appearance="outline"
            >
            </Button>
        </div>
    )
}
