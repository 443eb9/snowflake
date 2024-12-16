import { Toast, ToastBody, ToastFooter, ToastTitle } from "@fluentui/react-components";
import { ReactNode } from "react";
import { t } from "../../i18n";

export default function ErrToast({ body, footer }: { body?: ReactNode, footer?: ReactNode }) {
    return (
        <Toast>
            <ToastTitle>{t("toast.err.title")}</ToastTitle>
            <ToastBody>{body}</ToastBody>
            <ToastFooter>{footer}</ToastFooter>
        </Toast>
    )
}
