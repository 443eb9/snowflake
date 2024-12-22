import { Input, InputProps } from "@fluentui/react-components";

export default function ResponsiveInput({ onCancel, onConfirm, ...props }: InputProps & { onConfirm: (target: HTMLInputElement) => void, onCancel: (target: HTMLInputElement) => void }) {
    return (
        <Input
            {...props}
            onKeyDown={ev => {
                console.log(ev)
                if (ev.key == "Enter") {
                    ev.currentTarget.blur()
                    onConfirm(ev.currentTarget)
                } else if (ev.key == "Escape") {
                    ev.currentTarget.blur()
                }
            }}
            onBlur={ev => onConfirm(ev.currentTarget)}
        />
    )
}
