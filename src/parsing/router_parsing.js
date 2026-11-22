// приём объявлений от расширения-парсера: POST /api/addAvitoCars
// защита отдельная от сайта — секретное слово из .env в заголовке X-Parsing-Secret
import express from 'express'
import {timingSafeEqual} from 'node:crypto'
import {saveAvitoCars} from './parsingDb.js'

const router = express.Router()
const TEXT_FIELDS = ['auto', 'price', 'params', 'city', 'dealer', 'badge', 'collector', 'comment']

function secretMatches(provided, expected) {
    const a = Buffer.from(String(provided ?? ''))
    const b = Buffer.from(String(expected))
    return a.length === b.length && timingSafeEqual(a, b)
}

// id — числовой Авито ID, остальные поля приводим к тексту.
// state — статус обработки оператором, по умолчанию 1
function normalizeCar(item) {
    if (!item || typeof item !== 'object') return null

    const id = Number(item.id)
    if (!Number.isSafeInteger(id) || id <= 0) return null

    let state = 1
    if (item.state !== undefined && item.state !== null && item.state !== '') {
        state = Number(item.state)
        if (!Number.isSafeInteger(state) || state < 0) return null
    }

    const car = {id, state}
    for (const field of TEXT_FIELDS) {
        const value = item[field]
        car[field] = value === undefined || value === null ? null : String(value)
    }
    car.user = item.user === undefined || item.user === null ? null : String(item.user)
    return car
}

router.post('/addAvitoCars', async (req, res) => {
    const expected = process.env.SECRET_WORD_PARSING
    if (!expected) {
        console.error('SECRET_WORD_PARSING не задан: endpoint /api/addAvitoCars отключён')
        return res.status(503).json({error: 'Endpoint is not configured'})
    }

    if (!secretMatches(req.get('x-parsing-secret'), expected)) {
        return res.status(401).json({error: 'Invalid secret'})
    }

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
        const saved = await saveAvitoCars(cars)
        res.json({ok: true, saved})
    } catch (error) {
        console.error('Error saving parsed avito cars:', error)
        res.status(500).json({error: 'Failed to save parsed cars'})
    }
})

export default router
