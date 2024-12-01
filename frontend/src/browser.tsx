import { Text } from "@fluentui/react-components";
import { FolderTree } from "./widgets/folder-tree";

export default function Browser({ setBrowsingFolderCallback }: { setBrowsingFolderCallback: (id: string) => void }) {
    return (
        <div className="flex flex-col gap-2 overflow-x-auto">
            <Text as="h2">Library</Text>
            <FolderTree setBrowsingFolderCallback={setBrowsingFolderCallback}></FolderTree>
        </div>
    )
}
