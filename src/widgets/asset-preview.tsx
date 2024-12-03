import { Button, Image, Text } from "@fluentui/react-components";
import { Asset } from "../backend";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useContext, useEffect, useRef, useState } from "react";
import { selectedAssetsContext } from "../context-provider";

type ListeningState = {
    id: string,
    selectHandler: EventListenerOrEventListenerObject,
    deselectHandler: EventListenerOrEventListenerObject,
}

export default function AssetPreview({ asset }: { asset: Asset }) {
    const thisRef = useRef<HTMLButtonElement>(null)
    const selectedAsset = useContext(selectedAssetsContext)
    const [listeningState, setListeningState] = useState<ListeningState | undefined>()

    useEffect(() => {
        if (thisRef.current && listeningState?.id != asset.meta.id) {
            if (listeningState?.selectHandler) {
                thisRef.current.removeEventListener("selected", listeningState.selectHandler)
            }
            if (listeningState?.deselectHandler) {
                thisRef.current.removeEventListener("selected", listeningState.deselectHandler)
            }

            const newSelectHandler = () => {
                if (selectedAsset?.data) {
                    thisRef.current?.classList.add("selected-asset")
                    selectedAsset.data.add(asset.meta.id)
                    selectedAsset.setter(selectedAsset.data)
                }
            }

            const newDeselectHandler = () => {
                if (selectedAsset?.data) {
                    thisRef.current?.classList.remove("selected-asset")
                    selectedAsset.data.delete(asset.meta.id)
                    selectedAsset.setter(selectedAsset.data)
                }
            }

            thisRef.current.addEventListener("selected", newSelectHandler)
            thisRef.current.addEventListener("deselected", newDeselectHandler)

            setListeningState({
                id: asset.meta.id,
                selectHandler: newSelectHandler,
                deselectHandler: newDeselectHandler,
            })
        }
    }, [asset.meta.id])

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
