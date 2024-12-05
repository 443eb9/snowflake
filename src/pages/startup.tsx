import { Button, Text, Title1, Toaster, useId, useToastController } from "@fluentui/react-components";
import { Library20Regular, New20Regular } from "@fluentui/react-icons";
import WindowControls from "../widgets/window-controls";
import MsgToast from "../widgets/toast";
import { NavigateFunction, useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { InitializeLibrary, LoadLibrary } from "../backend";

function openLibrary(dispatch: (ctn: string) => void, nav: NavigateFunction) {
    return async () => {
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
}

function initializeLibrary(dispatch: (ctn: string) => void, nav: NavigateFunction) {
    return async () => {
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
}

export default function Startup() {
    const toasterId = useId("toaster");
    const { dispatchToast } = useToastController(toasterId);

    const dispatch = (ctn: string) => {
        dispatchToast(<MsgToast title="Error" body={ctn}></MsgToast>, { intent: "error" })
    }
    const nav = useNavigate()

    return (
        <div className="h-full">
            <Toaster id={toasterId} inline />
            <div className="absolute right-4 w-full">
                <WindowControls className="pt-4" />
            </div>
            <div className="flex h-full justify-center">
                <div className="flex h-full items-center">
                    <div className="flex flex-col gap-2">
                        <Title1 className="italic">Snowflake ❄</Title1>
                        <Button
                            icon={<Library20Regular />}
                            onClick={openLibrary(dispatch, nav)}
                            className="h-12"
                        >
                            Open Library
                        </Button>
                        <Button
                            icon={<New20Regular />}
                            onClick={initializeLibrary(dispatch, nav)}
                            className="h-12"
                        >
                            Initialize Library
                        </Button>
                        <Text as="i" className="opacity-50">Or drop the library root folder here.</Text>
                    </div>
                </div>
            </div>
        </div>
    )
}
