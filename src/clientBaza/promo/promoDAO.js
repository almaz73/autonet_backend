// Promo data access module
import {getDB} from '../db.js';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {FolderPhotoForPromoActions} from '../../constants.js';
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

function getPromoByCode(id, isEditor, callback) {
    const db = getDB();
    // language=SQLite
    const sql = `SELECT *
                 FROM promo
                 WHERE code = ?
                   AND active = 1 ${isEditor?"OR active = 0":""}`;

    db.get(sql, [id], (err, row) => {
        if (err) {
            console.error('Error getting promo item', err.message);
            return callback(err, null);
        }
        callback(null, row);
    });
}

// код новой акции: максимальный существующий + 1
function getNextPromoCode(callback) {
    const db = getDB();
    // language=SQLite
    const sql = `SELECT MAX(CAST(code AS INTEGER)) AS maxCode
                 FROM promo`;

    db.get(sql, [], (err, row) => {
        if (err) {
            console.error('Error getting max promo code', err.message);
            return callback(err, null);
        }
        callback(null, String((row?.maxCode || 0) + 1));
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
                           code,
                           photo278,
                           photo585,
                           photo1200,
                           title,
                           description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        promo.name,
        promo.onMain ? 1 : 0,
        promo.priority || 0,
        promo.active !== undefined ? (promo.active ? 1 : 0) : 1,
        promo.code || null,
        promo.photo278 || null,
        promo.photo585 || null,
        promo.photo1200 || null,
        promo.title || null,
        promo.description || null
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
            title       = ?,
            onMain      = ?,
            priority    = ?,
            active      = ?,
            code        = ?,
            photo278    = ?,
            photo585    = ?,
            photo1200   = ?,
            description = ?,
            styles      = ?
        WHERE id = ?
    `;

    const values = [
        promo.name,
        promo.title || null,
        promo.onMain ? 1 : 0,
        promo.priority,
        promo.active !== undefined ? (promo.active ? 1 : 0) : 1,
        promo.code || null,
        promo.photo278 || null,
        promo.photo585 || null,
        promo.photo1200 || null,
        promo.description || null,
        promo.styles || null,
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
        deletePromoPhoto(id)
        callback(null, this.changes);
    });
}

async function createPromoPhotos278х402(fileName, photo, promoPhotoDir) {
    const name = `${fileName + '_v_b'}.webp`
    const filePath = path.join(promoPhotoDir, name);
    let processedBuffer = await sharp(photo)
        .webp({quality: 92})
        .resize(500, 723, {fit: 'cover', withoutEnlargement: true})
        .toBuffer();
    await fs.promises.writeFile(filePath, processedBuffer);

    const filePath2 = path.join(promoPhotoDir, `${fileName + '_v_l'}.webp`);
    processedBuffer = await sharp(photo)
        .webp({quality: 92})
        .resize(278, 402, {fit: 'cover', withoutEnlargement: true})
        .toBuffer();
    await fs.promises.writeFile(filePath2, processedBuffer);
    return name
}

async function createPromoPhotos1200х501(fileName, photo, promoPhotoDir) {
    const name = `${fileName + '_h_m'}.webp`
    const filePath = path.join(promoPhotoDir, name);
    const processedBuffer = await sharp(photo)
        .webp({quality: 92})
        .resize(1201, 501, {fit: 'cover', withoutEnlargement: true})
        .toBuffer();
    await fs.promises.writeFile(filePath, processedBuffer);
    return name
}

async function createPromoPhotos585х200(fileName, photo, promoPhotoDir) {
    const name = `${fileName + '_h_b'}.webp`
    const filePath = path.join(promoPhotoDir, name);
    let processedBuffer = await sharp(photo)
        .webp({quality: 92})
        .resize(1200, 410, {fit: 'cover', withoutEnlargement: true})
        .toBuffer();
    await fs.promises.writeFile(filePath, processedBuffer);

    const filePath2 = path.join(promoPhotoDir, `${fileName + '_h_l'}.webp`);
    processedBuffer = await sharp(photo)
        .webp({quality: 92})
        .resize(585, 200, {fit: 'cover', withoutEnlargement: true})
        .toBuffer();
    await fs.promises.writeFile(filePath2, processedBuffer);
    return name
}

function savePromoPhoto(fileName, photo, callback) {

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const promoPhotoDir = path.resolve(__dirname, '../../..', FolderPhotoForPromoActions);

    fs.mkdirSync(promoPhotoDir, {recursive: true});

    let newFileName = fileName.split('_')[1]

    if (fileName.includes('278х402')) createPromoPhotos278х402(newFileName, photo, promoPhotoDir).then(res => callback(null, res))
    if (fileName.includes('585х200')) createPromoPhotos585х200(newFileName, photo, promoPhotoDir).then(res => callback(null, res))
    if (fileName.includes('1200х501')) createPromoPhotos1200х501(newFileName, photo, promoPhotoDir).then(res => callback(null, res))
}

// колонка promo -> генератор всех размеров этой колонки
const PHOTO_GENERATORS = {
    photo278: createPromoPhotos278х402,
    photo585: createPromoPhotos585х200,
    photo1200: createPromoPhotos1200х501,
}

// колонка promo -> варианты файлов этой колонки, на которые лепится текст
const SLOT_VARIANTS = {
    photo278: ['v_b', 'v_l'],
    photo585: ['h_b', 'h_l'],
    photo1200: ['h_m'],
}

const escapeXmlText = (text) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// текст рисуется SVG-слоем поверх фото; координаты и размер заданы в % от размеров фото,
// поэтому одинаково ложатся на все варианты слота (у вариантов одинаковые пропорции)
async function withTextOverlay(buffer, params) {
    const {width, height} = await sharp(buffer).metadata()
    const fontSize = Math.max(8, Math.round(height * params.fontSizePct / 100))
    const lineHeight = Math.round(fontSize * 1.2)
    const lines = params.text.split('\n')
    const x = width * params.xPct / 100
    // центр блока текста; первая базовая линия = центр минус полблока плюс подъём ~0.8em
    const y0 = height * params.yPct / 100 - (lines.length * lineHeight) / 2 + fontSize * 0.8
    const spans = lines.map((line, i) =>
        `<tspan x="${x}"${i ? ` dy="${lineHeight}"` : ''}>${escapeXmlText(line)}</tspan>`).join('')

    const svg = Buffer.from(
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
        `<text x="${x}" y="${y0}" font-family="Arial, DejaVu Sans, sans-serif" font-size="${fontSize}" ` +
        `font-weight="bold" fill="${params.color}" text-anchor="middle">${spans}</text></svg>`)

    return sharp(buffer).composite([{input: svg}]).webp({quality: 92}).toBuffer()
}

// params: {text, color, fontSizePct, xPct, yPct}; пустой text = вернуть исходное фото без текста
async function applyPromoPhotoTextById(id, slot, params) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url))
    const promoPhotoDir = path.resolve(__dirname, '../../..', FolderPhotoForPromoActions)

    const variants = SLOT_VARIANTS[slot]
    if (!variants) throw new Error(`Неизвестное фото: ${slot}`)

    fs.mkdirSync(promoPhotoDir, {recursive: true})

    let mainName = null
    for (const variant of variants) {
        const mainFile = path.join(promoPhotoDir, `${id}_${variant}.webp`)
        const blankFile = path.join(promoPhotoDir, `${id}_${variant}_blank.webp`)

        // при первой лепке текста сохраняем исходник с постфиксом _blank,
        // чтобы позже можно было налепить другой текст на чистое фото
        if (!fs.existsSync(blankFile)) {
            if (!fs.existsSync(mainFile)) throw new Error(`Нет фото ${id}_${variant}.webp`)
            await fs.promises.copyFile(mainFile, blankFile)
        }

        const original = await fs.promises.readFile(blankFile)
        const result = params.text ? await withTextOverlay(original, params) : original
        await fs.promises.writeFile(mainFile, result)
        mainName = `${id}_${variant}.webp`
    }

    return {[slot]: mainName}
}

function updatePromoPhotos(id, names) {
    const slots = Object.keys(names).filter((slot) => PHOTO_GENERATORS[slot]);
    if (!slots.length) return Promise.resolve(names);

    const db = getDB();
    // language=SQLite
    const sql = `UPDATE promo
                 SET ${slots.map((slot) => `${slot} = ?`).join(', ')}
                 WHERE id = ?`;
    const values = slots.map((slot) => names[slot]).concat(id);

    return new Promise((resolve, reject) => {
        db.run(sql, values, function (err) {
            if (err) {
                console.error('Error updating promo photos', err.message);
                return reject(err);
            }
            resolve(names);
        });
    });
}

// имена файлов строятся из номера записи, поэтому перезагрузка фото просто затирает прежние
async function savePromoPhotosById(id, buffers) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const promoPhotoDir = path.resolve(__dirname, '../../..', FolderPhotoForPromoActions);

    fs.mkdirSync(promoPhotoDir, {recursive: true});

    const names = {};
    for (const [slot, buffer] of Object.entries(buffers)) {
        const generate = PHOTO_GENERATORS[slot];
        if (!generate) throw new Error(`Неизвестный размер фото: ${slot}`);
        // новое фото затирает прежнее, прежний исходник _blank больше не подходит
        for (const variant of SLOT_VARIANTS[slot]) {
            const blankFile = path.join(promoPhotoDir, `${id}_${variant}_blank.webp`);
            await fs.promises.unlink(blankFile).catch(() => {});
        }
        names[slot] = await generate(String(id), buffer, promoPhotoDir);
    }

    await updatePromoPhotos(id, names);
    return names;
}

async function deletePromoPhoto(id) {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const uploadDir = path.resolve(__dirname, '../../..', FolderPhotoForPromoActions);

    let names = ['_h_b', '_h_l', '_h_m', '_v_b', '_v_l', '_h_b_blank', '_h_l_blank', '_h_m_blank', '_v_b_blank', '_v_l_blank']
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

async function getMainPromoBanners() {
    try {
        const db = getDB();
        // language=SQLite
        const sql = `SELECT name, photo278, photo585, photo1200, description, code, description, styles
                     FROM promo
                     WHERE active = 1
                       AND onMain = 1
                     ORDER BY priority ASC`;

        return new Promise((resolve, reject) => {
            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error('Error getting active promo banners:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    } catch (error) {
        console.error('Error in getMainPromoBanners:', error);
        throw error;
    }
}

async function getActivePromoBanners(isEditor) {
    try {
        const db = getDB();
        // language=SQLite
        const sql = `SELECT *
                     FROM promo
                     WHERE active = 1 ${isEditor?"OR active = 0":""}
                     ORDER BY priority ASC`;

        return new Promise((resolve, reject) => {
            db.all(sql, [], (err, rows) => {
                if (err) {
                    console.error('Error getting active promo banners:', err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    } catch (error) {
        console.error('Error in getMainPromoBanners:', error);
        throw error;
    }
}

export {
    getAllPromo,
    getPromoByCode,
    getNextPromoCode,
    createPromo,
    updatePromo,
    deletePromo,
    savePromoPhoto,
    savePromoPhotosById,
    applyPromoPhotoTextById,
    getMainPromoBanners,
    getActivePromoBanners
};