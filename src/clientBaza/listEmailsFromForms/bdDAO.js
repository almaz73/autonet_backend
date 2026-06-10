// Article data access module
import {getDB} from '../db.js';

function getAllbd(callback) {
    const db = getDB();
    // language=SQLite
    const sql = `SELECT *
                 FROM clientEmails
                 ORDER BY created_at DESC`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error getting article items', err.message);
            return callback(err, null);
        }
        callback(null, rows);
    });
}


export {
    getAllbd,
};