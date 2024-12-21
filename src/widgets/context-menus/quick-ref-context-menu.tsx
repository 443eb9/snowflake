import { Button, makeStyles, Text, useToastController } from "@fluentui/react-components";
import { Dismiss20Regular, Screenshot20Regular } from "@fluentui/react-icons";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Item, Menu } from "react-contexify";
import { t } from "../../i18n";
import { Asset, ImportMemoryAssets } from "../../backend";
import { GlobalToasterId } from "../../main";
import ErrToast from "../toasts/err-toast";
import MsgToast from "../toasts/msg-toast";
import DuplicationList from "../duplication-list";
import SuccessToast from "../toasts/success-toast";

export const QuickRefCtxMenuId = "quickrefctxmenu"

const appWindow = getCurrentWindow()

const buttonStyleHook = makeStyles({
    root: {
        "width": "100%",
        "justifyContent": "start",
    }
})

export default function QuickRefContextMenu({ asset }: { asset: Asset }) {
    const buttonStyle = buttonStyleHook()
    const { dispatchToast } = useToastController(GlobalToasterId)

    const handleScreenshot = async () => {
        const canvas = document.querySelector("canvas")

        if (canvas) {
            canvas.toBlob(async blob => {
                const data = await blob?.arrayBuffer()

                if (data) {
                    const dup = await ImportMemoryAssets({ data: new Uint8Array(data), format: "png", initialTag: null })
                        .then(dup => {
                            dispatchToast(<SuccessToast body={t("toast.screenshot.success")} />, { intent: "success" })
                            return dup
                        })
                        .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

                    if (dup) {
                        dispatchToast(
                            <MsgToast title={t("toast.assetDuplication.title")} body={<DuplicationList list={dup} />} />,
                            { intent: "warning" }
                        )
                    }
                }
            })
        }
    }

    return (
        <Menu id={QuickRefCtxMenuId}>
            <Item onClick={() => appWindow.close()}>
                <Button
                    className={buttonStyle.root}
                    icon={<Dismiss20Regular />}
                    appearance="subtle"
                >
                    <Text>{t("quickRefCtxMenu.close")}</Text>
                </Button>
            </Item>
            <Item onClick={handleScreenshot} disabled={asset.ty != "gltfModel"}>
                <Button
                    className={buttonStyle.root}
                    icon={<Screenshot20Regular />}
                    appearance="subtle"
                >
                    <Text>{t("quickRefCtxMenu.screenshot")}</Text>
                </Button>
            </Item>
        </Menu>
    )
}
