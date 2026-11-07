import path from 'node:path'
import {createHash} from 'node:crypto'
import {receivedDataTypes} from '../constants.js'

// Защита почтовых эндпоинтов от спама:
// - лимиты на IP (короткое окно и сутки) и общий суточный предохранитель;
// - минимальный интервал между заявками;
// - проверка типа и текста заявки;
// - отбрасывание повторной одинаковой заявки;
// - белый список типов файлов для анкеты с резюме.
// Состояние хранится в памяти процесса: при рестарте счётчики сбрасываются.

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

const WINDOW_MS = 10 * MINUTE        // окно для «всплеска» заявок с одного IP
const MAX_PER_WINDOW = 5             // не больше 5 заявок за 10 минут с одного IP
const MAX_PER_DAY = 40               // не больше 40 заявок за сутки с одного IP
const MIN_INTERVAL_MS = 3 * 1000     // между заявками с одного IP — не чаще раза в 3 секунды
const GLOBAL_MAX_PER_DAY = 300       // общий предохранитель: не больше 300 писем в сутки
const DEDUPE_WINDOW_MS = 15 * MINUTE // одинаковая заявка в этом окне повторно не отправляется
const MAX_TEXT_LENGTH = 5000
const MAX_CLIENTS = 5000             // защита памяти от раздувания карты IP

// Резюме присылают в PDF, DOC/DOCX, RTF, TXT, ODT или картинкой
const ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.ms-word',
    'application/rtf',
    'text/rtf',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp',
])
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.rtf', '.txt', '.odt', '.jpg', '.jpeg', '.png', '.webp'])

const clients = new Map() // ip -> {attempts: number[], lastAt: number, hashes: Map<string, number>}
let globalDay = ''
let globalCount = 0

const getClient = (ip) => {
    let client = clients.get(ip)
    if (!client) {
        client = {attempts: [], lastAt: 0, hashes: new Map()}
        clients.set(ip, client)
    }
    return client
}

const pruneClient = (client, now) => {
    client.attempts = client.attempts.filter(ts => now - ts < DAY)
    for (const [hash, expiresAt] of client.hashes) {
        if (expiresAt <= now) client.hashes.delete(hash)
    }
    return client
}

const pruneAll = (now) => {
    for (const [ip, client] of clients) {
        pruneClient(client, now)
        if (!client.attempts.length && !client.hashes.size) clients.delete(ip)
    }
}

// периодически чистим память; unref — чтобы таймер не мешал завершению процесса
setInterval(() => pruneAll(Date.now()), 30 * MINUTE).unref()

const dayKey = (now) => new Date(now).toISOString().slice(0, 10)

const tooManyRequests = (res, retryAfterSeconds, message = 'Слишком много заявок. Попробуйте позже.') => {
    res.set('Retry-After', String(Math.max(1, Math.ceil(retryAfterSeconds))))
    return res.status(429).json({error: message})
}

/**
 * Лимитер запросов к почтовым формам. Ставится до multer, чтобы отсекать спам
 * до загрузки файла в память.
 */
export function emailRateLimit(req, res, next) {
    const now = Date.now()
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'

    if (clients.size > MAX_CLIENTS) pruneAll(now)

    const today = dayKey(now)
    if (globalDay !== today) {
        globalDay = today
        globalCount = 0
    }
    if (globalCount >= GLOBAL_MAX_PER_DAY) {
        // общий лимит спасает почтовый ящик, если атакуют с разных IP
        res.set('Retry-After', '3600')
        return res.status(429).json({error: 'Отправка заявок временно недоступна. Пожалуйста, позвоните нам.'})
    }

    const client = pruneClient(getClient(ip), now)

    if (client.lastAt && now - client.lastAt < MIN_INTERVAL_MS) {
        return tooManyRequests(res, (MIN_INTERVAL_MS - (now - client.lastAt)) / 1000)
    }

    const inWindow = client.attempts.filter(ts => now - ts < WINDOW_MS)
    if (inWindow.length >= MAX_PER_WINDOW) {
        return tooManyRequests(res, (WINDOW_MS - (now - inWindow[0])) / 1000)
    }

    if (client.attempts.length >= MAX_PER_DAY) {
        return tooManyRequests(res, (DAY - (now - client.attempts[0])) / 1000)
    }

    client.attempts.push(now)
    client.lastAt = now
    globalCount += 1

    if (globalCount === GLOBAL_MAX_PER_DAY) {
        console.error(`Достигнут суточный лимит писем с форм: ${GLOBAL_MAX_PER_DAY}. Дальнейшие заявки будут отклоняться до следующих суток.`)
    }

    next()
}

