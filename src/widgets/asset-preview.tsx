import { Button, Image, Input, makeStyles, Text, useToastController } from "@fluentui/react-components";
import { Asset, GetAssetAbsPath } from "../backend";
import { convertFileSrc } from "@tauri-apps/api/core";
import { HTMLAttributes, useContext, useEffect, useState } from "react";
import { fileManipulationContext } from "../helpers/context-provider";
import ErrToast from "./toasts/err-toast";
import { GlobalToasterId } from "../main";
import { SelectableClassTag } from "./items-grid";
import { encodeId } from "../util";
import GraphicsPreview from "./preview/graphics-preview";
import ModelPreview from "./preview/model-preview";

const inputStyleHook = makeStyles({
    root: {
        "width": "100px",
        "textAlign": "center",
    }
})

export default function AssetPreview({ asset, ...props }: { asset: Asset } & HTMLAttributes<HTMLButtonElement>) {
    const [newName, setNewName] = useState<string>()
    const inputStyle = inputStyleHook()

    const fileManipulation = useContext(fileManipulationContext)

    const onRename = fileManipulation?.data?.op == "rename" && fileManipulation.data.id[0].id == asset.id

    useEffect(() => {
        if (onRename) {
            setNewName(asset.name)
        }
    }, [fileManipulation?.data])

    function getPreview() {
        switch (asset.ty) {
            case "rasterGraphics":
            case "vectorGraphics":
                return <GraphicsPreview asset={asset} />
            case "gltfModel":
                console.log(asset)
                return <ModelPreview asset={asset} />
        }
    }

    return (
        <Button
            {...props}
            id={encodeId(asset.id, "asset")}
            className={`flex flex-col gap-2 ${SelectableClassTag}`}
            appearance="subtle"
        >
            <div className="flex h-full items-center">
                {getPreview()}
            </div>
            {
                onRename
                    ? <Input
                        defaultValue={asset.name}
                        className={inputStyle.root}
                        appearance="underline"
                        onChange={ev => setNewName(ev.target.value)}
                        autoFocus
                        onKeyDown={ev => {
                            if (ev.key == "Enter") {
                                if (fileManipulation.data && newName) {
                                    fileManipulation.setter({
                                        ...fileManipulation.data,
                                        submit: [newName]
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
