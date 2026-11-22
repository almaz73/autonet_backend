// statistics.sqlite: статистика каталога (новые авто за день и периоды продаж).
// вынесена из client.sqlite, чтобы история на 14k+ строк не раздувала рабочую базу админки
import path from 'path'
import fs from 'fs'
import {fileURLToPath} from 'url'
import sqlite3 from 'sqlite3'
import {Sequelize, DataTypes} from 'sequelize'
import {StatisticsDB_PATH} from '../../constants.js'
import {createStatisticsTables} from './statisticsSchema.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CLIENT_DB_PATH = path.resolve(__dirname, '../../../client.sqlite')
const MIGRATION_KEY = 'history_from_client'

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: StatisticsDB_PATH,
    logging: false,
})

// AdminJS «Время продаж»: модель читает и пишет уже в statistics.sqlite
const history_period = sequelize.define('Сколько дней висело', {
    startedDate: { type: DataTypes.TEXT, allowNull: false },
    endDate: { type: DataTypes.TEXT, allowNull: false },
    car: { type: DataTypes.TEXT, allowNull: false },
    days: { type: DataTypes.INTEGER, allowNull: false },
    id: {type: DataTypes.INTEGER, primaryKey: true, allowNull: false},
}, {
    tableName: 'history_period',
    timestamps: false,
});

// отдельное подключение для DAO: тот же приём, что и getDB() для client.sqlite
export function getStatisticsDB() {
    return new sqlite3.Database(StatisticsDB_PATH, (err) => {
        if (err) console.error('Error opening statistics database', err.message)
    })
}

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            err ? reject(err) : resolve(this)
        })
    })
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows))
    })
}

function close(db) {
    return new Promise((resolve) => db.close(() => resolve()))
}

// разовый перенос history/history_period из client.sqlite.
// INSERT OR IGNORE по id делает повторный запуск безопасным, а маркер в statistics_meta
// не даёт гонять полный перенос на каждом старте
async function migrateHistoryFromClient(db) {
    if (!fs.existsSync(CLIENT_DB_PATH)) return

    const marker = await all(db, 'SELECT value FROM statistics_meta WHERE key = ?', [MIGRATION_KEY])
    if (marker.length) return

    try {
        await run(db, 'ATTACH DATABASE ? AS legacy_client', [CLIENT_DB_PATH])
    } catch (error) {
        console.error('statistics.sqlite: не удалось открыть client.sqlite для переноса истории:', error.message)
        return
    }

    try {
        const tables = await all(db,
            "SELECT name FROM legacy_client.sqlite_master WHERE type = 'table' AND name IN ('history', 'history_period')")
        const names = new Set(tables.map(row => row.name))
        if (!names.size) return

        let historyRows = 0
        let periodRows = 0

        await run(db, 'BEGIN')
        try {
            if (names.has('history')) {
                const result = await run(db, `
                    INSERT OR IGNORE INTO history (id, date, count, carsPerDay)
                    SELECT id, date, count, carsPerDay FROM legacy_client.history
                `)
                historyRows = result.changes
            }
            if (names.has('history_period')) {
                const result = await run(db, `
                    INSERT OR IGNORE INTO history_period (id, car, startedDate, endDate, days)
                    SELECT id, car, startedDate, endDate, days FROM legacy_client.history_period
                `)
                periodRows = result.changes
            }
            await run(db, 'INSERT OR REPLACE INTO statistics_meta (key, value) VALUES (?, datetime(\'now\'))', [MIGRATION_KEY])
            await run(db, 'COMMIT')
        } catch (error) {
            await run(db, 'ROLLBACK').catch(() => {})
            throw error
        }

        console.log(`statistics.sqlite: перенесено из client.sqlite history=${historyRows}, history_period=${periodRows}`)
    } finally {
        await run(db, 'DETACH DATABASE legacy_client').catch(() => {})
    }
}

async function initStatisticsDb() {
    const db = getStatisticsDB()
    try {
        await createStatisticsTables(db)
        await migrateHistoryFromClient(db)
    } finally {
        await close(db)
    }
}

// приложение ждёт готовности базы перед стартом; ошибку логируем, но сервер не блокируем
export const statisticsReady = initStatisticsDb().catch((error) => {
    console.error('Не удалось подготовить statistics.sqlite:', error)
})

export { sequelize as statisticsSequelize, history_period }
