import { Menu, MenuButton, MenuItem, MenuList, MenuPopover, MenuTrigger, Switch, Tab, TabList, Text } from "@fluentui/react-components";
import { t } from "../i18n";
import { Beaker20Regular, Box20Regular } from "@fluentui/react-icons";
import { useEffect, useState } from "react";
import { GetUserSettings, SettingsValue, SetUserSetting, UserSettings } from "../backend";

export default function Settings() {
    const [currentTab, setCurrentTab] = useState("general")
    const [userSettings, setUserSettings] = useState<UserSettings | undefined>()
    const [updateFlag, setUpdateFlag] = useState(false)

    useEffect(() => {
        async function fetch() {
            const sets = await GetUserSettings()
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })
            if (sets) {
                setUserSettings(sets)
            }
        }

        fetch()
    }, [updateFlag])

    if (!userSettings) {
        return <></>
    }

    const items = Object.entries(userSettings[currentTab])

    const update = (title: string, value: string | boolean) => {
        SetUserSetting({ tab: currentTab, item: title, value })
        setUpdateFlag(!updateFlag)
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
                        <MenuButton className="h-9">{t(`settings.${currentTab}.${title}.${value.selected}`)}</MenuButton>
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
        <div className="flex gap-2">
            <TabList vertical defaultSelectedValue="general" onTabSelect={(_, data) => setCurrentTab(data.value as string)}>
                <Tab icon={<Box20Regular />} value="general">{t("settings.general")}</Tab>
                <Tab icon={<Beaker20Regular />} value="experimental">{t("settings.experimental")}</Tab>
            </TabList>
            <div className="flex flex-col gap-2 flex-grow pr-8">
                {
                    items.map(([title, value], index) =>
                        <div
                            key={index}
                            className="flex justify-between items-center px-4 py-2 rounded-md"
                            style={{ backgroundColor: "var(--colorNeutralBackground1Hover)" }}
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
