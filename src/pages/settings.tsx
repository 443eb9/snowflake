import { Menu, MenuButton, MenuItem, MenuList, MenuPopover, MenuTrigger, Switch, Tab, TabList, Text, Title2, useToastController } from "@fluentui/react-components";
import { t } from "../i18n";
import { Beaker20Regular, Box20Regular } from "@fluentui/react-icons";
import { useContext, useEffect, useState } from "react";
import { GetUserSettings, SettingsValue, SetUserSetting, UserSettings } from "../backend";
import { refreshEntireUiContext } from "../context-provider";
import MsgToast from "../widgets/toast";
import { GlobalToasterId } from "../main";

export default function Settings() {
    const [currentTab, setCurrentTab] = useState("general")
    const [userSettings, setUserSettings] = useState<UserSettings | undefined>()

    const refreshEntireUi = useContext(refreshEntireUiContext)

    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        async function fetch() {
            const sets = await GetUserSettings()
                .catch(err => dispatchToast(<MsgToast title="Error" body={err} />, { intent: "error" }))
            if (sets) {
                setUserSettings(sets)
            }
        }

        fetch()
    }, [refreshEntireUi?.data])

    if (!userSettings) {
        return <></>
    }

    const items = Object.entries(userSettings[currentTab])

    const update = (title: string, value: string | boolean) => {
        SetUserSetting({ tab: currentTab, item: title, value })
        refreshEntireUi?.setter(!refreshEntireUi.data)
    }

    const resolveSelector = (title: string, value: SettingsValue) => {
        if (!userSettings) { return }

        if (typeof value == "boolean") {
            return (
                <Switch defaultChecked={value} onChange={(_, data) => update(title, data.checked)} />
            )
        } else if (typeof value == "string") {
        } else {
            return (
                <Menu>
                    <MenuTrigger>
                        <MenuButton className="h-9" appearance="subtle">{t(`settings.${currentTab}.${title}.${value.selected}`)}</MenuButton>
                    </MenuTrigger>
                    <MenuPopover>
                        <MenuList>
                            {
                                value.possible.map((candidate: string) =>
                                    <MenuItem
                                        onClick={() => update(title, candidate)}
                                    >
                                        {t(`settings.${currentTab}.${title}.${candidate}`)}
                                    </MenuItem>
                                )
                            }
                        </MenuList>
                    </MenuPopover>
                </Menu>
            )
        }
    }

    return (
        <div className="flex gap-4 h-full rounded-md">
            <div className="flex flex-col h-full gap-2 p-2 w-[22%]">
                <Title2>{t("settings.title")}</Title2>
                <div className="overflow-y-scroll h-full">
                    <TabList
                        vertical
                        defaultSelectedValue="general"
                        onTabSelect={(_, data) => setCurrentTab(data.value as string)}
                        className="h-full p-2 rounded-md"
                        style={{ backgroundColor: "var(--colorNeutralBackground2)" }}
                    >
                        <Tab icon={<Box20Regular />} value="general">{t("settings.general")}</Tab>
                        <Tab icon={<Beaker20Regular />} value="experimental">{t("settings.experimental")}</Tab>
                    </TabList>
                </div>
            </div>
            <div className="flex flex-col gap-2 flex-grow mr-8 overflow-y-scroll">
                {
                    items.map(([title, value], index) =>
                        <div
                            key={index}
                            className="flex justify-between items-center px-4 py-2 rounded-md"
                            style={{ backgroundColor: "var(--colorNeutralBackground2)" }}
                        >
                            <Text>{t(`settings.${currentTab}.${title}`)}</Text>
                            {resolveSelector(title, value)}
                        </div>
                    )
                }
            </div>
        </div>
    )
}
