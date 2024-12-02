import { Button } from "@fluentui/react-components"
import { Delete20Regular, Edit20Regular } from "@fluentui/react-icons"

export default function FileManipulation({
    deleteCallback, renameCallback, disableDelete, disableRename, disabled
}: {
    deleteCallback?: () => void, renameCallback?: () => void, disableDelete?: boolean, disableRename?: boolean, disabled?: boolean
}) {
    return (
        <div className="flex gap-1">
            <Button icon={<Delete20Regular />} disabled={disableDelete || disabled} onClick={deleteCallback} />
            <Button icon={<Edit20Regular />} disabled={disableRename || disabled} onClick={renameCallback} />
        </div>
    )
}
