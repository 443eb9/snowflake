import { Button, Menu, MenuItem, MenuPopover, MenuTrigger, Text, Title1, Toaster, useId, useToastController } from "@fluentui/react-components";
import { Book20Regular, Clock20Regular, Library20Regular, New20Regular } from "@fluentui/react-icons";
import WindowControls from "../widgets/window-controls";
import MsgToast from "../widgets/toast";
import { useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { GetRecentLibs, InitializeLibrary, LoadLibrary, RecentLib } from "../backend";
import { useEffect, useState } from "react";

export default function Startup() {
    const toasterId = useId("toaster");
    const { dispatchToast } = useToastController(toasterId)
    const [recentLibs, setRecentLibs] = useState<RecentLib[] | undefined>()

    useEffect(() => {
        async function fetch() {
            const recentLibs = await GetRecentLibs()
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })

            if (recentLibs) {
                setRecentLibs(recentLibs)
            }
        }

        fetch()
    }, [])

    const dispatch = (ctn: string) => {
        console.error(ctn)
        dispatchToast(<MsgToast title="Error" body={ctn}></MsgToast>, { intent: "error" })
    }
    const nav = useNavigate()

    async function openLibrary() {
        const path = await open({
            directory: true,
        })

        if (path) {
            await LoadLibrary({ rootFolder: path })
                .then(() => {
                    nav("/app")
                })
                .catch(err => {
                    dispatch(err)
                })
        }
    }

    async function initializeLibrary() {
        const srcPath = await open({
            directory: true,
            title: "Choose the source root path.",
        })

        if (srcPath) {
            const path = await open({
                directory: true,
                title: "Choose the library root path.",
            })

            if (path) {
                await InitializeLibrary({ srcRootFolder: srcPath, rootFolder: path })
                    .then(() => {
                        nav("/app")
                    })
                    .catch(err => {
                        dispatch(err)
                    })
            }
        }
    }

    return (
        <div className="h-full">
            <Toaster id={toasterId} />
            <div className="absolute right-4 w-full">
                <WindowControls className="pt-4" />
            </div>
            <div className="flex h-full justify-center">
                <div className="flex h-full items-center">
                    <div className="flex flex-col gap-2">
                        <Title1 className="italic">Snowflake ❄</Title1>
                        <Button
                            icon={<Library20Regular />}
                            onClick={openLibrary}
                            className="h-12"
                        >
                            Open Library
                        </Button>
                        <Button
                            icon={<New20Regular />}
                            onClick={initializeLibrary}
                            className="h-12"
                        >
                            Initialize Library
                        </Button>
                        <Menu>
                            <MenuTrigger>
                                <Button
                                    icon={<Clock20Regular />}
                                    className="h-12"
                                >
                                    Open Recent
                                </Button>
                            </MenuTrigger>

                            <MenuPopover>
                                {
                                    recentLibs?.length == 0
                                        ? <MenuItem><Text>No recent libraries.</Text></MenuItem>
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