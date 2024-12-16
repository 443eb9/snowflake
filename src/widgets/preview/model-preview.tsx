import { useEffect, useState } from "react";
import { Asset } from "../../backend";
import { Image, ImageProps, Text } from "@fluentui/react-components";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Cube48Regular } from "@fluentui/react-icons";
import { t } from "../../i18n";

export default function ModelPreview({ asset, ...props }: { asset: Asset } & ImageProps) {
    const [previewPath, setPreviewPath] = useState<string>()

    useEffect(() => {

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
