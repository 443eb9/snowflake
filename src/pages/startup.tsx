import { Button, Image, Input, Menu, MenuItem, MenuPopover, MenuTrigger, Popover, PopoverSurface, PopoverTrigger, Switch, Text, Title1, useToastController } from "@fluentui/react-components";
import { Book20Regular, Clock20Regular, Folder20Regular, Library20Regular, New20Regular, Settings20Regular } from "@fluentui/react-icons";
import WindowControls from "../widgets/window-controls";
import ErrToast from "../widgets/toasts/err-toast";
import { useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { GetRecentLibs, InitializeLibrary, LoadLibrary, RecentLib, StorageConstructionSettings, UnloadLibrary } from "../backend";
import { useContext, useEffect, useState } from "react";
import { t } from "../i18n";
import OverlayPanel from "./overlay-panel";
import { overlaysContext } from "../helpers/context-provider";
import { GlobalToasterId } from "../main";
import MsgToast from "../widgets/toasts/msg-toast";
import DuplicationList from "../widgets/duplication-list";
import { app } from "@tauri-apps/api";

export default function Startup() {
    const { dispatchToast } = useToastController(GlobalToasterId)
    const [recentLibs, setRecentLibs] = useState<RecentLib[] | undefined>()

    const overlays = useContext(overlaysContext)
    const nav = useNavigate()

    useEffect(() => {
        async function fetch() {
            const recentLibs = await GetRecentLibs()
                .catch(err => dispatch(err))

            if (recentLibs) {
                setRecentLibs(recentLibs)
            }

            await UnloadLibrary()
                .catch(err => dispatch(err))
        }

        fetch()
    }, [])

    useEffect(() => {
        type GitTags = {
            name: string,
        }

        async function check() {
            const tags = await fetch("https://api.github.com/repos/443eb9/snowflake/tags")
                .then(async resp => (await resp.json()) as GitTags[])
                .catch(err => dispatch(err))

            if (tags) {
                const current = await app.getVersion()
                const latest = tags[0].name

                if (current != latest) {
                    dispatchToast(
                        <MsgToast
                            title={t("update.title")}
                            body={t("update.body", { current, latest })}
                        />
                    )
                }
            }
        }

        check()
    }, [])

    const dispatch = (ctn: string) => {
        dispatchToast(<ErrToast body={ctn}></ErrToast>, { intent: "error" })
    }

    async function openLibrary() {
        const path = await open({
            directory: true,
        })

        if (path) {
            await LoadLibrary({ rootFolder: path })
                .then(dup => {
                    if (dup) {
                        dispatchToast(<MsgToast
                            title={t("toast.assetDuplication.title")}
                            body={<DuplicationList list={dup} />}
                        />,
                            { intent: "warning" }
                        )
                    }

                    nav("/app")
                })
                .catch(err => {
                    dispatch(err)
                })
        }
    }

    const InitializeLibraryPopover = () => {
        const [settings, setSettings] = useState<StorageConstructionSettings>({
            srcRoot: "",
            root: "",
            folderAsTag: false,
        })

        return (
            <div className="flex flex-col gap-2">
                <div className="flex gap-2 items-center">
                    <Text>{t("libInit.srcPath")}</Text>
                    <Input value={settings.srcRoot} onChange={ev => setSettings({ ...settings, srcRoot: ev.currentTarget.value })} />
                    <Button
                        icon={<Folder20Regular />}
                        onClick={async () => {
                            const srcPath = await open({
                                directory: true,
                                title: t("startup.initLibSrcRootDialogTitle"),
                            })
                            if (srcPath) {
                                setSettings({ ...settings, srcRoot: srcPath })
                            }
                        }}
                    />
                </div>
                <div className="flex gap-2 items-center">
                    <Text>{t("libInit.srcPath")}</Text>
                    <Input value={settings.root} onChange={ev => setSettings({ ...settings, root: ev.currentTarget.value })} />
                    <Button
                        icon={<Folder20Regular />}
                        onClick={async () => {
                            const root = await open({
                                directory: true,
                                title: t("startup.initLibDstRootDialogTitle"),
                            })
                            if (root) {
                                setSettings({ ...settings, root })
                            }
                        }}
                    />
                </div>
                <div className="flex gap-2 items-center justify-between">
                    <Text>{t("libInit.folderAsTag")}</Text>
                    <Switch checked={settings.folderAsTag} onChange={ev => setSettings({ ...settings, folderAsTag: ev.currentTarget.checked })} />
                </div>
                <Button
                    onClick={async () => {
                        await InitializeLibrary({ settings })
                            .then(dup => {
                                if (dup) {
                                    dispatchToast(<MsgToast
                                        title={t("toast.assetDuplication.title")}
                                        body={<DuplicationList list={dup} />}
                                    />,
                                        { intent: "warning" }
                                    )
                                }

                                nav("/app")
                            })
                            .catch(err => {
                                dispatch(err)
                            })
                    }}
                >
                    {t("libInit.init")}
                </Button>
            </div>
        )
    }

    return (
        <div className="h-full">
            <OverlayPanel />
            <div className="absolute right-4 w-full">
                <WindowControls className="pt-4 z-20" />
            </div>
            <Button
                size="large"
                icon={<Settings20Regular />}
                className="absolute right-4 bottom-4"
                onClick={() => overlays?.setter({ ty: "settings" })}
                appearance="outline"
            />
            <div className="flex h-full justify-center">
                <div className="flex flex-col flex-wrap gap-2 h-full justify-center">
                    <Image src="snowflake.svg" width={200} />
                    <div className="flex flex-col gap-2">
                        <Title1 className="italic" align="center">Snowflake</Title1>
                        <Button
                            icon={<Library20Regular />}
                            onClick={openLibrary}
                            className="h-12"
                            appearance="outline"
                        >
                            {t("startup.btnOpenLib")}
                        </Button>
                        <Popover>
                            <PopoverTrigger>
                                <Button
                                    icon={<New20Regular />}
                                    className="h-12"
                                    appearance="outline"
                                >
                                    {t("startup.btnInitLib")}
                                </Button>
                            </PopoverTrigger>
                            <PopoverSurface>
                                <InitializeLibraryPopover />
                            </PopoverSurface>
                        </Popover>
                        <Menu>
                            <MenuTrigger>
                                <Button
                                    icon={<Clock20Regular />}
                                    className="h-12"
                                    appearance="outline"
                                >
                                    {t("startup.btnRecent")}
                                </Button>
                            </MenuTrigger>
                            <MenuPopover>
                                {
                                    recentLibs?.length == 0
                                        ? <MenuItem><Text>{t("startup.noRecent")}</Text></MenuItem>
                                        : recentLibs?.map((lib, index) =>
                                            <MenuItem
                                                key={index}
                                                secondaryContent={(new Date(lib.lastOpen).toLocaleString())}
                                                icon={<Book20Regular />}
                                                onClick={async () => {
                                                    await LoadLibrary({ rootFolder: lib.path })
                                                        .then(() => {
                                                            nav("/app")
                                                        })
                                                        .catch(err => {
                                                            dispatch(err)
                                                        })
                                                }}
                                            >
                                                <Text>{lib.name}</Text>
                                            </MenuItem>
                                        )
                                }
                            </MenuPopover>
                        </Menu>
                    </div>
                </div>
            </div>
        </div>
    )
}
