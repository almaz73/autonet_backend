// схема statistics.sqlite: история добавлений авто и периоды продаж.
// общая для приложения и импорта (new_build/services/_updHistory.js)
export async function createStatisticsTables(db) {
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
    // служебная таблица: отмечаем разовые переносы, чтобы не повторять их при каждом старте
    // language=SQLite
    await db.exec(`
        CREATE TABLE IF NOT EXISTS statistics_meta
        (
            key   TEXT PRIMARY KEY,
            value TEXT
        )
    `)
}
