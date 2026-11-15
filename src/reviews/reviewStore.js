import {review, dbReady} from '../clientBaza/db.js'

const REVIEW_FIELDS = ['fio', 'date', 'review', 'link', 'respondent', 'dateAnswer', 'answer']

// сохранение собранных отзывов: повторный сбор обновляет запись, а не создаёт дубль
export async function saveReviews(platform, items) {
    await dbReady

    let added = 0
    let updated = 0

    for (const item of items) {
        const values = {platform, external_id: item.external_id || null}
        for (const field of REVIEW_FIELDS) values[field] = item[field] ?? null

        // без внешнего id ищем по совокупности полей отзыва
        const existing = item.external_id
            ? await review.findOne({where: {platform, external_id: item.external_id}})
            : await review.findOne({where: {platform, link: values.link, fio: values.fio, date: values.date}})

        if (existing) {
            await existing.update(values)
            updated++
        } else {
            await review.create(values)
            added++
        }
    }

    return {added, updated}
}
