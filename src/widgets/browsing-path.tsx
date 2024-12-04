import { useContext } from "react"
import { browsingFolderContext } from "../context-provider"
import { Folder, GetFolderTree } from "../backend"
import { Breadcrumb, BreadcrumbButton, BreadcrumbDivider, BreadcrumbItem } from "@fluentui/react-components"

export function BrowsingPath() {
    const browsingFolder = useContext(browsingFolderContext)

    const pathChangeHandler = async (pop: number) => {
        if (!browsingFolder?.data?.path || pop == 0) {
            return
        }

        const folderTree = await GetFolderTree()
            .catch(err => {
                // TODO error handling
                console.error(err)
            })

        if (folderTree) {
            let currentFolder = folderTree.get(browsingFolder.data.path) as Folder
            while (pop--) {
                currentFolder = folderTree.get(currentFolder.parent) as Folder
            }

            browsingFolder.setter({
                content: currentFolder.content,
                path: currentFolder.relative_path,
                collection: false
            })
        }
    }


    const pathSegs = browsingFolder?.data?.path.replaceAll("\\", "/").split("/") ?? []

    return (
        <Breadcrumb>
            {
                pathSegs.length == 0
                    ? <BreadcrumbButton>Void</BreadcrumbButton>
                    : pathSegs.map((seg, index) =>
                        <>
                            <BreadcrumbItem key={index * 2}>
                                <BreadcrumbButton onClick={() => pathChangeHandler(pathSegs.length - 1 - index)}>
                                    {seg}
                                </BreadcrumbButton>
                            </BreadcrumbItem>
                            {index != pathSegs.length - 1 && <BreadcrumbDivider key={index * 2 + 1} />}
                        </>
                    )
            }
        </Breadcrumb>
    )
}
