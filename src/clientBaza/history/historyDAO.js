import {getDB} from '../db.js';

function getAllhistory(callback, page = 1, pageSize = 10) {
    const db = getDB();
    const offset = (page - 1) * pageSize;
    
    // Build base SQL query
    // language=SQLite
    let sql = `SELECT * FROM history`;

    // Add ordering and pagination
    sql += ` ORDER BY date DESC LIMIT ? OFFSET ?`;
    
    // Build count query to get total items
    // language=SQLite
    let countSql = `SELECT COUNT(*) AS total FROM history`;

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
    let sql = `SELECT * FROM history_period`;

    // Add ordering and pagination
    sql += ` ORDER BY endDate DESC LIMIT ? OFFSET ?`;

    // Build count query to get total items
    // language=SQLite
    let countSql = `SELECT COUNT(*) AS total FROM history_period`;

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
    console.log('?? ?? pageSize = ',pageSize)
    const db = getDB();
    const offset = (page - 1) * pageSize;

    // language=SQLite
    let sql = `SELECT endDate, COUNT(*) AS count, GROUP_CONCAT(car) AS carsPerDay
    FROM history_period
    GROUP BY endDate`;

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
        console.log('row = ',row)
        // results.total = row.total;

        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('Error getting paginated items', err.message);
                return callback(err, null);
            }

            results.items = rows.map(row => ({
                date: row.endDate,
                count: row.count,
                carsPerDay: row.carsPerDay
            }));
            console.log('results.items length= ',results.items.length)
            let pagesCount = results.items.map(el=>el.count)
            console.log('zzz = ',pagesCount)
            results.total = pagesCount.length;
            
            callback(null, results);
        });
    });
}

export {
    getAllhistory,
    getHistoryPeriod,
    getHistoryPeriodDays
};