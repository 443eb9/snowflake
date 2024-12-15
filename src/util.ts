import { ItemId, Item, ItemTy } from "./backend"

const units = ["B", "KB", "MB", "GB"]

export function formatFileSize(bytes: number, precision = 1) {
    let value = bytes
    let unit = 0
    while (value > 1024 && unit < units.length - 1) {
        value /= 1024
        unit++
    }

    const p = Math.pow(10, precision)
    const x = Math.round(value * p) / p
    return `${x} ${units[unit]}`
}

export function encodeId(id: string, ty: ItemTy) {
    return `${ty}/${id}`
}

export function decodeId(id: string): ItemId {
    const s = id.split("/")
    return { id: s[1], ty: s[0] as ItemTy }
}

export function decodeItem(item: Item): { ty: ItemTy, id: string } {
    const obj = Object.entries(item)[0]
    return { ty: obj[0] as ItemTy, id: obj[1] }
}
