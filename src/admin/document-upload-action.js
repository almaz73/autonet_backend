import fs from 'fs'
import {saveDocumentFile} from '../clientBaza/documents/documentFiles.js'

const MAX_FILE_SIZE_MB = 25

const fail = (response, status, error) => {
    response.status(status)
    return {error}
}

// роутер AdminJS разбирает multipart через express-formidable, поэтому файл приходит в request.payload
export const uploadDocumentFile = async (request, response, context) => {
    if (context.currentAdmin?.role?.toLowerCase() === 'manager') {
        return fail(response, 403, 'Недостаточно прав для загрузки документов')
    }

    const file = request.payload?.document
    if (!file?.path) return fail(response, 400, 'Не передан файл')

    try {
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            return fail(response, 400, `«${file.name}» больше ${MAX_FILE_SIZE_MB} МБ`)
        }

        const buffer = await fs.promises.readFile(file.path)
        return await saveDocumentFile(file.name, buffer)
    } catch (error) {
        console.error('Error uploading document:', error)
        return fail(response, error.statusCode || 500, error.statusCode ? error.message : 'Не удалось сохранить документ')
    } finally {
        await fs.promises.unlink(file.path).catch(() => {})
    }
}
