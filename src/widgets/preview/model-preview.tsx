import { useEffect, useState } from "react";
import { Asset, GetRenderCache } from "../../backend";
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
            const cache = await GetRenderCache({ asset: asset.id })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            if (cache) {
                setPreviewPath(cache.path)
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
