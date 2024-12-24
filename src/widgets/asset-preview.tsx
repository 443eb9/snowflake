import { Button, makeStyles, Text, useToastController } from "@fluentui/react-components";
import { GetUserSetting, Item, OpenWithDefaultApp, QuickRef } from "../backend";
import { HTMLAttributes, useContext, useEffect, useState } from "react";
import { fileManipulationContext, settingsChangeFlagContext } from "../helpers/context-provider";
import { SelectableClassTag } from "./items-grid";
import { encodeId } from "../util";
import ItemImage from "./asset-image";
import { GlobalToasterId } from "../main";
import ErrToast from "./toasts/err-toast";
import ResponsiveInput from "../components/responsive-input";

const inputStyleHook = makeStyles({
    root: {
        "width": "100px",
        "textAlign": "center",
    }
})

type DbClick = "open" | "ref"

export default function ItemPreview({ item, ...props }: { item: Item } & HTMLAttributes<HTMLButtonElement>) {
    const [dbClick, setDbClick] = useState<DbClick | undefined>()
    const inputStyle = inputStyleHook()
    const { dispatchToast } = useToastController(GlobalToasterId)

    const fileManipulation = useContext(fileManipulationContext)
    const settingsChange = useContext(settingsChangeFlagContext)

    const onRename = fileManipulation?.data?.op == "rename" && fileManipulation.data.id[0].id == item.data.id

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
            id={encodeId(item.data.id, item.ty)}
            className={`flex flex-col gap-2 ${SelectableClassTag}`}
            appearance="subtle"
            onClick={async ev => {
                if (ev.detail == 2 && item.ty == "asset") {
                    switch (dbClick) {
                        case "open":
                            await OpenWithDefaultApp({ asset: item.data.id })
                                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                            break
                        case "ref":
                            await QuickRef({ ty: { asset: [item.data.id] } })
                                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                            break
                    }
                }
            }}
        >
            <div className="flex h-full items-center">
                <ItemImage className="max-w-48 max-h-48" item={item} />
            </div>
            {
                onRename
                    ? <ResponsiveInput
                        defaultValue={item.data.name}
                        className={inputStyle.root}
                        appearance="underline"
                        autoFocus
                        onConfirm={target => {
                            if (fileManipulation.data) {
                                fileManipulation.setter({
                                    ...fileManipulation.data,
                                    submit: [target.value]
                                })
                            }
                        }}
                        onCancel={target => target.value = item.data.name}
                    />
                    : <Text align="center" as="p">{item.data.name}</Text>
            }
        </Button>
    )
}
