//Article data access module
import {getDB} from '../db.js';

function getAllbd(callback,page = 1, pageSize = 10, city = null) {
    const db = getDB();
    // Calculate offset for pagination
    const offset = (page - 1) * pageSize;
    
    // Build SQL query with optional city filter
    let sql = `SELECT * FROM clientEmails`;
    
    // Add city filter if provided
    if (city) sql += ` WHERE city = ?`;

    // Add ordering and pagination
    sql += ` ORDER BY created_at DESC
             LIMIT ? OFFSET ?`;

    // Prepare parameters for query
    const params = [];
   if (city) {
        params.push(city);
    }
    params.push(pageSize, offset);

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Error getting article items', err.message);
            return callback(err, null);
        }
        callback(null,rows);
    });
}


export {
    getAllbd,
};