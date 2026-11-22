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
