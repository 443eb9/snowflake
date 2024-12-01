import { Button, Image, Text } from "@fluentui/react-components";
import { main } from "../../wailsjs/go/models";

export default function AssetPreview({ asset, selectionCallback }: { asset: main.AssetRef, selectionCallback: (id: string) => void }) {
    return (
        <Button
            className="flex flex-col"
            appearance="subtle"
            onClick={() => selectionCallback(asset.meta.id)}
        >
            <div className="flex h-full items-center">
                <Image
                    className="max-w-48 max-h-48"
                    src={asset.src}
                    shape="rounded"
                    shadow
                />
            </div>
            <Text align="center" as="p">{asset.meta.name}</Text>
        </Button>
    )
}
