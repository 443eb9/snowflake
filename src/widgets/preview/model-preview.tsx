import { useEffect, useState } from "react";
import { Asset, GetRenderResult } from "../../backend";
import { Image, ImageProps, Text, useToastController } from "@fluentui/react-components";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Cube48Regular } from "@fluentui/react-icons";
import { t } from "../../i18n";
import { GlobalToasterId } from "../../main";
import ErrToast from "../toasts/err-toast";

export default function ModelPreview({ asset, ...props }: { asset: Asset } & ImageProps) {
    const [previewPath, setPreviewPath] = useState<string>()
    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        async function fetch() {
            const previewPath = await GetRenderResult({ asset: asset.id })
                .catch(err => dispatchToast(<ErrToast body={err} />))
            if (previewPath) {
                setPreviewPath(previewPath)
            }
        }

        fetch()
    }, [])

    if (!previewPath) {
        return (
            <div className="flex flex-col items-center">
                <Cube48Regular />
                <Text italic>{t("assetPreview.renderingFallback")}</Text>
            </div>
        )
    }

    return (
        <Image
            {...props}
            src={convertFileSrc(previewPath)}
        />
    )
}
