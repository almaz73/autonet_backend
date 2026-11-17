import {review} from '../clientBaza/db.js'

// Отзывы, оставленные на сайте: сохраняются скрытыми и публикуются после модерации.
// Защита от спама — капча в форме и лимиты на IP, как у почтовых заявок.

const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 3
const MIN_INTERVAL_MS = 15 * 1000
const MAX_CLIENTS = 5000
const MAX_FIO_LENGTH = 120
const MAX_TEXT_LENGTH = 5000

const clients = new Map()

const prune = (now) => {
    for (const [ip, entry] of clients) {
        entry.hits = entry.hits.filter((ts) => now - ts < WINDOW_MS)
        if (!entry.hits.length) clients.delete(ip)
    }
}

setInterval(() => prune(Date.now()), 30 * 60 * 1000).unref()

const tooManyRequests = (res, retryAfterSeconds) => {
    res.set('Retry-After', String(Math.max(1, Math.ceil(retryAfterSeconds))))
    return res.status(429).json({error: 'Слишком много отзывов. Попробуйте позже.'})
}

export function siteReviewRateLimit(req, res, next) {
    const now = Date.now()
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'

    if (clients.size > MAX_CLIENTS) prune(now)

    let entry = clients.get(ip)
    if (!entry) {
        entry = {hits: [], lastAt: 0}
        clients.set(ip, entry)
    }
    entry.hits = entry.hits.filter((ts) => now - ts < WINDOW_MS)

    if (entry.lastAt && now - entry.lastAt < MIN_INTERVAL_MS) {
        return tooManyRequests(res, (MIN_INTERVAL_MS - (now - entry.lastAt)) / 1000)
    }
    if (entry.hits.length >= MAX_PER_WINDOW) {
        return tooManyRequests(res, (WINDOW_MS - (now - entry.hits[0])) / 1000)
    }

    entry.hits.push(now)
    entry.lastAt = now
    next()
}

// схлопываем лишние пробелы, но сохраняем переносы строк в тексте отзыва
const cleanText = (value, maxLength) => String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength)

const today = () => new Date().toISOString().slice(0, 10)

export async function saveSiteReview(payload) {
    const fio = cleanText(payload?.fio, MAX_FIO_LENGTH).replace(/\n+/g, ' ')
    const text = cleanText(payload?.review, MAX_TEXT_LENGTH)
    const rating = Number(payload?.rating)

    if (fio.length < 2) return {error: 'Укажите имя'}
    if (text.length < 10) return {error: 'Отзыв слишком короткий'}
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return {error: 'Поставьте оценку от 1 до 5'}

    await review.create({
        platform: 'site',
        fio,
        date: today(),
        review: text,
        rating,
        published: false,
    })

    return {ok: true}
}
