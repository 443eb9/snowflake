import { Button, Image, Input, makeStyles, Text } from "@fluentui/react-components";
import { Asset, GetAssetAbsPath } from "../backend";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useContext, useEffect, useRef, useState } from "react";
import { TriggerEvent, useContextMenu } from "react-contexify";
import { CtxMenuId } from "./context-menu";
import { fileManipulationContext, selectedAssetsContext } from "../context-provider";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

const inputStyleHook = makeStyles({
    root: {
        "width": "100px",
    }
})

export default function AssetPreview({ asset }: { asset: Asset }) {
    const thisRef = useRef<HTMLButtonElement>(null)
    const [absPath, setAbsPath] = useState<string | undefined>()
    const inputStyle = inputStyleHook()

    const { show: showCtxMenu } = useContextMenu({ id: CtxMenuId })
    // @ts-ignore
    const { attributes, listeners, setNodeRef, transform, ...rest } = useDraggable({
        id: asset.id,
    })

    const [newName, setNewName] = useState<string>()

    const selectedAssets = useContext(selectedAssetsContext)
    const fileManipulation = useContext(fileManipulationContext)

    const handleContextMenu = (e: TriggerEvent) => {
        if (!selectedAssets?.data || selectedAssets.data.length == 0) {
            selectedAssets?.setter([asset.id])
        }
        showCtxMenu({ event: e })
    }

    useEffect(() => {
        if (thisRef.current) {
            thisRef.current.setAttribute("asset-id", asset.id)
            setNodeRef(thisRef.current)
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

    const onRename = fileManipulation?.data?.ty == "rename" && fileManipulation.data.id[0] == asset.id

    return (
        <Button
            className="flex flex-col gap-2 selectable-asset"
            appearance="subtle"
            ref={thisRef}
            onContextMenu={handleContextMenu}
            style={{
                transform: CSS.Translate.toString(transform),
            }}
            {...listeners}
            {...attributes}
            {...rest}
        >
            <div className="flex h-full items-center">
                <Image
                    className="max-w-48 max-h-48"
                    src={convertFileSrc(absPath)}
                    shape="rounded"
                    shadow
                />
            </div>
            {
                onRename
                    ? <Input
                        defaultValue={asset.name}
                        className={inputStyle.root}
                        appearance="underline"
                        size="small"
                        onChange={ev => setNewName(ev.target.value)}
                        autoFocus
                        onKeyDown={ev => {
                            if (ev.key == "Enter") {
                                if (fileManipulation?.data) {
                                    fileManipulation.setter({
                                        ...fileManipulation.data,
                                        submit: newName
                                    })
                                }
                            } else if (ev.key == "Escape") {
                                fileManipulation.setter(undefined)
                            }
                        }}
                    />
                    : <Text align="center" as="p">{asset.name}</Text>
            }
        </Button>
    )
}
