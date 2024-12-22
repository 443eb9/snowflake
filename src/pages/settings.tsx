import { Button, Menu, MenuButton, MenuItem, MenuList, MenuPopover, MenuTrigger, Tab, TabList, Tag, Text, Title2, ToastIntent, useToastController } from "@fluentui/react-components";
import i18n, { t } from "../i18n";
import { ArrowExport20Regular, ArrowUp20Regular, ArrowUpRight20Regular, Beaker20Regular, Book20Regular, Box20Regular, ChartMultiple20Regular, Checkmark20Regular, Cube20Regular, Diamond20Regular, Dismiss20Regular, Edit20Regular, ErrorCircle20Regular, Triangle20Regular } from "@fluentui/react-icons";
import { ReactNode, useContext, useEffect, useState } from "react";
import { ChangeLibraryName, CrashTest, DefaultSettings, ExportLibrary, GetDefaultSettings, GetLibraryMeta, GetUserSettings, LibraryMeta, OpenCrashReportsDir, Selectable, SettingsValue, SetUserSetting, UserSettings } from "../backend";
import { settingsChangeFlagContext } from "../helpers/context-provider";
import ErrToast from "../widgets/toasts/err-toast";
import { GlobalToasterId } from "../main";
import MsgToast from "../widgets/toasts/msg-toast";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import SuccessToast from "../widgets/toasts/success-toast";
import { useNavigate } from "react-router-dom";
import { app } from "@tauri-apps/api";
import ResponsiveInput from "../components/responsive-input";

export default function Settings() {
    const [currentTab, setCurrentTab] = useState<Tab>("general")
    const [userSettings, setUserSettings] = useState<UserSettings | undefined>()
    const [defaultSettings, setDefaultSettings] = useState<DefaultSettings | undefined>()
    const [libraryMeta, setLibraryMeta] = useState<LibraryMeta>()

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

            const libraryMeta = await GetLibraryMeta()
                .catch(() => { })

            if (libraryMeta) {
                setLibraryMeta(libraryMeta)
            }
        }

        fetch()
    }, [settingsChangeFlag?.data])

    if (!userSettings || !defaultSettings) {
        return <></>
    }

    const update = async (title?: string, value?: SettingsValue) => {
        if (title != undefined && value != undefined) {
            await SetUserSetting({ category: currentTab, item: title, value })
                .catch(err => dispatchToast(<ErrToast body={err} />))
        }
        settingsChangeFlag?.setter(!settingsChangeFlag.data)
    }

    const props = {
        currentTab,
        user: userSettings,
        default: defaultSettings,
        update,
        dispatchToast,
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
                        style={{ backgroundColor: "var(--colorNeutralBackground1)" }}
                    >
                        <Tab icon={<Box20Regular />} value="general">{t("settings.general")}</Tab>
                        <Tab icon={<Book20Regular />} value="library" disabled={!libraryMeta}>{t("settings.library")}</Tab>
                        <Tab icon={<Cube20Regular />} value="modelRendering">{t("settings.modelRendering")}</Tab>
                        <Tab icon={<Diamond20Regular />} value="keyMapping">{t("settings.keyMapping")}</Tab>
                        <Tab icon={<Beaker20Regular />} value="experimental" disabled>{t("settings.experimental")}</Tab>
                        <Tab icon={<Triangle20Regular />} value="about">{t("settings.about")}</Tab>
                    </TabList>
                </div>
            </div>
            <div className="flex flex-col gap-2 flex-grow mr-8 overflow-y-scroll">
                <GeneralTab {...props} />
                {
                    libraryMeta &&
                    <LibraryTab {...props} libraryMeta={libraryMeta} />
                }
                <KeyMappingTab {...props} />
                <ModelRenderingTab {...props} />
                <ExperimentalTab {...props} />
                <AboutTab {...props} />
            </div>
        </div>
    )
}

type Tab = "general" | "library" | "modelRendering" | "keyMapping" | "experimental" | "about"

