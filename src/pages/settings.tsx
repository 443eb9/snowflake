import { Button, Menu, MenuButton, MenuItem, MenuList, MenuPopover, MenuTrigger, Tab, TabList, Tag, Text, Title2, ToastIntent, useToastController } from "@fluentui/react-components";
import { t } from "../i18n";
import { ArrowExport20Regular, Beaker20Regular, Book20Regular, Box20Regular, Checkmark20Regular, Diamond20Regular, Dismiss20Regular, Edit20Regular } from "@fluentui/react-icons";
import { ReactNode, useContext, useEffect, useState } from "react";
import { ExportLibrary, GetUserSettings, Selectable, SettingsValue, SetUserSetting, UserSettings } from "../backend";
import { settingsChangeFlagContext } from "../helpers/context-provider";
import ErrToast from "../widgets/err-toast";
import { GlobalToasterId } from "../main";
import MsgToast from "../widgets/msg-toast";
import { open } from "@tauri-apps/plugin-dialog";
import SuccessToast from "../widgets/success-toast";

export default function Settings() {
    const [currentTab, setCurrentTab] = useState<Tab>("general")
    const [userSettings, setUserSettings] = useState<UserSettings | undefined>()

    const settingsChangeFlag = useContext(settingsChangeFlagContext)

    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        async function fetch() {
            const sets = await GetUserSettings()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            if (sets) {
                setUserSettings(sets)
            }
        }

        fetch()
    }, [settingsChangeFlag?.data])

    if (!userSettings) {
        return <></>
    }

    const update = (title: string, value: string | string[] | boolean) => {
        SetUserSetting({ tab: currentTab, item: title, value })
            .catch(err => {
                dispatchToast(<ErrToast body={err} />)
            })
        settingsChangeFlag?.setter(!settingsChangeFlag.data)
    }

    return (
        <div className="flex gap-4 h-full rounded-md">
            <div className="flex flex-col h-full gap-2 p-2 w-[25%]">
                <Title2>{t("settings.title")}</Title2>
                <div className="overflow-y-scroll h-full">
                    <TabList
                        vertical
                        defaultSelectedValue="general"
                        onTabSelect={(_, data) => setCurrentTab(data.value as Tab)}
                        className="h-full p-2 rounded-md"
                        style={{ backgroundColor: "var(--colorNeutralBackground2)" }}
                    >
                        <Tab icon={<Box20Regular />} value="general">{t("settings.general")}</Tab>
                        <Tab icon={<Book20Regular />} value="library">{t("settings.library")}</Tab>
                        <Tab icon={<Diamond20Regular />} value="keyMapping">{t("settings.keyMapping")}</Tab>
                        <Tab icon={<Beaker20Regular />} value="experimental" disabled>{t("settings.experimental")}</Tab>
                    </TabList>
                </div>
            </div>
            <div className="flex flex-col gap-2 flex-grow mr-8 overflow-y-scroll">
                <GeneralTab currentTab={currentTab} items={userSettings["general"]} update={update} dispatchToast={dispatchToast} />
                <LibGeneralTab currentTab={currentTab} items={userSettings["library"]} update={update} dispatchToast={dispatchToast} />
                <KeyMappingTab currentTab={currentTab} items={userSettings["keyMapping"]} update={update} dispatchToast={dispatchToast} />
                <ExperimentalTab currentTab={currentTab} items={userSettings["experimental"]} update={update} dispatchToast={dispatchToast} />
            </div>
        </div>
    )
}

type Tab = "general" | "library" | "keyMapping" | "experimental"

type UpdateFn = (title: string, value: string | string[] | boolean) => void

type TabProps = {
    currentTab: Tab,
    items: { [title: string]: SettingsValue },
    update: UpdateFn,
    dispatchToast: (content: ReactNode, options?: { intent: ToastIntent }) => void
}

