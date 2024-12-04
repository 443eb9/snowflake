import { Button, Image, Text } from "@fluentui/react-components";
import { Asset, GetAssetAbsPath } from "../backend";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useRef, useState } from "react";
import { useContextMenu } from "react-contexify";
import { CtxMenuId } from "./context-menu";

export default function AssetPreview({ asset }: { asset: Asset }) {
    const thisRef = useRef<HTMLButtonElement>(null)
    const [absPath, setAbsPath] = useState<string | undefined>()
    const { show: showCtxMenu } = useContextMenu({ id: CtxMenuId })

    useEffect(() => {
        if (thisRef.current) {
            thisRef.current.setAttribute("asset-id", asset.id)
        }
    })

    useEffect(() => {
        async function fetch() {
            const path = await GetAssetAbsPath({ asset: asset.id })
                .catch(err => {
                    // TODO error handling
                    console.log(err)
                })
            if (path) {
                setAbsPath(path)
            }
        }

        fetch()
    }, [asset.id])

    if (!absPath) {
        return <></>
    }

    return (
        <Button
            className="flex flex-col selectable-asset"
            appearance="subtle"
            ref={thisRef}
            onContextMenu={e => showCtxMenu({ event: e })}
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
