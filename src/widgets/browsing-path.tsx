import { useContext, useEffect, useState } from "react"
import { browsingFolderContext } from "../helpers/context-provider"
import { GetTagVirtualPath } from "../backend"
import { Breadcrumb, BreadcrumbButton, BreadcrumbDivider, BreadcrumbItem, useToastController } from "@fluentui/react-components"
import ErrToast from "./toasts/err-toast"
import { GlobalToasterId } from "../main"
import { t } from "../i18n"

export function BrowsingPath() {
    const [virtualPath, setVirtualPath] = useState<string[] | undefined>()
    const browsingFolder = useContext(browsingFolderContext)
    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        async function fetch() {
            if (!browsingFolder?.data) {
                setVirtualPath(undefined)
                return
            }

            switch (browsingFolder.data.subTy) {
                case "recycleBin":
                    setVirtualPath([browsingFolder.data.name])
                    break
                case "tag":
                    if (browsingFolder.data.id) {
                        const path = await GetTagVirtualPath({ tag: browsingFolder.data.id })
                            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

                        if (path) {
                            setVirtualPath(path)
                        }
                    }
                    break
                case "uncategorized":
                    setVirtualPath([t("collection.uncategorized")])
                    break
                case "all":
                    setVirtualPath([t("collection.all")])
                    break
            }
        }

        fetch()
    }, [browsingFolder?.data])

    return (
        <Breadcrumb>
            {
                !virtualPath || virtualPath.length == 0
                    ? <BreadcrumbButton>Void</BreadcrumbButton>
                    : virtualPath.map((seg, index) =>
                        <>
                            <BreadcrumbItem key={index * 2}>
                                <BreadcrumbButton>
                                    {seg}
                                </BreadcrumbButton>
                            </BreadcrumbItem>
                            {index != virtualPath.length - 1 && <BreadcrumbDivider key={index * 2 + 1} />}
                        </>
                    )
            }
        </Breadcrumb>
    )
}
