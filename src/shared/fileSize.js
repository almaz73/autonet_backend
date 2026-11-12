// размер файла в человекочитаемом виде: 512 Б, 152 кб, 2,3 МБ
export function formatFileSize(bytes) {
    const size = Number(bytes)
    if (!Number.isFinite(size) || size <= 0) return '—'
    if (size < 1024) return `${Math.round(size)} Б`
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} кб`
    return `${(size / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`
}
