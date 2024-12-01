import { Button } from "@fluentui/react-components";
import { Settings20Regular } from "@fluentui/react-icons";
import { FolderTree } from "./widgets/folder-tree";

export default function Browser() {
    return (
        <>
            <Button icon={<Settings20Regular />}></Button>
            <FolderTree></FolderTree>
        </>
    )
}
