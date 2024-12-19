import { Button, Input, makeStyles, Text, useToastController } from "@fluentui/react-components";
import { Asset, GetUserSetting, OpenWithDefaultApp, QuickRef } from "../backend";
import { HTMLAttributes, useContext, useEffect, useState } from "react";
import { fileManipulationContext, settingsChangeFlagContext } from "../helpers/context-provider";
import { SelectableClassTag } from "./items-grid";
import { encodeId } from "../util";
import AssetImage from "./asset-image";
import { GlobalToasterId } from "../main";
import ErrToast from "./toasts/err-toast";

const inputStyleHook = makeStyles({
    root: {
        "width": "100px",
        "textAlign": "center",
    }
})

type DbClick = "open" | "ref"

export default function AssetPreview({ asset, ...props }: { asset: Asset } & HTMLAttributes<HTMLButtonElement>) {
    const [newName, setNewName] = useState<string>()
    const [dbClick, setDbClick] = useState<DbClick | undefined>()
    const inputStyle = inputStyleHook()
    const { dispatchToast } = useToastController(GlobalToasterId)

    const fileManipulation = useContext(fileManipulationContext)
    const settingsChange = useContext(settingsChangeFlagContext)

    const onRename = fileManipulation?.data?.op == "rename" && fileManipulation.data.id[0].id == asset.id

    useEffect(() => {
        if (onRename) {
            setNewName(asset.name)
        }
    }, [fileManipulation?.data])

    useEffect(() => {
        async function fetch() {
            const dbClick = await GetUserSetting({ category: "general", item: "dbClick" })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            if (dbClick) {
                setDbClick(dbClick as DbClick)
            }
        }
        fetch()
    }, [settingsChange?.data])

    return (
        <Button
            {...props}
            id={encodeId(asset.id, "asset")}
            className={`flex flex-col gap-2 ${SelectableClassTag}`}
            appearance="subtle"
            onClick={async ev => {
                if (ev.detail == 2) {
                    switch (dbClick) {
                        case "open":
                            await OpenWithDefaultApp({ asset: asset.id })
                                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                            break
                        case "ref":
                            await QuickRef({ ty: { asset: [asset.id] } })
                                .catch(err => dispatchToast(<ErrToast body={err} />))
                            break
                    }
                }
            }}
        >
            <div className="flex h-full items-center">
                <AssetImage className="max-w-48 max-h-48" asset={asset} />
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
