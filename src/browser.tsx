import { Text } from "@fluentui/react-components";
import { FolderTree } from "./widgets/folder-tree";
import TagsCollections from "./widgets/tags-collections";

export default function Browser({ setBrowsingFolderCallback }: { setBrowsingFolderCallback: (id: string) => void }) {
    return (
        <div className="flex flex-col gap-2 overflow-x-auto">
            <Text as="h2">Library</Text>
            <div>
                <Text as="h3" size={200}>Folder Tree</Text>
                <FolderTree setBrowsingFolderCallback={setBrowsingFolderCallback} />
            </div>
            <div>
                <Text as="h3" size={200}>Tags</Text>
                <TagsCollections />
            </div>
        </div>
    )
}
