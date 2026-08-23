import {getDB} from '../db.js';

function getAllhistory(callback, page = 1, pageSize = 10) {
    const db = getDB();
    const offset = (page - 1) * pageSize;

    // Build base SQL query
    // language=SQLite
    let sql = `SELECT *
               FROM history`;

    // Add ordering and pagination
    sql += ` ORDER BY date DESC LIMIT ? OFFSET ?`;

    // Build count query to get total items
    // language=SQLite
    let countSql = `SELECT COUNT(*) AS total
                    FROM history`;

    // Prepare parameters
    const params = [];
    const countParams = [];

    params.push(pageSize, offset);

    // Execute both queries in parallel
    const results = {};

    db.get(countSql, countParams, (err, row) => {
        if (err) {
            console.error('Error getting item count', err.message);
            return callback(err, null);
        }
        results.total = row.total;

        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('Error getting paginated items', err.message);
                return callback(err, null);
            }

            results.items = rows;
            callback(null, results);
        });
    });
}

function getHistoryPeriod(callback, page = 1, pageSize = 10) {
    const db = getDB();
    const offset = (page - 1) * pageSize;

    // Build base SQL query
    // language=SQLite
    let sql = `SELECT *
               FROM history_period`;

    // Add ordering and pagination
    sql += ` ORDER BY endDate DESC LIMIT ? OFFSET ?`;

    // Build count query to get total items
    // language=SQLite
    let countSql = `SELECT COUNT(*) AS total
                    FROM history_period`;

    // Prepare parameters
    const params = [];
    const countParams = [];

    params.push(pageSize, offset);

    // Execute both queries in parallel
    const results = {};

    db.get(countSql, countParams, (err, row) => {
        if (err) {
            console.error('Error getting item count', err.message);
            return callback(err, null);
        }
        results.total = row.total;

        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('Error getting paginated items', err.message);
                return callback(err, null);
            }

            results.items = rows;
            callback(null, results);
        });
    });
}


function getHistoryPeriodDays(callback, page = 1, pageSize = 10) {
    const db = getDB();
    const offset = (page - 1) * pageSize;

    // language=SQLite
    let sql = `SELECT endDate, COUNT(*) AS count, GROUP_CONCAT(car) AS carsPerDay
    FROM history_period GROUP BY endDate`;

    // Add ordering and pagination
    sql += ` ORDER BY endDate DESC LIMIT ? OFFSET ?`;

    // language=SQLite
    let countSql = `SELECT COUNT(*) AS total FROM history_period`;
    const params = [];
    const countParams = [];

    params.push(pageSize, offset);

    // Execute both queries in parallel
    const results = {};

    db.get(countSql, countParams, (err, row) => {
        if (err) {
            console.error('Error getting item count', err.message);
            return callback(err, null);
        }

        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('Error getting paginated items', err.message);
                return callback(err, null);
            }

            rows = addRepeatDate(rows) // объединяем по датам

            results.items = rows.map(row => ({
                date: row.endDate,
                count: row.count,
                carsPerDay: row.carsPerDay
            }));
            let pagesCount = results.items.map(el => el.count)
            results.total = pagesCount.length;

            callback(null, results);
        });
    });
}

function addRepeatDate(rows) {
    // сливаем в одну, если за один день было несколько удалений
    let newRows = []
    for (let row of rows) {
        let time = new Date(row.endDate).getDate()
        let repeated = newRows.find(el => new Date(el.endDate).getDate() === time)
        if (repeated) {
            repeated.carsPerDay += ',' + row.carsPerDay
            repeated.count = repeated.carsPerDay.split(',').length
        } else {
            newRows.push(row)
        }
    }
    return newRows
}

export {
    getAllhistory,
    getHistoryPeriod,
    getHistoryPeriodDays
};