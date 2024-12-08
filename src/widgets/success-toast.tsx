import { Toast, ToastBody, ToastFooter, ToastTitle } from "@fluentui/react-components";
import { t } from "../i18n";
import { ReactNode } from "react";

export default function SuccessToast({ body, footer }: { body?: ReactNode, footer?: ReactNode }) {
    return (
        <Toast>
            <ToastTitle>{t("toast.success.title")}</ToastTitle>
            <ToastBody>{body}</ToastBody>
            <ToastFooter>{footer}</ToastFooter>
        </Toast>
    )
}
