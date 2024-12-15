import { HTMLAttributes } from "react";
import { Folder } from "../backend";
import { Button, Text } from "@fluentui/react-components";
import { Folder48Filled } from "@fluentui/react-icons";
import { SelectableClassTag } from "./items-grid";
import { encodeId } from "../util";

export default function FolderPreview({ folder, ...props }: { folder: Folder } & HTMLAttributes<HTMLButtonElement>) {
    return (
        <Button
            {...props}
            id={encodeId(folder.id, "folder")}
            className={`flex flex-col gap-2 ${SelectableClassTag}`}
            appearance="subtle"
        >
            <Folder48Filled />
            <Text align="center">{folder.name}</Text>
        </Button>
    )
}
