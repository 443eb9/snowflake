import { Button, Image, Menu, MenuItem, MenuPopover, MenuTrigger, Text, Title1, useToastController } from "@fluentui/react-components";
import { Book20Regular, Clock20Regular, Library20Regular, New20Regular, Settings20Regular } from "@fluentui/react-icons";
import WindowControls from "../widgets/window-controls";
import ErrToast from "../widgets/err-toast";
import { useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { GetRecentLibs, InitializeLibrary, LoadLibrary, RecentLib } from "../backend";
import { useContext, useEffect, useState } from "react";
import { t } from "../i18n";
import OverlayPanel from "../widgets/overlay-panel";
import { overlaysContext } from "../helpers/context-provider";
import { GlobalToasterId } from "../main";
import MsgToast from "../widgets/msg-toast";
import DuplicationList from "../widgets/duplication-list";

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
        }

        fetch()
    }, [])

    const dispatch = (ctn: string) => {
        dispatchToast(<ErrToast body={ctn}></ErrToast>, { intent: "error" })
    }

    async function openLibrary() {
        const path = await open({
            directory: true,
        })

        if (path) {
            const dup = await LoadLibrary({ rootFolder: path })
                .catch(err => {
                    dispatch(err)
                })

            if (dup) {
                console.log(dup)
                dispatchToast(<MsgToast
                    title={t("toast.assetDuplication.title")}
                    body={<DuplicationList list={dup} />}
                />,
                    { intent: "warning" }
                )
            }
            nav("/app")
        }
    }

    async function initializeLibrary() {
        const srcPath = await open({
            directory: true,
            title: t("startup.initLibSrcRootDialogTitle"),
        })

        if (srcPath) {
            const path = await open({
                directory: true,
                title: t("startup.initLibDstRootDialogTitle"),
            })

            if (path) {
                const dup = await InitializeLibrary({ srcRootFolder: srcPath, rootFolder: path })
                    .catch(err => {
                        dispatch(err)
                    })

                if (dup) {
                    console.log(dup)
                    dispatchToast(<MsgToast
                        title={t("toast.assetDuplication.title")}
                        body={<DuplicationList list={dup} />}
                    />,
                        { intent: "warning" }
                    )
                }
            }
        }
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
                        >
                            {t("startup.btnOpenLib")}
                        </Button>
                        <Button
                            icon={<New20Regular />}
                            onClick={initializeLibrary}
                            className="h-12"
                        >
                            {t("startup.btnInitLib")}
                        </Button>
                        <Menu>
                            <MenuTrigger>
                                <Button
                                    icon={<Clock20Regular />}
                                    className="h-12"
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
