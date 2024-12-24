import { ImageProps } from "@fluentui/react-components";
import { Item } from "../backend";
import GraphicsPreview from "./preview/graphics-preview";
import ModelPreview from "./preview/model-preview";
import CollectionPreview from "./preview/collection-preview";
import TagPreview from "./preview/tag-preview";

export default function ItemImage({ item, ...props }: { item: Item } & ImageProps) {
    switch (item.ty) {
        case "asset":
            switch (item.data.ty) {
                case "rasterGraphics":
                case "vectorGraphics":
                    return <GraphicsPreview {...props} asset={item.data} />
                case "gltfModel":
                    return <ModelPreview {...props} asset={item.data} />
            }
        case "collection":
            return <CollectionPreview />
        case "tag":
            return <TagPreview />
    }
}
