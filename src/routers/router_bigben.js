// API для внутренней витрины BigBen: parsing.sqlite страницами, фильтры, правка и удаление.
// вход — по учёткам администраторов с ролью call_center_operator (раздел «Администраторы»)
import Router from 'express'
import jwt from 'jsonwebtoken'
import {Admins} from '../clientBaza/db.js'
import {listAvitoCars, getAvitoFilterOptions, updateAvitoCar, deleteAvitoCar} from '../parsing/parsingDb.js'

const router = new Router()
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const EDITABLE_FIELDS = ['comment', 'state']
const BIGBEN_ROLE = 'call_center_operator'
const TOKEN_TTL = '8h'

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) throw new Error('JWT_SECRET не задан: добавьте секрет в .env')

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

function queryString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null
}

// лимит попыток входа: 10 за 15 минут с одного IP
const LOGIN_ATTEMPTS_LIMIT = 10
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const loginAttempts = new Map()

function loginRateLimit(req, res, next) {
    const now = Date.now()
    if (loginAttempts.size > 1000) {
        for (const [ip, entry] of loginAttempts) {
            if (entry.resetAt <= now && entry.blockedUntil <= now) loginAttempts.delete(ip)
        }
    }

    let entry = loginAttempts.get(req.ip)
    if (!entry || entry.resetAt <= now) {
        entry = {count: 0, resetAt: now + LOGIN_WINDOW_MS, blockedUntil: 0}
        loginAttempts.set(req.ip, entry)
    }

    if (entry.blockedUntil > now) {
        res.set('Retry-After', String(Math.ceil((entry.blockedUntil - now) / 1000)))
        return res.status(429).json({error: 'Слишком много попыток входа. Попробуйте позже.'})
    }

    if (entry.count >= LOGIN_ATTEMPTS_LIMIT) {
        entry.blockedUntil = now + LOGIN_WINDOW_MS
        res.set('Retry-After', String(Math.ceil(LOGIN_WINDOW_MS / 1000)))
        return res.status(429).json({error: 'Слишком много попыток входа. Попробуйте позже.'})
    }

    entry.count += 1
    // успешный вход сбрасывает счётчик
    res.on('finish', () => {
        if (res.statusCode === 200) loginAttempts.delete(req.ip)
    })
    next()
}

// токен выдаём на 8 часов; имя оператора берём из записи администратора
router.post('/login', loginRateLimit, async (req, res) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!email || !password) return res.status(400).json({error: 'Укажите e-mail и пароль'})

    try {
        const admin = await Admins.findOne({where: {email}})
        if (!admin || admin.password !== password || admin.role !== BIGBEN_ROLE) {
            return res.status(401).json({error: 'Неверный e-mail или пароль'})
        }

        const token = jwt.sign(
            {id: admin.id, name: admin.name, email: admin.email, role: admin.role},
            jwtSecret,
            {expiresIn: TOKEN_TTL},
        )
        res.json({ok: true, token, operator: {name: admin.name}})
    } catch (error) {
        console.error('Error during BigBen login:', error)
        res.status(500).json({error: 'Не удалось выполнить вход'})
    }
})

// остальные методы — только с токеном оператора
function requireOperator(req, res, next) {
    const header = req.get('authorization') || ''
    const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
    if (!token) return res.status(401).json({error: 'Требуется вход'})

    try {
        const payload = jwt.verify(token, jwtSecret)
        if (!payload || payload.role !== BIGBEN_ROLE) {
            return res.status(403).json({error: 'Нет доступа к BigBen'})
        }
        req.operator = payload
        next()
    } catch {
        return res.status(401).json({error: 'Сессия истекла, войдите заново'})
    }
}

router.use(requireOperator)

// ?page=1&limit=50&collector=...&state=1&city=...&brand=...
router.get('/cars', async (req, res) => {
    const page = req.query.page === undefined ? 1 : parsePositiveInt(req.query.page)
    if (page === null) return res.status(400).json({error: 'page must be a positive integer'})

    let limit = DEFAULT_LIMIT
    if (req.query.limit !== undefined) {
        const parsedLimit = parsePositiveInt(req.query.limit)
        if (parsedLimit === null) return res.status(400).json({error: 'limit must be a positive integer'})
        limit = Math.min(parsedLimit, MAX_LIMIT)
    }

    let state = null
    if (req.query.state !== undefined && req.query.state !== '') {
        state = parseState(req.query.state)
        if (state === null) return res.status(400).json({error: 'state must be a non-negative integer'})
    }

    const filters = {
        collector: queryString(req.query.collector),
        state,
        city: queryString(req.query.city),
        brand: queryString(req.query.brand),
    }

    try {
        const {items, total} = await listAvitoCars({page, limit, ...filters})
        res.json({ok: true, page, limit, total, pages: Math.ceil(total / limit), items})
    } catch (error) {
        console.error('Error listing parsing database for BigBen:', error)
        res.status(500).json({error: 'Failed to load parsed cars'})
    }
})

// варианты фильтров: сборщики, статусы, города и марки (первое слово поля auto)
router.get('/filters', async (req, res) => {
    try {
        res.json({ok: true, ...await getAvitoFilterOptions()})
    } catch (error) {
        console.error('Error loading parsing filters for BigBen:', error)
        res.status(500).json({error: 'Failed to load filters'})
    }
})

// правка строки: comment и state из запроса, оператор — всегда из токена
router.post('/cars/:id', async (req, res) => {
    const id = parsePositiveInt(req.params.id)
    if (id === null) return res.status(400).json({error: 'id must be a positive number'})

    const body = req.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return res.status(400).json({error: 'Body must be an object'})
    }

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

    fields.user = String(req.operator.name)

    try {
        const item = await updateAvitoCar(id, fields)
        if (!item) return res.status(404).json({error: 'Car not found'})
        res.json({ok: true, item})
    } catch (error) {
        console.error('Error updating parsed avito car:', error)
        res.status(500).json({error: 'Failed to update parsed car'})
    }
})

router.delete('/cars/:id', async (req, res) => {
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
