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


export {
    getAllhistory,
};