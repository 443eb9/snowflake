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

    const pathChangeHandler = async (pop: number) => {
        if (!browsingFolder?.data?.id || pop == 0 || browsingFolder.data.subTy) {
            return
        }

        // const folderTree = await GetFolderTree()
        //     .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        // if (folderTree) {
        //     let currentFolder = folderTree.get(browsingFolder.data.id) as Folder
        //     while (pop-- && currentFolder.parent) {
        //         currentFolder = folderTree.get(currentFolder.parent) as Folder
        //     }

        //     browsingFolder.setter({
        //         id: currentFolder.id,
        //         name: currentFolder.name,
        //         content: currentFolder.content.map(a => { return { id: a, ty: "asset" } }),
        //         subTy: "folder",
        //     })
        // }
    }

    useEffect(() => {
        async function fetch() {
            if (!browsingFolder?.data) {
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

    console.log(virtualPath)

    return (
        <Breadcrumb>
            {
                !virtualPath || virtualPath.length == 0
                    ? <BreadcrumbButton>Void</BreadcrumbButton>
                    : virtualPath.map((seg, index) =>
                        <>
                            <BreadcrumbItem key={index * 2}>
                                <BreadcrumbButton onClick={() => pathChangeHandler(virtualPath.length - 1 - index)}>
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
