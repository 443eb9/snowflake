import { Button, makeStyles } from "@fluentui/react-components";
import { Dismiss20Regular, FullScreenMaximize20Regular, FullScreenMinimize20Regular } from "@fluentui/react-icons";
import { Quit, WindowMinimise, WindowToggleMaximise } from "../../wailsjs/runtime";

const useCloseWindowStyles = makeStyles({
    root: {
        ":hover": {
            backgroundColor: "var(--colorPaletteRedBackground3)"
        },
    },
})

export default function WindowControls() {
    const closeWindow = useCloseWindowStyles()

    return (
        <div className="flex gap-1">
            <Button
                icon={<FullScreenMinimize20Regular />}
                onClick={() => {
                    WindowMinimise()
                }}
            >
            </Button>
            <Button
                icon={<FullScreenMaximize20Regular />}
                onClick={() => {
                    WindowToggleMaximise()
                }}
            ></Button>
            <Button
                className={closeWindow.root}
                icon={<Dismiss20Regular />}
                onClick={() => {
                    Quit()
                }}
            >
            </Button>
        </div>
    )
}
