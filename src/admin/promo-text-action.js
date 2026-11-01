import {promo} from '../clientBaza/db.js'
import * as promoService from '../clientBaza/promo/promoService.js'

const PHOTO_SLOTS = ['photo278', 'photo585', 'photo1200']

const fail = (response, status, error) => {
    response.status(status)
    return {error}
}

// promo.styles: массив настроек надписи по фото; раньше здесь лежал CSS текста акции,
// поэтому нечитаемое значение считаем пустым
const parseStyles = (value) => {
    try {
        const parsed = JSON.parse(value ?? '[]')
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

// promo.inscription: массив текстов по фото; ранее здесь хранился один текст на всю акцию
const parseInscriptions = (value) => {
    try {
        const parsed = JSON.parse(value ?? '[]')
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

// запись в массив: значение текущего фото заменяем, остальные сохраняем в порядке фото
const mergeByPhoto = (existing, photoSlot, entry) => PHOTO_SLOTS
    .map((slot) => slot === photoSlot ? {photo: slot, ...entry} : existing.find((item) => item?.photo === slot))
    .filter(Boolean)

// «лепим» текст на фото акции: рисуем SVG-слой поверх исходника (_blank)
export const applyPromoPhotoText = async (request, response, context) => {
    if (context.currentAdmin?.role?.toLowerCase() === 'manager') {
        return fail(response, 403, 'Недостаточно прав для изменения фото')
    }

    const recordId = Number(request.payload?.recordId)
    if (!Number.isInteger(recordId) || recordId <= 0) {
        return fail(response, 400, 'Не указан номер записи')
    }

    const photoSlot = request.payload?.photoSlot
    if (!PHOTO_SLOTS.includes(photoSlot)) {
        return fail(response, 400, 'Неизвестное фото')
    }

    try {
        const record = await promo.findByPk(recordId)
        if (!record) return fail(response, 404, `Запись №${recordId} не найдена`)
        if (!record[photoSlot]) return fail(response, 400, 'Сначала загрузите фото')

        const params = {
            text: String(request.payload?.text ?? '').slice(0, 500),
            color: /^#[0-9a-fA-F]{6}$/.test(request.payload?.color ?? '') ? request.payload.color : '#ffffff',
            fontSize: request.payload?.fontSize,
            x: request.payload?.x,
            y: request.payload?.y,
        }

        const {photos, style} = await promoService.applyPromoPhotoTextById(recordId, photoSlot, params)

        // храним настройки массивом по фото, чтобы панель открывалась с прошлыми значениями
        const styles = mergeByPhoto(parseStyles(record.styles), photoSlot, style)
        const inscriptions = mergeByPhoto(parseInscriptions(record.inscription), photoSlot, {text: params.text})

        // запоминаем текст надписи и её настройки, чтобы редактор открывался с ними
        await record.update({
            inscription: JSON.stringify(inscriptions),
            styles: JSON.stringify(styles),
        })
        return {recordId, photos, inscriptions, styles, restored: !params.text}
    } catch (error) {
        console.error('Error applying promo photo text:', error)
        return fail(response, 500, 'Не удалось сохранить текст на фото')
    }
}
