import { Button, Image, Text } from "@fluentui/react-components";
import { Asset } from "../backend";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useContext, useEffect, useRef, useState } from "react";
import { selectedAssetsContext } from "../context-provider";

export default function AssetPreview({ asset }: { asset: Asset }) {
    const thisRef = useRef<HTMLButtonElement>(null)
    const [listenerAdded, setListenerAdded] = useState(false)
    const selectedAsset = useContext(selectedAssetsContext)

    useEffect(() => {
        if (thisRef.current && !listenerAdded) {
            setListenerAdded(true)
            thisRef.current.addEventListener("selected", () => {
                if (selectedAsset?.data) {
                    thisRef.current?.classList.add("selected-asset")
                    selectedAsset.data.add(asset.meta.id)
                    selectedAsset.setter(selectedAsset.data)
                }
            })

            thisRef.current.addEventListener("deselected", () => {
                if (selectedAsset?.data) {
                    thisRef.current?.classList.remove("selected-asset")
                    selectedAsset.data.delete(asset.meta.id)
                    selectedAsset.setter(selectedAsset.data)
                }
            })
        }
    }, [])

    return (
        <Button
            className="flex flex-col selectable-asset"
            appearance="subtle"
            ref={thisRef}
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
