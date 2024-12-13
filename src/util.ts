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
