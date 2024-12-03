import { Button, Image, Text } from "@fluentui/react-components";
import { Asset } from "../backend";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useContext, useEffect, useRef, useState } from "react";
import { selectedAssetsContext } from "../context-provider";

type ListeningState = {
    id: string,
    controller: AbortController,
}

export default function AssetPreview({ asset }: { asset: Asset }) {
    const thisRef = useRef<HTMLButtonElement>(null)
    const selectedAssets = useContext(selectedAssetsContext)
    const [listeningState, setListeningState] = useState<ListeningState | undefined>()
    const newId = new String(asset.meta.id)

    useEffect(() => {
        if (thisRef.current) {
            console.log(`changed ${listeningState?.id} -> ${newId}`)

            console.log(listeningState?.controller.signal)
            const controller = new AbortController()

            thisRef.current.addEventListener("selected", () => {
                if (selectedAssets?.data) {
                    thisRef.current?.classList.add("selected-asset")
                    console.log(`added ${newId}`, asset.meta.id)
                    selectedAssets.data.add(asset.meta.id)
                    selectedAssets.setter(selectedAssets.data)
                }
            }, { signal: controller.signal })

            thisRef.current.addEventListener("deselected", () => {
                if (selectedAssets?.data) {
                    thisRef.current?.classList.remove("selected-asset")
                    selectedAssets.data.delete(asset.meta.id)
                    selectedAssets.setter(selectedAssets.data)
                }
            }, { signal: controller.signal })

            listeningState?.controller.abort("")

            setListeningState({
                id: asset.meta.id,
                controller,
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
