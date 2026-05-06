// Article data access module
import {getDB} from '../db.js';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {FolderPhotoForArticle} from '../../constants.js';
import sharp from "sharp";

function getAllArticle(callback) {
    const db = getDB();
    // language=SQLite
    const sql = `SELECT *
                 FROM article
                 ORDER BY priority ASC`;

    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Error getting article items', err.message);
            return callback(err, null);
        }
        callback(null, rows);
    });
}

function getArticleByCode(id, callback) {
    const db = getDB();
    // language=SQLite
    const sql = `SELECT *
                 FROM article
                 WHERE code = ?
                   AND active = 1`;

    db.get(sql, [id], (err, row) => {
        if (err) {
            console.error('Error getting article item', err.message);
            return callback(err, null);
        }
        callback(null, row);
    });
}

function createArticle(article, callback) {
    const db = getDB();
    // language=SQLite
    const sql = `
        INSERT INTO article (name,
                           onMain,
                           priority,
                           active,
                           code,
                           photo278,
                           photo1200)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        article.name,
        article.onMain ? 1 : 0,
        article.priority || 0,
        article.active !== undefined ? (article.active ? 1 : 0) : 1,
        article.code || null,
        article.photo278 || null,
        article.photo1200 || null
    ];

    db.run(sql, values, function (err) {
        if (err) {
            console.error('Error creating article item', err.message);
            return callback(err, null);
        }
        callback(null, this.lastID);
    });
}

// Update article item
function updateArticle(id, article, callback) {
    const db = getDB();
    // language=SQLite
    const sql = `
        UPDATE article
        SET name        = ?,
            onMain      = ?,
            priority    = ?,
            active      = ?,
            code = ?,
            photo278    = ?,
            photo1200   = ?
        WHERE id = ?
    `;

    const values = [
        article.name,
        article.onMain ? 1 : 0,
        article.priority,
        article.active !== undefined ? (article.active ? 1 : 0) : 1,
        article.code || null,
        article.photo278 || null,
        article.photo1200 || null,
        id
    ];

    db.run(sql, values, function (err) {
        if (err) {
            console.error('Error updating article item', err.message);
            return callback(err, null);
        }
        callback(null, this.changes);
    });
}

// Delete article item
function deleteArticle(id, callback) {
    const db = getDB();
    // language=SQLite
    const sql = `DELETE
                 FROM article
                 WHERE id = ?`;

    db.run(sql, [id], function (err) {
        if (err) {
            console.error('Error deleting article item', err.message);
            return callback(err, null);
        }
        deleteArticlePhoto(id)
        callback(null, this.changes);
    });
}

async function createArticlePhotos278х402(fileName, photo, articlePhotoDir) {
    const name = `${fileName + '_v_b'}.webp`
    const filePath = path.join(articlePhotoDir, name);
    let processedBuffer = await sharp(photo)
        .webp({quality: 92})
        .resize(500, 723, {fit: 'cover', withoutEnlargement: true})
        .toBuffer();
    await fs.promises.writeFile(filePath, processedBuffer);

    const filePath2 = path.join(articlePhotoDir, `${fileName + '_v_l'}.webp`);
    processedBuffer = await sharp(photo)
        .webp({quality: 92})
        .resize(278, 402, {fit: 'cover', withoutEnlargement: true})
        .toBuffer();
    await fs.promises.writeFile(filePath2, processedBuffer);
    return name
}

async function createArticlePhotos1200х501(fileName, photo, articlePhotoDir) {
    const name = `${fileName + '_h_m'}.webp`
    const filePath = path.join(articlePhotoDir, name);
    const processedBuffer = await sharp(photo)
        .webp({quality: 92})
        .resize(1201, 501, {fit: 'cover', withoutEnlargement: true})
        .toBuffer();
    await fs.promises.writeFile(filePath, processedBuffer);
    return name
}

async function createArticlePhotos585х200(fileName, photo, articlePhotoDir) {
    const name = `${fileName + '_h_b'}.webp`
    const filePath = path.join(articlePhotoDir, name);
    let processedBuffer = await sharp(photo)
        .webp({quality: 92})
        .resize(1200, 410, {fit: 'cover', withoutEnlargement: true})
        .toBuffer();
    await fs.promises.writeFile(filePath, processedBuffer);

    const filePath2 = path.join(articlePhotoDir, `${fileName + '_h_l'}.webp`);
    processedBuffer = await sharp(photo)
        .webp({quality: 92})
        .resize(585, 200, {fit: 'cover', withoutEnlargement: true})
        .toBuffer();
    await fs.promises.writeFile(filePath2, processedBuffer);
    return name
}

function saveArticlePhoto(fileName, photo, callback) {

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const articlePhotoDir = path.resolve(__dirname, '../../..', FolderPhotoForArticle);

    fs.mkdirSync(articlePhotoDir, {recursive: true});

    let newFileName = fileName.split('_')[1]

    if (fileName.includes('278х402')) createArticlePhotos278х402(newFileName, photo, articlePhotoDir).then(res => callback(null, res))
    if (fileName.includes('585х200')) createArticlePhotos585х200(newFileName, photo, articlePhotoDir).then(res => callback(null, res))
    if (fileName.includes('1200х501')) createArticlePhotos1200х501(newFileName, photo, articlePhotoDir).then(res => callback(null, res))
}

async function deleteArticlePhoto(id) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const uploadDir = path.resolve(__dirname, '../../..', FolderPhotoForArticle);

    let names = ['_h_b', '_h_l', '_h_m', '_v_b', '_v_l']
    for (let name of names) {
        let filename = id + name + '.webp'
        try {
            const filePath = path.join(uploadDir, filename)
            if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
        } catch (error) {
            console.log('Error deleting file:', error.message)
            return {error: error.message};
        }
    }
}

async function getMainArticleBanners() {
    try {
        const db = getDB();
        // language=SQLite
        const sql = `SELECT name, photo278, photo1200, description, code
                     FROM article
                     WHERE active = 1
                       AND onMain = 1
                     ORDER BY priority ASC`;

        return new Promise((resolve, reject) => {
            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error('Error getting active article banners:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    } catch (error) {
        console.error('Error in getMainArticleBanners:', error);
        throw error;
    }
}

async function getActiveArticleBanners() {
    try {
        const db = getDB();
        // language=SQLite
        const sql = `SELECT *
                     FROM article
                     WHERE active = 1
                     ORDER BY priority ASC`;

        return new Promise((resolve, reject) => {
            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error('Error getting active article banners:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    } catch (error) {
        console.error('Error in getMainArticleBanners:', error);
        throw error;
    }
}

export {
    getAllArticle,
    getArticleByCode,
    createArticle,
    updateArticle,
    deleteArticle,
    saveArticlePhoto,
    getMainArticleBanners,
    getActiveArticleBanners
};