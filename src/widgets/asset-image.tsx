import { ImageProps } from "@fluentui/react-components";
import { Asset } from "../backend";
import GraphicsPreview from "./preview/graphics-preview";
import ModelPreview from "./preview/model-preview";

export default function AssetImage({ asset, ...props }: { asset: Asset } & ImageProps) {
    switch (asset.ty) {
        case "rasterGraphics":
        case "vectorGraphics":
            return <GraphicsPreview {...props} asset={asset} />
        case "gltfModel":
            return <ModelPreview {...props} asset={asset} />
    }
}
