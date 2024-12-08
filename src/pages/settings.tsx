import { Button, Menu, MenuButton, MenuItem, MenuList, MenuPopover, MenuTrigger, Switch, Tab, TabList, Tag, Text, Title2, useToastController } from "@fluentui/react-components";
import { t } from "../i18n";
import { Beaker20Regular, Box20Regular, Checkmark20Regular, Diamond20Regular, Dismiss20Regular, Edit20Regular } from "@fluentui/react-icons";
import { useContext, useEffect, useState } from "react";
import { GetUserSettings, SettingsValue, SetUserSetting, UserSettings } from "../backend";
import { refreshEntireUiContext } from "../context-provider";
import ErrToast from "../widgets/err-toast";
import { GlobalToasterId } from "../main";
import MsgToast from "../widgets/msg-toast";

export default function Settings() {
    const [currentTab, setCurrentTab] = useState("general")
    const [userSettings, setUserSettings] = useState<UserSettings | undefined>()

    const [editingKeyMapping, setEditingKeyMapping] = useState<string | undefined>(undefined)
    const [listenedKeyMap, setListenedKeyMap] = useState<string[]>([])

    const refreshEntireUi = useContext(refreshEntireUiContext)

    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        if (editingKeyMapping) {
            const recorder = (ev: KeyboardEvent) => {
                let keys = []
                if (ev.ctrlKey) {
                    keys.push("ctrl")
                }
                if (ev.altKey) {
                    keys.push("alt")
                }
                if (ev.shiftKey) {
                    keys.push("shift")
                }
                if (!["Control", "Alt", "Shift"].includes(ev.key)) {
                    keys.push(ev.key.toLowerCase())
                }

                setListenedKeyMap(keys)
            }
            document.addEventListener("keydown", recorder)

            return () => {
                document.removeEventListener("keydown", recorder)
            }
        }
    }, [editingKeyMapping])

    useEffect(() => {
        async function fetch() {
            const sets = await GetUserSettings()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
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

    const update = (title: string, value: SettingsValue) => {
        SetUserSetting({ tab: currentTab, item: title, value })
            .catch(err => {
                dispatchToast(<ErrToast body={err} />)
            })
        refreshEntireUi?.setter(!refreshEntireUi.data)
    }

    const resolveSelector = (title: string, value: SettingsValue) => {
        if (!userSettings) { return }

        if (currentTab == "keyMapping") {
            const keys = value as string[]
            return (
                <div className="flex gap-2 items-center">
                    {
                        keys.map(key =>
                            <Tag appearance="outline">{key}</Tag>
                        )
                    }
                    {
                        editingKeyMapping == title &&
                        <Text>{t("settings.keyMapping.listening")}</Text>
                    }
                    {
                        editingKeyMapping == title
                            ? <>
                                <Button
                                    icon={<Dismiss20Regular />}
                                    onClick={() => setEditingKeyMapping(undefined)}
                                />
                                <Button
                                    icon={<Checkmark20Regular />}
                                    onClick={async () => {
                                        if (listenedKeyMap.filter(k => !["ctrl", "alt", "shift"].includes(k)).length > 0) {
                                            update(title, listenedKeyMap)
                                            setEditingKeyMapping(undefined)
                                        } else {
                                            dispatchToast(
                                                <MsgToast
                                                    title={t("toast.invalidKeyComb.title")}
                                                    body={t("toast.invalidKeyComb.body")}
                                                />,
                                                { intent: "error" }
                                            )
                                        }
                                    }}
                                />
                            </>
                            : <Button
                                icon={<Edit20Regular />}
                                onClick={() => {
                                    if (editingKeyMapping == title) {
                                        setEditingKeyMapping(undefined)

                                        if (listenedKeyMap.length != 0) {
                                            SetUserSetting({ tab: currentTab, item: title, value: listenedKeyMap })
                                        }
                                    } else {
                                        setEditingKeyMapping(title)
                                    }
                                }}
                            />
                    }
                </div>
            )
        }

        if (typeof value == "boolean") {
            // Toggle
            return (
                <Switch defaultChecked={value} onChange={(_, data) => update(title, data.checked)} />
            )
        } else if (typeof value == "string") {
            // Custom
        } else if (Array.isArray(value)) {
            // Sequence
            console.error("Missing implementation for sequence items.")
        } else {
            // Selection
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
                        <Tab icon={<Diamond20Regular />} value="keyMapping">{t("settings.keyMapping")}</Tab>
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
