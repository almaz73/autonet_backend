import {promo} from '../clientBaza/db.js'
import * as promoService from '../clientBaza/promo/promoService.js'

const PHOTO_SLOTS = ['photo278', 'photo585', 'photo1200']

const fail = (response, status, error) => {
    response.status(status)
    return {error}
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

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
            color: /^#[0-9a-fA-F]{6}$/.test(request.payload?.color ?? '') ? request.payload.color : '#007aff',
            fontSizePct: clamp(parseFloat(request.payload?.fontSizePct) || 7, 1, 25),
            xPct: clamp(parseFloat(request.payload?.xPct) || 50, 0, 100),
            yPct: clamp(parseFloat(request.payload?.yPct) || 85, 0, 100),
        }

        const photos = await promoService.applyPromoPhotoTextById(recordId, photoSlot, params)
        return {recordId, photos, restored: !params.text}
    } catch (error) {
        console.error('Error applying promo photo text:', error)
        return fail(response, 500, 'Не удалось сохранить текст на фото')
    }
}
