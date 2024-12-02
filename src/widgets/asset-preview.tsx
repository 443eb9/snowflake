import { Button, Image, Text } from "@fluentui/react-components";
import { Asset } from "../backend";
import { convertFileSrc } from "@tauri-apps/api/core";

export default function AssetPreview({ asset, selectionCallback }: { asset: Asset, selectionCallback: (id: string) => void }) {
    return (
        <Button
            className="flex flex-col"
            appearance="subtle"
            onClick={() => selectionCallback(asset.meta.id)}
        >
            <div className="flex h-full items-center">
                <Image
                    className="max-w-48 max-h-48"
                    src={convertFileSrc(asset.path)}
                    shape="rounded"
                    shadow
                />
            </div>
            <Text align="center" as="p">{asset.name}</Text>
        </Button>
    )
}
