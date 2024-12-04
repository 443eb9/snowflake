import { Button, Image, Text } from "@fluentui/react-components";
import { AbsolutizePath, Asset } from "../backend";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useContext, useEffect, useRef, useState } from "react";
import { selectedAssetsContext, selectedAssetsCountContext } from "../context-provider";

export default function AssetPreview({ asset }: { asset: Asset }) {
    const thisRef = useRef<HTMLButtonElement>(null)
    const selectedAssets = useContext(selectedAssetsContext)
    const selectedAssetsCount = useContext(selectedAssetsCountContext)
    const [absPath, setAbsPath] = useState<string | undefined>()

    useEffect(() => {
        if (thisRef.current) {
            const selectedHandler = () => {
                if (selectedAssets?.data) {
                    thisRef.current?.classList.add("selected-asset")
                    selectedAssets.data.add(asset.relative_path)
                    selectedAssets.setter(selectedAssets.data)
                    selectedAssetsCount?.setter(selectedAssets.data.size)
                }
            }

            const deselectHandler = () => {
                if (selectedAssets?.data) {
                    thisRef.current?.classList.remove("selected-asset")
                    selectedAssets.data.delete(asset.relative_path)
                    selectedAssets.setter(selectedAssets.data)
                    selectedAssetsCount?.setter(selectedAssets.data.size)
                }
            }

            thisRef.current.addEventListener("selected", selectedHandler)
            thisRef.current.addEventListener("deselected", deselectHandler)

            return () => {
                thisRef.current?.removeEventListener("selected", selectedHandler)
                thisRef.current?.removeEventListener("deselected", deselectHandler)
            }
        }
    }, [asset.relative_path])

    useEffect(() => {
        async function fetch() {
            const p = await AbsolutizePath({ path: asset.relative_path })
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })
            if (p) {
                setAbsPath(p)
            }
        }

        fetch()
    }, [asset.relative_path])

    if (!absPath) {
        return
    }

    return (
        <Button
            className="flex flex-col selectable-asset"
            appearance="subtle"
            ref={thisRef}
        >
            <div className="flex h-full items-center">
                <Image
                    className="max-w-48 max-h-48"
                    src={convertFileSrc(absPath)}
                    shape="rounded"
                    shadow
                />
            </div>
            <Text align="center" as="p">{asset.name}</Text>
        </Button>
    )
}
