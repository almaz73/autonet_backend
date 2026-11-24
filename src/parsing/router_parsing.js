// API модуля парсинга: приём объявлений от расширения и работа оператора с ними.
// защита отдельная от сайта — секретное слово из .env в заголовке X-Parsing-Secret
import express from 'express'
import {timingSafeEqual} from 'node:crypto'
import {saveAvitoCars, listAvitoCars, updateAvitoCar, deleteAvitoCar} from './parsingDb.js'

const router = express.Router()
const TEXT_FIELDS = ['auto', 'price', 'params', 'city', 'dealer', 'badge', 'collector', 'comment']
const EDITABLE_FIELDS = ['comment', 'user', 'state']
const MAX_LIMIT = 200

function secretMatches(provided, expected) {
    const a = Buffer.from(String(provided ?? ''))
    const b = Buffer.from(String(expected))
    return a.length === b.length && timingSafeEqual(a, b)
}

// секрет проверяем только на маршрутах модуля парсинга:
// router.use без пути в этом роутере (он смонтирован на /api) перехватил бы все /api-запросы сайта
function requireParsingSecret(req, res, next) {
    const expected = process.env.SECRET_WORD_PARSING
    if (!expected) {
        console.error('SECRET_WORD_PARSING не задан: endpoint модуля парсинга отключён')
        return res.status(503).json({error: 'Endpoint is not configured'})
    }
    if (!secretMatches(req.get('x-parsing-secret'), expected)) {
        return res.status(401).json({error: 'Invalid secret'})
    }
    next()
}

function parsePositiveInt(value) {
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) return null
    const number = Number(value)
    if (!Number.isSafeInteger(number) || number <= 0) return null
    return number
}

function parseState(value) {
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) return null
    const number = Number(value)
    if (!Number.isSafeInteger(number) || number < 0) return null
    return number
}

// id — числовой Авито ID, остальные поля приводим к тексту.
// state — статус обработки оператором, по умолчанию 1
function normalizeCar(item) {
    if (!item || typeof item !== 'object') return null

    const id = parsePositiveInt(item.id)
    if (id === null) return null

    let state = 1
    if (item.state !== undefined && item.state !== null && item.state !== '') {
        const parsed = parseState(item.state)
        if (parsed === null) return null
        state = parsed
    }

    const car = {id, state}
    for (const field of TEXT_FIELDS) {
        const value = item[field]
        car[field] = value === undefined || value === null ? null : String(value)
    }
    car.user = item.user === undefined || item.user === null ? null : String(item.user)
    return car
}

router.post('/addAvitoCars', requireParsingSecret, async (req, res) => {
    // принимаем как одно объявление, так и пачку
    const items = Array.isArray(req.body) ? req.body : [req.body]
    if (!items.length) return res.status(400).json({error: 'Empty payload'})

    const cars = []
    const invalid = []
    items.forEach((item, index) => {
        const car = normalizeCar(item)
        if (car) cars.push(car)
        else invalid.push(index)
    })

    if (invalid.length) {
        return res.status(400).json({error: 'Invalid car payload: id must be a positive number, state a non-negative integer', invalid})
    }

    try {
        const {saved, skipped} = await saveAvitoCars(cars)
        res.json({ok: true, saved, skipped})
    } catch (error) {
        console.error('Error saving parsed avito cars:', error)
        res.status(500).json({error: 'Failed to save parsed cars'})
    }
})

// список с пагинацией и фильтрами: ?page=1&limit=50&collector=...&state=1
router.get('/getAvitoCars', requireParsingSecret, async (req, res) => {
    const page = req.query.page === undefined ? 1 : parsePositiveInt(req.query.page)
    if (page === null) return res.status(400).json({error: 'page must be a positive integer'})

    let limit = 50
    if (req.query.limit !== undefined) {
        const parsedLimit = parsePositiveInt(req.query.limit)
        if (parsedLimit === null) return res.status(400).json({error: 'limit must be a positive integer'})
        limit = Math.min(parsedLimit, MAX_LIMIT)
    }

    const collector = typeof req.query.collector === 'string' && req.query.collector.trim()
        ? req.query.collector.trim()
        : null

    let state = null
    if (req.query.state !== undefined && req.query.state !== '') {
        state = parseState(req.query.state)
        if (state === null) return res.status(400).json({error: 'state must be a non-negative integer'})
    }

    try {
        const {items, total} = await listAvitoCars({page, limit, collector, state})
        res.json({ok: true, page, limit, total, pages: Math.ceil(total / limit), items})
    } catch (error) {
        console.error('Error listing parsed avito cars:', error)
        res.status(500).json({error: 'Failed to load parsed cars'})
    }
})

// редактирование: {id, comment?, user?, state?} — меняются только переданные поля
router.post('/updateAvitoCar', requireParsingSecret, async (req, res) => {
    const body = req.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return res.status(400).json({error: 'Body must be an object'})
    }

    const id = parsePositiveInt(body.id)
    if (id === null) return res.status(400).json({error: 'id must be a positive number'})

    const fields = {}
    for (const field of EDITABLE_FIELDS) {
        if (!(field in body)) continue

        if (field === 'state') {
            const state = parseState(body.state)
            if (state === null) return res.status(400).json({error: 'state must be a non-negative integer'})
            fields.state = state
        } else {
            fields[field] = body[field] === null ? null : String(body[field])
        }
    }

    if (!Object.keys(fields).length) {
        return res.status(400).json({error: `No fields to update: ${EDITABLE_FIELDS.join(', ')}`})
    }

    try {
        const item = await updateAvitoCar(id, fields)
        if (!item) return res.status(404).json({error: 'Car not found'})
        res.json({ok: true, item})
    } catch (error) {
        console.error('Error updating parsed avito car:', error)
        res.status(500).json({error: 'Failed to update parsed car'})
    }
})

router.delete('/deleteAvitoCar/:id', requireParsingSecret, async (req, res) => {
    const id = parsePositiveInt(req.params.id)
    if (id === null) return res.status(400).json({error: 'id must be a positive number'})

    try {
        const deleted = await deleteAvitoCar(id)
        if (!deleted) return res.status(404).json({error: 'Car not found'})
        res.json({ok: true, deleted})
    } catch (error) {
        console.error('Error deleting parsed avito car:', error)
        res.status(500).json({error: 'Failed to delete parsed car'})
    }
})

export default router
