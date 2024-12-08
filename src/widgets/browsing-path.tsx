import { useContext, useEffect, useState } from "react"
import { browsingFolderContext } from "../context-provider"
import { Folder, GetFolderTree, GetFolderVirtualPath } from "../backend"
import { Breadcrumb, BreadcrumbButton, BreadcrumbDivider, BreadcrumbItem, useToastController } from "@fluentui/react-components"
import MsgToast from "./toast"
import { GlobalToasterId } from "../main"

export function BrowsingPath() {
    const [virtualPath, setVirtualPath] = useState<string[] | undefined>()

    const browsingFolder = useContext(browsingFolderContext)

    const { dispatchToast } = useToastController(GlobalToasterId)

    const pathChangeHandler = async (pop: number) => {
        if (!browsingFolder?.data?.id || pop == 0 || browsingFolder.data.collection) {
            return
        }

        const folderTree = await GetFolderTree()
            .catch(err => dispatchToast(<MsgToast title="Error" body={err} />, { intent: "error" }))

        if (folderTree) {
            let currentFolder = folderTree.get(browsingFolder.data.id) as Folder
            while (pop-- && currentFolder.parent) {
                currentFolder = folderTree.get(currentFolder.parent) as Folder
            }

            browsingFolder.setter({
                id: currentFolder.id,
                name: currentFolder.name,
                content: currentFolder.content,
                collection: false,
            })
        }
    }

    useEffect(() => {
        async function fetch() {
            if (!browsingFolder?.data?.id) {
                return
            }

            if (browsingFolder.data.collection) {
                setVirtualPath([`Tag collection ${browsingFolder.data.name}`])
            } else {
                const path = await GetFolderVirtualPath({ folder: browsingFolder.data.id })
                    .catch(err => dispatchToast(<MsgToast title="Error" body={err} />, { intent: "error" }))
                if (path) {
                    setVirtualPath(path)
                }
            }
        }

        fetch()
    }, [browsingFolder?.data?.id])

    if (!virtualPath) {
        return <></>
    }

    return (
        <Breadcrumb>
            {
                virtualPath.length == 0
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