function GeneralTab(props: TabProps) {
    if (props.currentTab != "general") {
        return <></>
    }

    return (
        <>
            <SettingsItem title="theme" currentTab={props.currentTab}>
                <SelectableCandidates
                    currentTab={props.currentTab}
                    title="theme"
                    selectable={props.items["theme"] as Selectable}
                    update={props.update}
                />
            </SettingsItem>
            <SettingsItem title="lng" currentTab={props.currentTab}>
                <SelectableCandidates
                    currentTab={props.currentTab}
                    title="lng"
                    selectable={props.items["lng"] as Selectable}
                    update={props.update}
                />
            </SettingsItem>
        </>
    )
}

function LibGeneralTab(props: TabProps) {
    if (props.currentTab != "library") {
        return <></>
    }

    const handleExport = async () => {
        const root = await open({
            directory: true,
        }).catch(err => {
            props.dispatchToast(<ErrToast body={err} />, { intent: "error" })
        })

        if (root) {
            await ExportLibrary({ rootFolder: root })
                .then(() => {
                    props.dispatchToast(<SuccessToast body={t("toast.export.success")} />, { intent: "success" })
                })
                .catch(err => {
                    props.dispatchToast(<ErrToast body={err} />, { intent: "error" })
                })
        }
    }

    return (
        <>
            <SettingsItem title="export" currentTab={props.currentTab}>
                <Button icon={<ArrowExport20Regular />} onClick={handleExport} />
            </SettingsItem>
        </>
    )
}

function KeyMappingTab(props: TabProps) {
    const [editingKeyMapping, setEditingKeyMapping] = useState<string | undefined>(undefined)
    const [listenedKeyMap, setListenedKeyMap] = useState<string[]>([])

    useEffect(() => {
        if (editingKeyMapping) {
            // Some code are different from browser event
            const codeMapping = new Map([
                ["delete", "del"]
            ])

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
                    const key = ev.key.toLowerCase()
                    const mapped = codeMapping.get(key)
                    if (mapped) {
                        keys.push(mapped)
                    } else {
                        keys.push(key)
                    }
                }

                setListenedKeyMap(keys)
            }
            document.addEventListener("keydown", recorder)

            return () => {
                document.removeEventListener("keydown", recorder)
            }
        }
    }, [editingKeyMapping])

    if (props.currentTab != "keyMapping") {
        return <></>
    }

    return (
        <>
            {
                Object
                    .entries(props.items)
                    .map(([title, value]) => {
                        const keys = value as string[]

                        return (
                            <SettingsItem title={title} currentTab={props.currentTab}>
                                <div className="flex gap-2 items-center">
                                    {
                                        keys.map(key =>
                                            <Tag key={key} appearance="outline">{key}</Tag>
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
                                                            props.update(title, listenedKeyMap)
                                                            setEditingKeyMapping(undefined)
                                                        } else {
                                                            props.dispatchToast(
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
                                                    } else {
                                                        setEditingKeyMapping(title)
                                                    }
                                                }}
                                            />
                                    }
                                </div>
                            </SettingsItem>
                        )
                    })
            }
        </>
    )
}

function ExperimentalTab(props: TabProps) {
    if (props.currentTab != "experimental") {
        return <></>
    }

    return <></>
}

function SettingsItem({ children, title, currentTab }: { children: ReactNode, title: string, currentTab: string }) {
    return (
        <div
            className="flex justify-between items-center px-4 py-2 rounded-md"
            style={{ backgroundColor: "var(--colorNeutralBackground2)" }}
        >
            <Text>{t(`settings.${currentTab}.${title}`)}</Text>
            {children}
        </div>
    )
}

function SelectableCandidates({
    currentTab, title, selectable, update
}: {
    currentTab: string, title: string, selectable: Selectable, update: UpdateFn
}) {
    return (
        <Menu>
            <MenuTrigger>
                <MenuButton className="h-9" appearance="subtle">{t(`settings.${currentTab}.${title}.${selectable.selected}`)}</MenuButton>
            </MenuTrigger>
            <MenuPopover>
                <MenuList>
                    {
                        selectable.possible.map((candidate: string) =>
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
