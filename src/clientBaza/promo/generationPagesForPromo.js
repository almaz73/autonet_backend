// генерируем страницы для страниц промоакций

import NodeCache from "node-cache";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
import * as promoDAO from "./promoDAO.js";

export async function getMainBanners(req, res) {
    try {
        const cachedData = myPromoCache.get('/getMainBanners')
        if (cachedData) return res.json(cachedData); // Отправка из кэша
        const promoItems = await promoDAO.getMainPromoBanners();
        myPromoCache.set('/getMainBanners', promoItems);
        res.json(promoItems);
    } catch (error) {
        console.error('Error getting promo banners:', error);
        res.status(500).json({error: 'Failed to get promo banners'});
    }
}

export async function getActiveBanners(req, res) {
    try {
        const cachedData = myPromoCache.get('/getActiveBanners')
        if (cachedData) return res.json(cachedData); // Отправка из кэша
        const promoItems = await promoDAO.getActivePromoBanners();
        myPromoCache.set('/getActiveBanners', promoItems);
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
            res.render('promo', data);  // шаблон из бакендной папки VIEWS
        } else {
            data.title = 'Данная акция неактивна'
            res.render('no_promo', data); // шаблон из бакендной папки VIEWS
        }
    });

}

