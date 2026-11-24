// parsing.sqlite: объявления, собранные расширением-парсером.
// база отдельная от client.sqlite: позже модуль целиком переедет на другой сервер
import path from 'path'
import {fileURLToPath} from 'url'
import sqlite3 from 'sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const PARSING_DB_PATH = path.resolve(__dirname, '../../parsing.sqlite')

// id — Авито ID объявления, остальные поля текстовые.
// saved_at ставит сервер при сохранении, user — оператор-обработчик, state — статус обработки
// language=SQLite
const CREATE_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS avito_cars
    (
        id        INTEGER PRIMARY KEY,
        auto      TEXT,
        price     TEXT,
        params    TEXT,
        city      TEXT,
        dealer    TEXT,
        badge     TEXT,
        collector TEXT,
        comment   TEXT,
        saved_at  TEXT,
        user      TEXT,
        state     INTEGER DEFAULT 1
    )
`

// базы, созданные до появления этих колонок, догоняем через ALTER TABLE
const EXTRA_COLUMNS = [
    ['saved_at', 'TEXT'],
    ['user', 'TEXT'],
    ['state', 'INTEGER DEFAULT 1'],
]

function ensureColumns() {
    return new Promise((resolve, reject) => {
        db.all('PRAGMA table_info(avito_cars)', (err, columns) => {
            if (err) return reject(err)

            const existing = new Set(columns.map(column => column.name))
            const missing = EXTRA_COLUMNS.filter(([name]) => !existing.has(name))
            if (!missing.length) return resolve()

            const sql = missing.map(([name, type]) => `ALTER TABLE avito_cars ADD COLUMN ${name} ${type}`).join('; ')
            db.exec(sql, (alterErr) => {
                if (alterErr) return reject(alterErr)
                resolve()
            })
        })
    })
}

const db = new sqlite3.Database(PARSING_DB_PATH, (err) => {
    if (err) console.error('Error opening parsing database', err.message)
})

// WAL + busy_timeout: чтение не блокирует запись, а при чужой блокировке
// запрос ждёт ограниченное время и завершается ошибкой вместо зависания
export const parsingDbReady = new Promise((resolve, reject) => {
    db.configure('busyTimeout', 5000)
    db.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        ${CREATE_TABLE_SQL}
    `, (err) => {
        if (err) {
            console.error('Error preparing parsing database', err)
            return reject(err)
        }
        ensureColumns().then(resolve, reject)
    })
})

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            err ? reject(err) : resolve(this)
        })
    })
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            err ? reject(err) : resolve(rows)
        })
    })
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            err ? reject(err) : resolve(row)
        })
    })
}

// уже сохранённые объявления пропускаем: повторная присылка того же id ничего не меняет
// language=SQLite
const INSERT_SQL = `
    INSERT OR IGNORE INTO avito_cars (id, auto, price, params, city, dealer, badge, collector, comment, saved_at, user, state)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), ?, ?)
`

// возвращает {saved, skipped}: skipped — id, которые уже были в базе
export async function saveAvitoCars(cars) {
    await parsingDbReady

    let saved = 0
    await run('BEGIN')
    try {
        for (const car of cars) {
            const result = await run(INSERT_SQL, [car.id, car.auto, car.price, car.params, car.city, car.dealer, car.badge, car.collector, car.comment, car.user, car.state])
            if (result.changes) saved++
        }
        await run('COMMIT')
    } catch (error) {
        await run('ROLLBACK').catch(() => {})
        throw error
    }

    return {saved, skipped: cars.length - saved}
}

// первый токен поля auto — им считается марка авто
const BRAND_SQL = `trim(substr(trim(auto), 1, instr(trim(auto) || ' ', ' ') - 1))`

// список объявлений: фильтры по сборщику, статусу, городу и марке, новые сверху
export async function listAvitoCars({page, limit, collector, state, city, brand}) {
    await parsingDbReady

    const conditions = []
    const params = []
    if (collector) {
        conditions.push('trim(collector) = ?')
        params.push(collector)
    }
    if (state !== null) {
        conditions.push('state = ?')
        params.push(state)
    }
    if (city) {
        conditions.push('trim(city) = ?')
        params.push(city)
    }
    if (brand) {
        conditions.push(`${BRAND_SQL} = ?`)
        params.push(brand)
    }
    const whereSql = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''

    const {total} = await get(`SELECT COUNT(*) AS total FROM avito_cars${whereSql}`, params)
    const items = await all(
        `SELECT * FROM avito_cars${whereSql} ORDER BY saved_at DESC, id DESC LIMIT ? OFFSET ?`,
        [...params, limit, (page - 1) * limit]
    )

    return {items, total}
}

// варианты для фильтров — из фактических данных базы
export async function getAvitoFilterOptions() {
    await parsingDbReady

    const values = async (sql) => (await all(sql)).map(row => row.value).filter(Boolean)
    const sortRu = (items) => items.sort((a, b) => a.localeCompare(b, 'ru'))

    const collectors = await values(`SELECT DISTINCT trim(collector) AS value FROM avito_cars WHERE collector IS NOT NULL AND trim(collector) <> ''`)
    const cities = await values(`SELECT DISTINCT trim(city) AS value FROM avito_cars WHERE city IS NOT NULL AND trim(city) <> ''`)
    const brands = await values(`SELECT DISTINCT ${BRAND_SQL} AS value FROM avito_cars WHERE auto IS NOT NULL AND trim(auto) <> ''`)
    const states = (await all(`SELECT DISTINCT state AS value FROM avito_cars WHERE state IS NOT NULL`))
        .map(row => Number(row.value))
        .filter(Number.isInteger)
        .sort((a, b) => a - b)

    return {
        collectors: sortRu(collectors),
        states,
        cities: sortRu(cities),
        brands: sortRu(brands),
    }
}

// fields — только разрешённые роутером колонки, значения уже нормализованы
export async function updateAvitoCar(id, fields) {
    await parsingDbReady

    const columns = Object.keys(fields)
    if (!columns.length) return null

    const assignments = columns.map(column => `${column} = ?`).join(', ')
    const values = columns.map(column => fields[column])
    const result = await run(`UPDATE avito_cars SET ${assignments} WHERE id = ?`, [...values, id])
    if (!result.changes) return null

    return get('SELECT * FROM avito_cars WHERE id = ?', [id])
}

export async function deleteAvitoCar(id) {
    await parsingDbReady

    const result = await run('DELETE FROM avito_cars WHERE id = ?', [id])
    return result.changes
}
