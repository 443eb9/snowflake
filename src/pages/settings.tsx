import { Button, Input, Menu, MenuButton, MenuItem, MenuList, MenuPopover, MenuTrigger, Tab, TabList, Tag, Text, Title2, ToastIntent, useToastController } from "@fluentui/react-components";
import i18n, { t } from "../i18n";
import { ArrowExport20Regular, Beaker20Regular, Book20Regular, Box20Regular, Checkmark20Regular, Diamond20Regular, Dismiss20Regular, Edit20Regular } from "@fluentui/react-icons";
import { ReactNode, useContext, useEffect, useState } from "react";
import { ChangeLibraryName, DefaultSettings, ExportLibrary, GetDefaultSettings, GetLibraryMeta, GetUserSettings, LibraryMeta, Selectable, SettingsValue, SetUserSetting, UserSettings } from "../backend";
import { settingsChangeFlagContext } from "../helpers/context-provider";
import ErrToast from "../widgets/err-toast";
import { GlobalToasterId } from "../main";
import MsgToast from "../widgets/msg-toast";
import { open } from "@tauri-apps/plugin-dialog";
import SuccessToast from "../widgets/success-toast";

export default function Settings() {
    const [currentTab, setCurrentTab] = useState<Tab>("general")
    const [userSettings, setUserSettings] = useState<UserSettings | undefined>()
    const [defaultSettings, setDefaultSettings] = useState<DefaultSettings | undefined>()

    const settingsChangeFlag = useContext(settingsChangeFlagContext)

    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        async function fetch() {
            const userSettings = await GetUserSettings()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            if (userSettings) {
                setUserSettings(userSettings)
            }

            if (!defaultSettings) {
                const defaultSettings = await GetDefaultSettings()
                    .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                if (defaultSettings) {
                    setDefaultSettings(defaultSettings)
                }
            }
        }

        fetch()
    }, [settingsChangeFlag?.data])

    if (!userSettings || !defaultSettings) {
        return <></>
    }

    const update = (title: string, value: SettingsValue) => {
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
                <GeneralTab currentTab={currentTab} user={userSettings} default={defaultSettings} update={update} dispatchToast={dispatchToast} />
                <LibraryTab currentTab={currentTab} user={userSettings} default={defaultSettings} update={update} dispatchToast={dispatchToast} />
                <KeyMappingTab currentTab={currentTab} user={userSettings} default={defaultSettings} update={update} dispatchToast={dispatchToast} />
                <ExperimentalTab currentTab={currentTab} user={userSettings} default={defaultSettings} update={update} dispatchToast={dispatchToast} />
            </div>
        </div>
    )
}

type Tab = "general" | "library" | "keyMapping" | "experimental"

type UpdateFn = (title: string, value: SettingsValue) => void

type TabProps = {
    currentTab: Tab,
    user: UserSettings,
    default: DefaultSettings,
    update: UpdateFn,
    dispatchToast: (content: ReactNode, options?: { intent: ToastIntent }) => void
}

function GeneralTab(props: TabProps) {
    const tab = "general"
    if (props.currentTab != tab) {
        return <></>
    }

    return (
        <>
            <SettingsItem title="theme" currentTab={props.currentTab}>
                <SelectableCandidates
                    currentTab={props.currentTab}
                    title="theme"
                    selectable={props.default[tab]["theme"] as Selectable}
                    onSelect={props.update}
                    value={props.user[tab]["theme"] as string}
                />
            </SettingsItem>
            <SettingsItem title="lng" currentTab={props.currentTab}>
                <SelectableCandidates
                    currentTab={props.currentTab}
                    title="lng"
                    selectable={props.default[tab]["lng"] as Selectable}
                    onSelect={(title, value) => {
                        i18n.changeLanguage(value)
                        props.update(title, value)
                    }}
                    value={props.user[tab]["lng"] as string}
                />
            </SettingsItem>
        </>
    )
}

function LibraryTab(props: TabProps) {
    const [libraryMeta, setLibraryMeta] = useState<LibraryMeta>()
    const [updateFlag, setUpdateFlag] = useState(false)

    useEffect(() => {
        async function fetch() {
            const libraryMeta = await GetLibraryMeta()
                .catch(err => props.dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            if (libraryMeta) {
                setLibraryMeta(libraryMeta)
            }
        }

        fetch()
    }, [updateFlag])

    if (props.currentTab != "library" || !libraryMeta) {
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
                <Button icon={<ArrowExport20Regular />} appearance="subtle" onClick={handleExport} />
            </SettingsItem>
            <SettingsItem title="name" currentTab={props.currentTab}>
                <Input
                    defaultValue={libraryMeta.name}
                    onKeyDown={async ev => {
                        if (ev.key == "Enter") {
                            ev.currentTarget.blur()
                            await ChangeLibraryName({ name: ev.currentTarget.value })
                                .catch(err => props.dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                            setUpdateFlag(!updateFlag)
                        }
                    }}
                />
            </SettingsItem>
        </>
    )
}

function KeyMappingTab(props: TabProps) {
    const tab = "keyMapping"
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

    if (props.currentTab != tab) {
        return <></>
    }

    return (
        <>
            {
                Object
                    .entries(props.user[tab])
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
    currentTab, title, selectable, onSelect, value
}: {
    currentTab: string, title: string, selectable: Selectable, onSelect: (title: string, value: string) => void, value: string
}) {
    return (
        <Menu>
            <MenuTrigger>
                <MenuButton className="h-9" appearance="subtle">{t(`settings.${currentTab}.${title}.${value}`)}</MenuButton>
            </MenuTrigger>
            <MenuPopover>
                <MenuList>
                    {
                        selectable.candidates.map((candidate: string) =>
                            <MenuItem
                                onClick={() => onSelect(title, candidate)}
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
