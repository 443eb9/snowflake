import { Button, Image, Input, makeStyles, Text } from "@fluentui/react-components";
import { Asset, GetAssetAbsPath } from "../backend";
import { convertFileSrc } from "@tauri-apps/api/core";
import { HTMLAttributes, useContext, useEffect, useState } from "react";
import { fileManipulationContext } from "../context-provider";

const inputStyleHook = makeStyles({
    root: {
        "width": "100px",
        "textAlign": "center",
    }
})

export default function AssetPreview({ asset, ...props }: { asset: Asset } & HTMLAttributes<HTMLButtonElement>) {
    const [absPath, setAbsPath] = useState<string | undefined>()
    const [newName, setNewName] = useState<string>()
    const inputStyle = inputStyleHook()

    const fileManipulation = useContext(fileManipulationContext)

    useEffect(() => {
        async function fetch() {
            const path = await GetAssetAbsPath({ asset: asset.id })
                .catch(err => {
                    // TODO error handling
                    console.error(err)
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
            id={asset.id}
            className="flex flex-col gap-2 selectable-asset"
            appearance="subtle"
            {...props}
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
                        onChange={ev => setNewName(ev.target.value)}
                        autoFocus
                        onKeyDown={ev => {
                            if (ev.key == "Enter") {
                                if (fileManipulation?.data && newName) {
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
