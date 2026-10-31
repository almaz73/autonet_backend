import path from "path";
import fs from "fs";
import {fileURLToPath} from "url";
import {open} from "sqlite";
import sqlite3 from "sqlite3";
import {FolderLINKS, isToday} from "../../constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLIENT_DB_PATH = path.resolve(__dirname, '../../../client.sqlite')
const CAR_PREFIX = 'https://xn--80aej9aped4f.xn--p1ai/cars/'
const DAY_MS = 1000 * 60 * 60 * 24

// 1. Сохранить авто, добавленные за сегодня, объединив с уже записанными сегодня
// 2. Сохранить удалённые авто: один период продажи на авто, без повторов
export async function _updHistory(dbPath = CLIENT_DB_PATH) {
    const db = await open({filename: dbPath, driver: sqlite3.Database})
    try {
        await db.exec('PRAGMA busy_timeout = 5000')
        await createTables(db)

        await db.exec('BEGIN')
        try {
            const addedText = await saveNewCarsForThisDay(db)
            const deletedText = await saveDeletedCarsForThisDay(db)
            await db.exec('COMMIT')
            return `${addedText} ${deletedText}`
        } catch (e) {
            await db.exec('ROLLBACK')
            throw e
        }
    } finally {
        await db.close()
    }
}

async function createTables(db) {
    // language=SQLite
    await db.exec(`
        CREATE TABLE IF NOT EXISTS history
        (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            date       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            count      INTEGER NOT NULL,
            carsPerDay TEXT    NOT NULL
        )
    `)
    // language=SQLite
    await db.exec(`
        CREATE TABLE IF NOT EXISTS history_period
        (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            car         TEXT,
            startedDate TEXT,
            endDate     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            days        INTEGER
        )
    `)
}

// файлы прошлого запуска не должны попадать в сегодняшнюю историю
function readTodayLinksFile(name) {
    const filePath = path.join(FolderLINKS, name)
    try {
        const timeUpdateFile = fs.statSync(filePath)
        if (!isToday(new Date(timeUpdateFile.mtime))) return []
        const content = fs.readFileSync(filePath, 'utf8').trim()
        return content ? JSON.parse(content) : []
    } catch (e) {
        if (e.code !== 'ENOENT') console.log(`_updHistory: не удалось прочитать ${name}:`, e.message)
        return []
    }
}

function toCarLink(loc) {
    const link = String(loc || '')
    if (!link.startsWith(CAR_PREFIX)) return null
    return link.slice(CAR_PREFIX.length)
}

function isUsableCar(car) {
    return Boolean(car) && !car.includes('null')
}

async function saveNewCarsForThisDay(db) {
    const newToday = [...new Set(
        readTodayLinksFile('_newAuto.js')
            .map(toCarLink)
            .filter(isUsableCar)
    )]

    // language=SQLite
    const todayRow = await db.get(`
        SELECT id, carsPerDay
        FROM history
        WHERE date(date) = date('now', 'localtime')
        ORDER BY date ASC
        LIMIT 1
    `)

    const savedToday = todayRow?.carsPerDay ? todayRow.carsPerDay.split(',').filter(Boolean) : []
    const allToday = [...new Set([...savedToday, ...newToday])]
    if (!allToday.length) return 'Новых авто за сегодня: 0.'

    if (todayRow) { // уже есть запись за сегодня - дополняем её
        // language=SQLite
        await db.run(`
            UPDATE history
            SET date = datetime('now', 'localtime'), count = ?, carsPerDay = ?
            WHERE id = ?
        `, allToday.length, allToday.join(','), todayRow.id)
    } else {
        // language=SQLite
        await db.run(`
            INSERT INTO history (date, count, carsPerDay)
            VALUES (datetime('now', 'localtime'), ?, ?)
        `, allToday.length, allToday.join(','))
    }

    return `Новых авто за сегодня: ${allToday.length} (+${allToday.length - savedToday.length}).`
}

async function saveDeletedCarsForThisDay(db) {
    const deleted = new Map()

    for (const item of readTodayLinksFile('_oldAuto.js')) {
        const car = toCarLink(typeof item === 'string' ? item : item?.loc)
        if (!isUsableCar(car) || deleted.has(car)) continue
        const lastmod = typeof item === 'string' ? null : item?.lastmod || null
        deleted.set(car, lastmod)
    }

    let inserted = 0
    for (const [car, lastmod] of deleted) {
        if (await isAlreadyRecorded(db, car)) continue

        const startedDate = lastmod || null
        const days = startedDate ? countDays(startedDate) : '-'
        // language=SQLite
        await db.run(`
            INSERT INTO history_period (car, startedDate, endDate, days)
            VALUES (?, ?, datetime('now', 'localtime'), ?)
        `, car, startedDate, days)
        inserted++
    }

    return `Удалённых авто за сегодня: ${inserted} (в файле: ${deleted.size}).`
}

async function isAlreadyRecorded(db, car) {
    // language=SQLite
    const lastRecord = await db.get(`
        SELECT endDate
        FROM history_period
        WHERE car = ?
        ORDER BY endDate DESC
        LIMIT 1
    `, car)
    if (!lastRecord) return false

    // авто снова появлялось в истории добавлений после удаления - это новый период продажи
    // language=SQLite
    const readded = await db.get(`
        SELECT 1
        FROM history
        WHERE date > ?
          AND instr(',' || carsPerDay || ',', ',' || ? || ',') > 0
        LIMIT 1
    `, lastRecord.endDate, car)

    return !readded
}

function countDays(startedDate) {
    const started = Date.parse(startedDate)
    if (!Number.isFinite(started)) return '-'
    return Math.max(0, Math.floor((Date.now() - started) / DAY_MS))
}
