import {getDB} from '../db.js';

function getAllbd(callback, page = 1, pageSize = 10, city = null) {
    const db = getDB();
    const offset = (page - 1) * pageSize;
    
    // Build base SQL query
    let sql = `SELECT *
                 FROM clientEmails`;
    
    // Add city filter if provided
    if (city) {
        sql += ` WHERE city = ?`;
    }
    
    // Add ordering and pagination
    sql += ` ORDER BY created_at DESC
             LIMIT ? OFFSET ?`;
    
    // Build count query to get total items
    let countSql = `SELECT COUNT(*) AS total
                      FROM clientEmails`;
    
    if (city) {
        countSql += ` WHERE city = ?`;
    }

    // Prepare parameters
    const params = [];
    const countParams = [];
    
    if (city) {
        params.push(city);
        countParams.push(city);
    }
    
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
    getAllbd,
};