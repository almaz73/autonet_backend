// генерируем страницы для страниц промоакций

import NodeCache from "node-cache";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import * as promoDAO from "./promoDAO.js";
import {getDB} from '../db.js'


async function getActivePromoBanners() {
    try {
        const db = getDB();
        // language=SQLite
        const sql = `SELECT name, photo278, photo585, photo1200, description, code
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
        console.error('Error in getActivePromoBanners:', error);
        throw error;
    }
}

export async function getMainBanners(req, res) {
    try {
        const cachedData = myPromoCache.get('/getMainBanners')
        if (cachedData) return res.json(cachedData); // Отправка из кэша
        const promoItems = await getActivePromoBanners();
        myPromoCache.set('/getMainBanners', promoItems);
        res.json(promoItems);
    } catch (error) {
        console.error('Error getting promo banners:', error);
        res.status(500).json({error: 'Failed to get promo banners'});
    }
}


const manifest = JSON.parse( // чтобы обновленные ссылки сообщить шаблонизатору
    fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../../front/.vite/manifest.json'), 'utf-8')
);


const myPromoCache = new NodeCache({stdTTL: 1000000}) // 1000000 секунд

export function clearPromoCache() {
    // myCache.del("myKey"); // Удалить конкретный элемент
    myPromoCache.flushAll(); // Очистить весь кэш (радикальный метод)
}

export async function generationPagesForPromo(res, url) {
    let code = url.split('/')[2]

    promoDAO.getPromoByCode(code, (err, promoItem) => {
        if (err) console.error('Error getting promo item by ID', err);

        let css1, css2, js3
        for (let manifestKey in manifest) {
            if (manifestKey.includes('_style-') && manifestKey.includes('.css')) css1 = manifestKey.slice(1)
            if (manifestKey.includes('_promo-') && manifestKey.includes('.css')) css2 = manifestKey.slice(1)
            if (manifestKey.includes('_promo-random-')) js3 = manifestKey.slice(1)
        }

        const data = {
            js1: manifest['work-in-autosite/index.html'].imports && manifest['work-in-autosite/index.html'].imports[0].slice(1),
            js2: manifest['work-in-autosite/index.html'].imports && manifest['work-in-autosite/index.html'].imports[1].slice(1),
            js3, css1, css2
        };

        if (promoItem) {
            data.title = promoItem.name
            data.photo278 = promoItem.photo278
            data.photo1200 = promoItem.photo1200
            res.render('promo', data);
        } else {
            data.title = 'Данная акция неактивна'
            res.render('no_promo', data);
        }
    });

}

