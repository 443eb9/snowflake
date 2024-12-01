import { Button, Text, Title1, useId, useToastController } from "@fluentui/react-components";
import { Library20Regular, New20Regular } from "@fluentui/react-icons";
import WindowControls from "../widgets/window-controls";
import { LoadLibrary, InitializeLibrary } from "../../wailsjs/go/main/App";
import MsgToast from "../widgets/toast";
import { NavigateFunction, useNavigate } from "react-router-dom";

function openLibrary(dispatch: (ctn: string) => void, nav: NavigateFunction) {
    return async () => {
        await LoadLibrary()
            .then(() => {
                nav("/app")
            })
            .catch(err => {
                dispatch(err)
            })
    }
}

function initializeLibrary(dispatch: (ctn: string) => void, nav: NavigateFunction) {
    return async () => {
        await InitializeLibrary()
            .then(() => {
                nav("/app")
            })
            .catch(err => {
                dispatch(err)
            })
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
        <>
            <div className="h-full">
                <div className="absolute right-4 top-4">
                    <WindowControls />
                </div>
                <div className="flex h-full justify-center">
                    <div className="flex h-full items-center">
                        <div className="flex flex-col gap-2">
                            <Title1 className="italic">Snowflake ❄</Title1>
                            <Button icon={<Library20Regular />} className="h-12" onClick={openLibrary(dispatch, nav)}>Open Library</Button>
                            <Button icon={<New20Regular />} className="h-12" onClick={initializeLibrary(dispatch, nav)}>Initialize Library</Button>
                            <Text as="i" className="opacity-50">Or drop the library root folder here.</Text>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
