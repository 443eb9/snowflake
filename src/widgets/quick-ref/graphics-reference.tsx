import { Image, ImageProps } from "@fluentui/react-components"
import { convertFileSrc } from "@tauri-apps/api/core"
import { getCurrentWindow } from "@tauri-apps/api/window"

const appWindow = getCurrentWindow()

export default function GraphicsReference(props: ImageProps) {
    return (
        <Image
        />
    )
}
