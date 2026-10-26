import fs from 'fs'
import {promo} from '../clientBaza/db.js'
import * as promoService from '../clientBaza/promo/promoService.js'

const MAX_FILE_SIZE_MB = 5

// поле формы -> колонка promo
const UPLOAD_FIELDS = {
    file278: 'photo278',
    file585: 'photo585',
    file1200: 'photo1200',
}

const fail = (response, status, error) => {
    response.status(status)
    return {error}
}

// роутер AdminJS разбирает multipart через express-formidable, поэтому файлы приходят в request.payload
export const uploadPromoPhotos = async (request, response, context) => {
    if (context.currentAdmin?.role?.toLowerCase() === 'manager') {
        return fail(response, 403, 'Недостаточно прав для загрузки фото')
    }

    const recordId = Number(request.payload?.recordId)
    if (!Number.isInteger(recordId) || recordId <= 0) {
        return fail(response, 400, 'Не указан номер записи')
    }

    const uploads = Object.entries(UPLOAD_FIELDS)
        .map(([field, slot]) => ({slot, file: request.payload?.[field]}))
        .filter(({file}) => file?.path)

    try {
        if (!uploads.length) return fail(response, 400, 'Не передано ни одного файла')

        for (const {file} of uploads) {
            if (!file.type?.startsWith('image/')) {
                return fail(response, 400, `«${file.name}» не является изображением`)
            }
            if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                return fail(response, 400, `«${file.name}» больше ${MAX_FILE_SIZE_MB} МБ`)
            }
        }

        if (!await promo.findByPk(recordId)) {
            return fail(response, 404, `Запись №${recordId} не найдена`)
        }

        const buffers = {}
        for (const {slot, file} of uploads) {
            buffers[slot] = await fs.promises.readFile(file.path)
        }

        return {recordId, photos: await promoService.savePromoPhotosById(recordId, buffers)}
    } catch (error) {
        console.error('Error uploading promo photos:', error)
        return fail(response, 500, 'Не удалось сохранить фото')
    } finally {
        await Promise.all(uploads.map(({file}) => fs.promises.unlink(file.path).catch(() => {})))
    }
}