type UpdateFn = (title?: string, value?: SettingsValue) => void

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
            <SettingsItem title="dbClick" currentTab={props.currentTab}>
                <SelectableCandidates
                    currentTab={props.currentTab}
                    title="dbClick"
                    selectable={props.default[tab]["dbClick"] as Selectable}
                    onSelect={props.update}
                    value={props.user[tab]["dbClick"] as string}
                />
            </SettingsItem>
            <SettingsItem title="tagGroupConflictResolve" currentTab={props.currentTab}>
                <SelectableCandidates
                    currentTab={props.currentTab}
                    title="tagGroupConflictResolve"
                    selectable={props.default[tab]["tagGroupConflictResolve"] as Selectable}
                    onSelect={props.update}
                    value={props.user[tab]["tagGroupConflictResolve"] as string}
                />
            </SettingsItem>
        </>
    )
}

function LibraryTab({ libraryMeta, ...props }: TabProps & { libraryMeta: LibraryMeta }) {
    const nav = useNavigate()

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
            <SettingsItem title="name" currentTab={props.currentTab}>
                <ResponsiveInput
                    defaultValue={libraryMeta.name}
                    onConfirm={async target => {
                        await ChangeLibraryName({ name: target.value })
                            .catch(err => props.dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                        props.update()
                    }}
                    onCancel={target => target.value = libraryMeta.name}
                />
            </SettingsItem>
            <SettingsItem title="statistics" currentTab={props.currentTab}>
                <Button icon={<ChartMultiple20Regular />} onClick={() => nav("/stat")} />
            </SettingsItem>
        </>
    )
}

function ModelRenderingTab(props: TabProps) {
    if (props.currentTab != "modelRendering") {
        return
    }

    return (
        <>
            <SettingsItem title="fps" currentTab={props.currentTab}>
                <ResponsiveInput
                    defaultValue={props.user["modelRendering"]["fps"] as string}
                    type="number"
                    onConfirm={target => {
                        props.update("fps", Number.parseFloat(target.value))
                    }}
                    onCancel={target => target.value = props.user["modelRendering"]["fps"] as string}
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

function AboutTab(props: TabProps) {
    const [version, setVersion] = useState<string | undefined>()

    useEffect(() => {
        async function fetch() {
            setVersion(await app.getVersion())
        }

        fetch()
    }, [])

    if (props.currentTab != "about") {
        return <></>
    }

    return (
        <>
            <SettingsItem title="ver" currentTab={props.currentTab}>
                <Text>{version}</Text>
            </SettingsItem>
            <SettingsItem title="repo" currentTab={props.currentTab}>
                <Button
                    icon={<ArrowUpRight20Regular />}
                    onClick={() => openUrl("https://github.com/443eb9/snowflake")}
                />
            </SettingsItem>
            <SettingsItem title="updateCheck" currentTab={props.currentTab}>
                <Button
                    icon={<ArrowUp20Regular />}
                    onClick={async () => {
                        const tags = await fetch("https://api.github.com/repos/443eb9/snowflake/tags")
                            .then(async resp => (await resp.json()) as { name: string }[])
                            .catch(err => props.dispatchToast(<ErrToast body={err} />))

                        if (tags) {
                            const current = await app.getVersion()
                            const latest = tags[0].name

                            if (current == latest) {
                                props.dispatchToast(
                                    <MsgToast
                                        title={t("update.title.already")}
                                        body={t("update.body.already")}
                                    />,
                                    { intent: "success" }
                                )
                            } else {
                                props.dispatchToast(
                                    <MsgToast
                                        title={t("update.title")}
                                        body={t("update.body", { current, latest })}
                                    />
                                )
                            }
                        }
                    }}
                />
            </SettingsItem>
            <SettingsItem title="crash" currentTab={props.currentTab}>
                <Button
                    icon={<ErrorCircle20Regular />}
                    onClick={async () => await CrashTest()}
                />
            </SettingsItem>
            <SettingsItem title="crashReports" currentTab={props.currentTab}>
                <Button
                    icon={<ArrowUpRight20Regular />}
                    onClick={async () => await OpenCrashReportsDir()}
                />
            </SettingsItem>
        </>
    )
}

function SettingsItem({ children, title, currentTab }: { children: ReactNode, title: string, currentTab: string }) {
    return (
        <div
            className="flex justify-between items-center px-4 py-2 rounded-md h-12"
            style={{ backgroundColor: "var(--colorNeutralBackground1)" }}
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
                <MenuButton className="h-9">{t(`settings.${currentTab}.${title}.${value}`)}</MenuButton>
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
