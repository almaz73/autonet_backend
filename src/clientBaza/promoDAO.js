// Promo data access module
import {getDB} from './db.js';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {FolderPhotoForPromoActions} from '../constants.js';
import sharp from "sharp";

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

async function createPromoPhotos278х402(fileName, photo, promoPhotoDir) {
    const name =  `${fileName+'_v_b'}.webp`
    const filePath = path.join(promoPhotoDir,name);
    let processedBuffer = await sharp(photo)
        .webp({quality: 92})
        .resize(500, 723, {fit: 'cover', withoutEnlargement: true})
        .toBuffer();
    await fs.promises.writeFile(filePath, processedBuffer);

    const filePath2 = path.join(promoPhotoDir,  `${fileName+'_v_l'}.webp`);
    processedBuffer = await sharp(photo)
        .webp({quality: 92})
        .resize(345, 500, {fit: 'cover', withoutEnlargement: true})
        .toBuffer();
    await fs.promises.writeFile(filePath2, processedBuffer);
    return name
}

async function createPromoPhotos1200х501(fileName, photo, promoPhotoDir) {
    const name =`${fileName+'_h_m'}.webp`
    const filePath = path.join(promoPhotoDir, name);
    const processedBuffer = await sharp(photo)
        .webp({quality: 92})
        .resize(1201, 501, {fit: 'cover', withoutEnlargement: true})
        .toBuffer();
    await fs.promises.writeFile(filePath, processedBuffer);
    return name
}

async function createPromoPhotos585х200(fileName, photo, promoPhotoDir) {
    const name = `${fileName+'_h_b'}.webp`
    const filePath = path.join(promoPhotoDir, name);
    let processedBuffer = await sharp(photo)
        .webp({quality: 92})
        .resize(1200, 410, {fit: 'cover', withoutEnlargement: true})
        .toBuffer();
    await fs.promises.writeFile(filePath, processedBuffer);

    const filePath2 = path.join(promoPhotoDir, `${fileName+'_h_l'}.webp`);
    processedBuffer = await sharp(photo)
        .webp({quality: 92})
        .resize(585, 200, {fit: 'cover', withoutEnlargement: true})
        .toBuffer();
    await fs.promises.writeFile(filePath2, processedBuffer);
    return name
}


// Save promo photo
function savePromoPhoto(fileName, photo, callback) {

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const promoPhotoDir = path.resolve(__dirname, '../..', FolderPhotoForPromoActions);

    fs.mkdirSync(promoPhotoDir, { recursive: true });

    let newFileName = fileName.split('_')[1]

    if (fileName.includes('278х402')) createPromoPhotos278х402(newFileName, photo, promoPhotoDir).then(res => callback(null, res))
    if (fileName.includes('585х200')) createPromoPhotos585х200(newFileName, photo, promoPhotoDir).then(res => callback(null, res))
    if (fileName.includes('1200х501')) createPromoPhotos1200х501(newFileName, photo, promoPhotoDir).then(res => callback(null, res))

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