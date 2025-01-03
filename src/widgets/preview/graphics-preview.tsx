import { Image, ImageProps, useToastController } from "@fluentui/react-components";
import { Asset, GetAssetAbsPath } from "../../backend";
import { useEffect, useState } from "react";
import { GlobalToasterId } from "../../main";
import ErrToast from "../toasts/err-toast";
import { convertFileSrc } from "@tauri-apps/api/core";

export default function GraphicsPreview({ asset, ...props }: { asset: Asset } & ImageProps) {
    const [absPath, setAbsPath] = useState<string | undefined>()

    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        async function fetch() {
            const path = await GetAssetAbsPath({ asset: asset.id })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            if (path) {
                setAbsPath(path)
            }
        }

        fetch()
    }, [asset.id])

    if (!absPath) {
        return <></>
    }

    return (
        <Image
            {...props}
            src={convertFileSrc(absPath)}
            shape="rounded"
            shadow
        />
    )
}
