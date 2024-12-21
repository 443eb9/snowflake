import { ItemId, Item, ItemTy, Asset, Collection, Tag } from "./backend"

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
    if (s.length != 2) { throw new Error(`Invalid id ${id}`) }
    return { id: s[1], ty: s[0] as ItemTy }
}

export function decodeItem(item: Item): { ty: "asset", data: Asset } | { ty: "collection", data: Collection } | { ty: "tag", data: Tag } {
    const obj = Object.entries(item)[0]
    return { ty: obj[0] as ItemTy, data: obj[1] }
}

export function GetNodeId(node: HTMLElement) {
    if (!node) { return null }
    let cur = node
    while (cur.id.length == 0) {
        if (cur.parentElement) {
            cur = cur.parentElement
        } else {
            return null
        }
    }
    return cur.id
}
