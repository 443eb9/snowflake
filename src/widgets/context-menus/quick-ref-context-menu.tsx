import { Button, makeStyles, Text } from "@fluentui/react-components";
import { Dismiss20Regular } from "@fluentui/react-icons";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Item, Menu } from "react-contexify";
import { t } from "../../i18n";

export const QuickRefCtxMenuId = "quickrefctxmenu"

const appWindow = getCurrentWindow()

const buttonStyleHook = makeStyles({
    root: {
        "width": "100%",
        "justifyContent": "start",
    }
})

export default function QuickRefContextMenu() {
    const buttonStyle = buttonStyleHook()

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
        </Menu>
    )
}
