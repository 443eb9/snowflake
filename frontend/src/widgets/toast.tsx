import { Toast, ToastBody, ToastFooter, ToastTitle } from "@fluentui/react-components";
import { ReactNode } from "react";

export default function MsgToast({ title, body, footer }: { title?: ReactNode, body?: ReactNode, footer?: ReactNode }) {
    return (
        <Toast>
            <ToastTitle>{title}</ToastTitle>
            <ToastBody>{body}</ToastBody>
            <ToastFooter>{footer}</ToastFooter>
        </Toast>
    )
}
