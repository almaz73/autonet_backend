import {createHmac, randomBytes, timingSafeEqual} from 'node:crypto'

// Серверная капча для форм: сдвиг цели выдаёт сервер, ответ проверяется на сервере,
// а в /api/postEmail обязателен одноразовый токен, полученный после решения.
// Состояние в памяти процесса: при рестарте невыполненные капчи сбрасываются.

const CHALLENGE_TTL_MS = 30 * 60 * 1000
const TOKEN_TTL_MS = 30 * 60 * 1000
const MAX_CHALLENGES = 20000
const MAX_ATTEMPTS = 10
const OFFSET_FROM = 5
const OFFSET_TO = 78
const TOLERANCE = 1

const challenges = new Map() // id -> {offset, verified, used, attempts, createdAt}

const secret = (() => {
    const value = process.env.CAPTCHA_SECRET || process.env.ADMIN_SESSION_SECRET
    if (value) return value
    if (process.env.NODE_ENV === 'production') {
        throw new Error('CAPTCHA_SECRET или ADMIN_SESSION_SECRET обязателен в production')
    }
    console.warn('CAPTCHA_SECRET не задан — сгенерирован временный секрет, токены сбросятся при рестарте')
    return randomBytes(48).toString('base64url')
})()

const prune = (now = Date.now()) => {
    for (const [id, challenge] of challenges) {
        if (now - challenge.createdAt > CHALLENGE_TTL_MS) challenges.delete(id)
    }
    // карта не должна расти бесконечно: вытесняем самые старые
    while (challenges.size > MAX_CHALLENGES) {
        const oldest = challenges.keys().next().value
        challenges.delete(oldest)
    }
}

setInterval(() => prune(), 5 * 60 * 1000).unref()

const sign = (id, expiresAt) => createHmac('sha256', secret).update(id + '.' + expiresAt).digest('base64url')

const parseToken = (token) => {
    if (typeof token !== 'string') return null
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [id, expiresAtRaw, signature] = parts
    const expiresAt = Number(expiresAtRaw)
    if (!id || !Number.isFinite(expiresAt)) return null
    if (expiresAt <= Date.now()) return null

    const expected = Buffer.from(sign(id, expiresAt))
    const received = Buffer.from(signature)
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null

    return {id, expiresAt}
}

/** GET /api/captcha — выдаёт id и позицию цели; сам пазл рисует фронт */
export function issueCaptcha(req, res) {
    const now = Date.now()
    prune(now)

    const id = randomBytes(16).toString('base64url')
    const offset = Math.floor(Math.random() * (OFFSET_TO - OFFSET_FROM + 1)) + OFFSET_FROM
    challenges.set(id, {offset, verified: false, used: false, attempts: 0, createdAt: now})

    res.set('Cache-Control', 'no-store')
    res.status(200).json({id, offset})
}

/** POST /api/captcha/verify — сверяет сдвиг и выдаёт одноразовый токен для заявки */
export function verifyCaptcha(req, res) {
    const now = Date.now()
    prune(now)

    const id = typeof req.body?.id === 'string' ? req.body.id : ''
    const answer = Number(req.body?.answer)
    const challenge = challenges.get(id)

    if (!challenge || now - challenge.createdAt > CHALLENGE_TTL_MS) {
        return res.status(400).json({error: 'Капча устарела, обновите страницу'})
    }
    if (!Number.isFinite(answer)) {
        return res.status(400).json({error: 'Некорректный ответ капчи'})
    }

    challenge.attempts += 1
    if (challenge.attempts > MAX_ATTEMPTS) {
        challenges.delete(id)
        return res.status(400).json({error: 'Капча устарела, обновите страницу'})
    }

    if (Math.abs(challenge.offset - answer) >= TOLERANCE) {
        return res.status(400).json({error: 'Квадрат не совпал с целью, попробуйте ещё раз'})
    }

    challenge.verified = true
    const expiresAt = now + TOKEN_TTL_MS
    res.set('Cache-Control', 'no-store')
    res.status(200).json({token: id + '.' + expiresAt + '.' + sign(id, expiresAt)})
}

/**
 * Middleware для почтовых заявок: без решённой капчи письмо не уходит.
 * Токен гасим только после успешной отправки, чтобы при сбое SMTP можно было повторить.
 */
export function requireCaptcha(req, res, next) {
    const parsed = parseToken(req.body?.captchaToken)
    if (!parsed) {
        return res.status(400).json({error: 'Подтвердите, что вы не робот, и отправьте заявку ещё раз'})
    }

    const challenge = challenges.get(parsed.id)
    if (!challenge || !challenge.verified || challenge.used) {
        return res.status(400).json({error: 'Подтвердите, что вы не робот, и отправьте заявку ещё раз'})
    }

    res.on('finish', () => {
        if (res.statusCode === 200) challenge.used = true
    })
    next()
}
