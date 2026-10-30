import fs from 'fs'
import {saveDealerPhoto} from '../clientBaza/dealers/dealerPhoto.js'

const MAX_FILE_SIZE_MB = 8

const fail = (response, status, error) => {
    response.status(status)
    return {error}
}

// роутер AdminJS разбирает multipart через express-formidable, поэтому файл приходит в request.payload
export const uploadDealerPhoto = async (request, response) => {
    const recordId = Number(request.payload?.recordId)
    if (!Number.isInteger(recordId) || recordId <= 0) {
        return fail(response, 400, 'Не указан номер записи')
    }

    const file = request.payload?.photo
    if (!file?.path) return fail(response, 400, 'Не передан файл')

    try {
        if (!file.type?.startsWith('image/')) {
            return fail(response, 400, `«${file.name}» не является изображением`)
        }
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            return fail(response, 400, `«${file.name}» больше ${MAX_FILE_SIZE_MB} МБ`)
        }

        const buffer = await fs.promises.readFile(file.path)
        const url = await saveDealerPhoto(recordId, buffer)
        if (!url) return fail(response, 404, `Запись №${recordId} не найдена`)
        return {url}
    } catch (error) {
        console.error('Error uploading dealer photo:', error)
        return fail(response, 500, 'Не удалось сохранить фото')
    } finally {
        await fs.promises.unlink(file.path).catch(() => {})
    }
}