const validatePayload = (type, text) => {
    const typeKey = String(type ?? '')
    if (!Object.hasOwn(receivedDataTypes, typeKey)) {
        return {ok: false, error: 'Некорректный тип заявки'}
    }

    if (typeof text !== 'string') return {ok: false, error: 'Некорректный текст заявки'}

    const value = text.trim()
    if (value.length < 3) return {ok: false, error: 'Заявка пустая'}
    if (value.length > MAX_TEXT_LENGTH) return {ok: false, error: 'Слишком длинный текст заявки'}

    return {ok: true, typeKey, text: value}
}

const submissionHash = (typeKey, text) => createHash('sha256').update(`${typeKey}\n${text}`).digest('base64url')

const isDuplicate = (ip, typeKey, text, now) => {
    const client = clients.get(ip)
    if (!client) return false
    const hash = submissionHash(typeKey, text)
    const expiresAt = client.hashes.get(hash)
    if (!expiresAt) return false
    if (expiresAt <= now) {
        client.hashes.delete(hash)
        return false
    }
    return true
}

// повторно запоминаем заявку только после успешной отправки:
// если SMTP упал, пользователь сможет повторить отправку
const rememberAfterSuccess = (req, res, typeKey, text) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    res.on('finish', () => {
        if (res.statusCode !== 200) return
        const client = getClient(ip)
        client.hashes.set(submissionHash(typeKey, text), Date.now() + DEDUPE_WINDOW_MS)
    })
}

const sanitizeFileName = (name) => {
    const base = path.basename(String(name || 'file'))
        .replace(/[\r\n"]/g, '')
        .trim()
        .slice(0, 200)
    return base || 'file'
}

/**
 * Проверка JSON-заявки: известный тип, осмысленный текст, отсутствие дубля.
 * Нормализует поля перед передачей в контроллер.
 */
export function validateEmailRequest(req, res, next) {
    const now = Date.now()
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    const payload = validatePayload(req.body?.type, req.body?.text)
    if (!payload.ok) return res.status(400).json({error: payload.error})

    if (isDuplicate(ip, payload.typeKey, payload.text, now)) {
        return res.status(200).json({message: 'Данные успешно получены'})
    }

    req.body.type = payload.typeKey
    req.body.text = payload.text
    rememberAfterSuccess(req, res, payload.typeKey, payload.text)
    next()
}

/**
 * Проверка заявки с файлом (анкета с резюме): тип файла по белому списку,
 * безопасное имя, известный тип заявки и текст.
 */
export function validateEmailAttachment(req, res, next) {
    if (!req.file) return res.status(400).json({error: 'Нет прикрепленного файла'})

    const now = Date.now()
    const ip = req.ip || req.socket?.remoteAddress || 'unknown'
    const mime = String(req.file.mimetype || '').toLowerCase()
    const ext = path.extname(req.file.originalname || '').toLowerCase()

    // проверяем и расширение, и MIME: подписанный «pdf» exe не пройдёт,
    // а octet-stream оставляем для DOC/DOCX, которые некоторые браузеры так и шлют
    const mimeAllowed = ALLOWED_MIME_TYPES.has(mime) || mime === 'application/octet-stream'
    if (!ALLOWED_EXTENSIONS.has(ext) || !mimeAllowed) {
        return res.status(400).json({error: 'Недопустимый тип файла. Прикрепите PDF, DOC/DOCX, RTF, TXT, ODT или изображение.'})
    }

    req.file.originalname = sanitizeFileName(req.file.originalname)

    const payload = validatePayload(req.body?.type, req.body?.text)
    if (!payload.ok) return res.status(400).json({error: payload.error})

    if (isDuplicate(ip, payload.typeKey, payload.text, now)) {
        return res.status(200).json({message: 'Письмо с прикрепленным файлом удачно доставлено'})
    }

    req.body.type = payload.typeKey
    req.body.text = payload.text
    rememberAfterSuccess(req, res, payload.typeKey, payload.text)
    next()
}
