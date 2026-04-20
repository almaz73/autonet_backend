// Promo data access module
import {getDB} from './db.js';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {FolderPhotoForPromoActions} from '../constants.js';

function getAllPromo(callback) {
    const db = getDB();
    // language=SQLite
    const sql = `SELECT *
                 FROM promo
                 ORDER BY priority ASC`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error getting promo items', err.message);
            return callback(err, null);
        }
        callback(null, rows);
    });
}

function getActivePromo(callback) {
    const db = getDB();
    // language=SQLite
    const sql = `SELECT *
                 FROM promo
                 WHERE active = 1
                 ORDER BY priority ASC`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error getting active promo items', err.message);
            return callback(err, null);
        }
        callback(null, rows);
    });
}

function getPromoById(id, callback) {
    const db = getDB();
    // language=SQLite
    const sql = `SELECT *
                 FROM promo
                 WHERE id = ?`;

    db.get(sql, [id], (err, row) => {
        if (err) {
            console.error('Error getting promo item', err.message);
            return callback(err, null);
        }
        callback(null, row);
    });
}

function createPromo(promo, callback) {
    const db = getDB();
    // language=SQLite
    const sql = `
        INSERT INTO promo (name,
                           onMain,
                           priority,
                           active,
                           photoBig,
                           photoMiddle,
                           photoSmall,
                           photoSM_ver,
                           photoSM_hor)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        promo.name,
        promo.onMain ? 1 : 0,
        promo.priority || 0,
        promo.active !== undefined ? (promo.active ? 1 : 0) : 1,
        promo.photoBig || null,
        promo.photoMiddle || null,
        promo.photoSmall || null,
        promo.photoSM_ver || null,
        promo.photoSM_hor || null
    ];

    db.run(sql, values, function (err) {
        if (err) {
            console.error('Error creating promo item', err.message);
            return callback(err, null);
        }
        callback(null, this.lastID);
    });
}

// Update promo item
function updatePromo(id, promo, callback) {
    const db = getDB();
    // language=SQLite
    const sql = `
        UPDATE promo
        SET name        = ?,
            onMain      = ?,
            priority    = ?,
            active      = ?,
            photoBig    = ?,
            photoMiddle = ?,
            photoSmall  = ?,
            photoSM_ver = ?,
            photoSM_hor = ?
        WHERE id = ?
    `;

    const values = [
        promo.name,
        promo.onMain ? 1 : 0,
        promo.priority,
        promo.active !== undefined ? (promo.active ? 1 : 0) : 1,
        promo.photoBig || null,
        promo.photoMiddle || null,
        promo.photoSmall || null,
        promo.photoSM_ver || null,
        promo.photoSM_hor || null,
        id
    ];

    db.run(sql, values, function (err) {
        if (err) {
            console.error('Error updating promo item', err.message);
            return callback(err, null);
        }
        callback(null, this.changes);
    });
}

// Delete promo item
function deletePromo(id, callback) {
    const db = getDB();
    // language=SQLite
    const sql = `DELETE
                 FROM promo
                 WHERE id = ?`;

    db.run(sql, [id], function (err) {
        if (err) {
            console.error('Error deleting promo item', err.message);
            return callback(err, null);
        }
        callback(null, this.changes);
    });
}

// Save promo photo
function savePromoPhoto(fileName, photo, callback) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    // Ensure the promo photos directory exists
    const promoPhotoDir = path.resolve(__dirname, '../..', FolderPhotoForPromoActions);
    
    // Create directory if it doesn't exist
    fs.mkdirSync(promoPhotoDir, { recursive: true });
    
    // Define the file path
    const filePath = path.join(promoPhotoDir, `${fileName}`);

    // Save the photo data to file
    fs.writeFile(filePath, photo, function(err) {
        if (err) {
            console.error('Error saving promo photo to disk:', err.message);
            return callback(err, null);
        }

        callback(null, `/promo-photos/${fileName}`);

    });
}

export  {
    getAllPromo,
    getActivePromo,
    getPromoById,
    createPromo,
    updatePromo,
    deletePromo,
    savePromoPhoto
};