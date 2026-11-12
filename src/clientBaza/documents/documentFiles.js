import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {documents} from '../db.js'
import {transliterate} from '../../shared/transliterate.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// файлы храним в двух местах: public — источник для сборки Vite,
// front — то, что реально раздаёт сервер
export const PUBLIC_UPLOAD_DIR = path.resolve(__dirname, '../../../../autonet/public/st/upload')
export const FRONT_UPLOAD_DIR = path.resolve(__dirname, '../../../../front/st/upload')
const UPLOAD_DIRS = [PUBLIC_UPLOAD_DIR, FRONT_UPLOAD_DIR]

export const DOCUMENT_LINK_PREFIX = '/st/upload'

const FORMATS = {
    pdf: 'PDF',
    doc: 'DOC',
    docx: 'DOCX',
    rtf: 'RTF',
    xls: 'XLS',
    xlsx: 'XLSX',
    odt: 'ODT',
    ods: 'ODS',
    txt: 'TXT',
    csv: 'CSV',
    zip: 'ZIP',
    jpg: 'JPG',
    jpeg: 'JPEG',
    png: 'PNG',
}

export const ALLOWED_FORMATS = new Set(Object.keys(FORMATS))

export const formatFromName = (fileName) => {
    const ext = path.extname(String(fileName ?? '')).slice(1).toLowerCase()
    return FORMATS[ext] || ''
}

const nameFromFile = (fileName) => {
    const base = path.basename(String(fileName ?? ''), path.extname(String(fileName ?? '')))
    const text = transliterate(base).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Документ'
}

const describeFile = (fileName) => ({
    file: fileName,
    name: nameFromFile(fileName),
    format: formatFromName(fileName) || path.extname(fileName).slice(1).toUpperCase(),
    size: fs.statSync(path.join(FRONT_UPLOAD_DIR, fileName)).size,
    link: `${DOCUMENT_LINK_PREFIX}/${encodeURIComponent(fileName)}`,
    kind: 'secondary',
    priority: 0,
    published: false,
})

// новые файлы из папки добавляем в базу как неопубликованные второстепенные:
// на сайте они появятся только после включения флага «Показывать на сайте»
export async function syncDocuments() {
    await fs.promises.mkdir(FRONT_UPLOAD_DIR, {recursive: true})

    const files = (await fs.promises.readdir(FRONT_UPLOAD_DIR, {withFileTypes: true}))
        .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
        .map((entry) => entry.name)

    if (!files.length) return []

    const existing = await documents.findAll({attributes: ['file'], raw: true})
    const known = new Set(existing.map((row) => row.file))
    const added = []

    for (const fileName of files) {
        if (known.has(fileName)) continue
        try {
            added.push(await documents.create(describeFile(fileName)))
        } catch (error) {
            // параллельная синхронизация уже добавила этот файл
            if (!/unique/i.test(error.message)) {
                console.error(`Не удалось добавить документ ${fileName}:`, error.message)
            }
        }
    }

    if (added.length) console.log(`Синхронизация документов: добавлено ${added.length}`)
    return added
}

// имя файла делаем безопасным для URL: латиница, цифры, дефис и подчёркивание
const safeFileName = (originalName) => {
    const ext = path.extname(String(originalName ?? '')).slice(1).toLowerCase()
    const base = transliterate(path.basename(String(originalName ?? ''), path.extname(String(originalName ?? ''))))
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '') || 'document'

    let fileName = `${base}.${ext}`
    let index = 1
    while (UPLOAD_DIRS.some((dir) => fs.existsSync(path.join(dir, fileName)))) {
        fileName = `${base}-${index++}.${ext}`
    }
    return fileName
}

export async function saveDocumentFile(originalName, buffer) {
    const ext = path.extname(String(originalName ?? '')).slice(1).toLowerCase()
    if (!ALLOWED_FORMATS.has(ext)) {
        const error = new Error(`Формат «${ext || 'без расширения'}» не поддерживается`)
        error.statusCode = 400
        throw error
    }

    const fileName = safeFileName(originalName)
    await Promise.all(UPLOAD_DIRS.map((dir) => fs.promises.mkdir(dir, {recursive: true})))
    await Promise.all(UPLOAD_DIRS.map((dir) => fs.promises.writeFile(path.join(dir, fileName), buffer)))

    return {
        file: fileName,
        name: nameFromFile(fileName),
        format: FORMATS[ext],
        size: buffer.length,
        link: `${DOCUMENT_LINK_PREFIX}/${encodeURIComponent(fileName)}`,
    }
}

// удаляем сам файл вместе с записью: иначе синхронизация вернёт его в список
export async function removeDocumentFile(fileName) {
    const name = path.basename(String(fileName ?? ''))
    if (!name || name === '.' || name === '..') return false

    let removed = false
    for (const dir of UPLOAD_DIRS) {
        const target = path.join(dir, name)
        // удаляем только внутри папок загрузки
        if (!target.startsWith(`${dir}${path.sep}`)) continue
        try {
            await fs.promises.unlink(target)
            removed = true
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`Не удалось удалить файл документа ${name}:`, error.message)
            }
        }
    }
    return removed
}
