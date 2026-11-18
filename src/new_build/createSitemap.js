import '../loadEnv.js' // первым: SMTP-настройки нужны до создания транспорта в sendEmail
import fs from 'fs';
import * as fs_promises from 'node:fs/promises'
import path from 'path';
import {fileURLToPath} from 'url';
import {FolderForSitemap, isLocal} from "../constants.js";
import {open} from 'sqlite';
import sqlite3 from 'sqlite3';
import {sitePages} from '../../sitePages.js'
import {MODEL_MIN_CARS, CITY_MODEL_MIN_CARS, catalogSlug, carFriendly, carPath, buildModelClusters, clusterCityCounts} from '../shared/catalogUrls.js'
import xml2js from "xml2js";
import {sendEmail} from "../post/sendEmail.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// абсолютные пути: при запуске из cron текущая папка другая, и sqlite создавал пустую базу рядом
const DB_PATH = path.resolve(__dirname, '../../database.sqlite')
const CLIENT_DB_PATH = path.resolve(__dirname, '../../client.sqlite')

const SITE_ORIGIN = 'https://xn--80aej9aped4f.xn--p1ai'
const SITEMAP_PATH = FolderForSitemap + '/sitemap.xml';
const SITEMAP_PATH2 = FolderForSitemap + '/sitemap2.xml';
const parser = new xml2js.Parser({explicitArray: false});
const builder = new xml2js.Builder({
    xmldec: {version: '1.0', encoding: 'UTF-8'}
});

let links = []
let newLinks = [] // новые авто
const linksByLoc = new Set()

// даты изменений акций/контактов/статей берём из истории, но только за период после прошлого запуска sitemap:
// всё, что менялось раньше, уже имеет свою дату в старом sitemap
let historySince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
try {
    historySince = fs.statSync(SITEMAP_PATH).mtime
} catch (error) {
    console.log('Не удалось определить дату прошлого sitemap, смотрим историю за 7 дней')
}

// 1. Чтение исходного XML-файла
const xmlData = fs.readFileSync(SITEMAP_PATH, 'utf-8');
// 2. Конвертация XML в JSON объект
let result = await parser.parseStringPromise(xmlData);

const oldSitemapNodes = Array.isArray(result.urlset.url) ? result.urlset.url : [result.urlset.url]
// слеш на конце для поиска даты не важен: акции раньше лежали в sitemap со слешем, статьи — без
const normalizeLoc = (loc) => String(loc || '').replace(/\/+$/, '')
const oldLastmod = new Map()
for (const node of oldSitemapNodes) {
    const key = normalizeLoc(node.loc)
    // в старом sitemap могли быть дубли адреса с разными датами — берём самую свежую
    if (!oldLastmod.has(key) || String(node.lastmod) > oldLastmod.get(key)) {
        oldLastmod.set(key, node.lastmod)
    }
}
const today = new Date().toISOString().split('T')[0]

// создавать sitemap будем каждый раз заново, а старый сохраним в копию
// создание копии
await makeDoubleOldSitemap()
// создание костяка из файла sitePages
await addRootPages()
// посадочные моделей и городов — только те, что проходят порог по количеству авто
await addCatalogPages()
// акции, контакты и статьи — из client.sqlite, даты обновления — из истории изменений
await addClientDbPages()
// получаю список всех авто и добавляю, дату обновления беру со старого sitemap
await addAllAuto()

await saveFileSitemap(links)
await saveNewLinks(newLinks)




function addLink(loc, lastmod) {
    const key = normalizeLoc(loc)
    if (linksByLoc.has(key)) return
    linksByLoc.add(key)
    links.push({
        loc,
        // если с прошлого запуска изменений не было, оставляем дату из старого sitemap
        lastmod: lastmod || oldLastmod.get(key) || today, // Формат YYYY-MM-DD
    })
}

async function makeDoubleOldSitemap() {
    try {
        await fs_promises.copyFile(SITEMAP_PATH, SITEMAP_PATH2);
        console.log('Файл успешно скопирован');
    } catch (error) {
        console.error('Ошибка при копировании:', error);
    }
}

async function addRootPages() {
    for (let page of sitePages) {
        page = page.split(' 👉 ')

        // разделы канонически живут со слешем на конце, карточки авто и файлы — без него
        let loc = page[0]
        const pathname = new URL(loc).pathname
        if (!pathname.startsWith('/cars') && !pathname.includes('.') && !pathname.endsWith('/')) loc += '/'

        addLink(loc, page[1])
    }
}

async function addClientDbPages() {
    const db = await open({
        filename: CLIENT_DB_PATH,
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READONLY,
    })

    try {
        const promos = await db.all(`
            SELECT id, code
            FROM promo
            WHERE active = 1
              AND code IS NOT NULL
              AND code <> ''
        `)
        const newsItems = await db.all(`
            SELECT id, url
            FROM news
            WHERE active = 1
              AND url IS NOT NULL
              AND url <> ''
        `)
        const dealers = await db.all(`
            SELECT id, link
            FROM dealers
            WHERE link IS NOT NULL
              AND link <> ''
        `)

        const promoDates = await getHistoryDates(db, 'promo_id')
        const newsDates = await getHistoryDates(db, 'news_id')
        const dealerDates = await getHistoryDates(db, 'dealer_id')

        // канонический адрес акции — без слеша на конце (см. views/promo.ejs)
        for (const promo of promos) addLink(`${SITE_ORIGIN}/promo/${promo.code}`, promoDates.get(promo.id))
        // адрес статьи в базе уже канонический, со слешем на конце
        for (const item of newsItems) addLink(`${SITE_ORIGIN}/${item.url.replace(/^\/+/, '')}`, newsDates.get(item.id))
        for (const dealer of dealers) addLink(`${SITE_ORIGIN}/${dealer.link.replace(/^\/+/, '')}`, dealerDates.get(dealer.id))
    } finally {
        await db.close()
    }
}

// дата последнего изменения каждой записи за период; более старые даты уже есть в старом sitemap
async function getHistoryDates(db, column) {
    const rows = await db.all(`
        SELECT ${column} AS id, date(MAX(datetime(created_at))) AS lastmod
        FROM changeHistory
        WHERE ${column} IS NOT NULL
          AND datetime(created_at) >= datetime(?)
        GROUP BY ${column}
    `, [historySince.toISOString()])
    return new Map(rows.map((row) => [row.id, row.lastmod]))
}

// посадочные моделей (/cars/<brand>/<model>) и городов (/cars/<brand>/<model>/<city>).
// пороги те же, что в SSR: тонкие страницы в индекс не отдаём
async function addCatalogPages() {
    const db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READONLY,
    })

    try {
        const brands = await db.all(`
            SELECT sec.brand as name
            FROM a_section sec
            WHERE sec.brand IS NOT NULL
              AND sec.brand != ''
            GROUP BY sec.brand
        `)

        for (const brand of brands) {
            const brandSlugValue = catalogSlug(brand.name)
            if (!brandSlugValue) continue

            const modelRows = await db.all(`
                SELECT prop_model as model, COUNT(*) as count
                FROM a_car
                WHERE UPPER(prop_brand) = UPPER(?)
                  AND prop_model IS NOT NULL
                  AND prop_model != ''
                GROUP BY prop_model
            `, [brand.name])
            const {clusters} = buildModelClusters(modelRows)

            const cityRows = await db.all(`
                SELECT prop_model as model, prop_city as city, COUNT(*) as count
                FROM a_car
                WHERE UPPER(prop_brand) = UPPER(?)
                  AND prop_model IS NOT NULL
                  AND prop_model != ''
                  AND prop_city IS NOT NULL
                  AND prop_city != ''
                GROUP BY prop_model, prop_city
            `, [brand.name])

            for (const cluster of clusters.values()) {
                if (cluster.count < MODEL_MIN_CARS) continue
                addLink(`${SITE_ORIGIN}/cars/${brandSlugValue}/${cluster.slug}`)

                const cities = clusterCityCounts(cityRows, cluster)
                for (const city of cities.values()) {
                    if (city.count < CITY_MODEL_MIN_CARS) continue
                    addLink(`${SITE_ORIGIN}/cars/${brandSlugValue}/${cluster.slug}/${city.slug}`)
                }
            }
        }
    } finally {
        await db.close()
    }
}

async function addAllAuto() {
    const db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });

    // получаем список всех авто
    // language=SQLite
    let allAuto = await db.all(`
        SELECT ac.id,
               ac.prop_guarantee as linkId,
               ac.prop_brand     as brand,
               ac.prop_model     as model,
               ac.prop_year      as year,
               ac.price,
               ac.prop_milleage  as milleage,
               ac.prop_city      as city

        FROM a_car ac
                 LEFT JOIN a_section ast ON ac.section = ast.id
    `);
    await db.close();

    // получаем старые записи sitemap
    const xmlData = fs.readFileSync(SITEMAP_PATH2, 'utf-8');
    let result = await parser.parseStringPromise(xmlData);
    let sitemapNodes = Array.isArray(result.urlset.url) ? result.urlset.url : [result.urlset.url];
    sitemapNodes = sitemapNodes.filter(el => el.loc.includes('/cars/'))
    sitemapNodes = sitemapNodes.map(el => {
        el.loc = el.loc.slice(39);
        return el
    })


    for (let car of allAuto) {
        // без марки или модели адрес карточки превращается в /cars///... и не открывается
        const brandValue = String(car.brand ?? '').trim()
        const modelValue = String(car.model ?? '').trim()
        if (!brandValue || !modelValue) continue
        // тот же канон, что отдаёт SSR: бренд и модель слагами
        let link = carPath(brandValue, modelValue, carFriendly(car.year, car.city, car.price, car.milleage))
        let relative = link.replace(/^\/cars\//, '')
        // в старом sitemap адрес мог быть в другом регистре — дату всё равно сохраняем
        let sitemapNode = sitemapNodes.find(el => String(el.loc).toLowerCase() === relative.toLowerCase())
        if (sitemapNode) {
            links.push({
                loc: SITE_ORIGIN + link,
                lastmod: sitemapNode.lastmod, // Формат YYYY-MM-DD
            })
        } else {
            links.push({
                loc: SITE_ORIGIN + link,
                lastmod: new Date().toISOString().split('T')[0],
            })
            newLinks.push(SITE_ORIGIN + link)
        }
    }
}

async function saveFileSitemap(links) {
    if (links.length < 70) return console.log('sitemap сильно обрезан. Не получилось обновить')
    // Обновляем массив в структуре JSON
    links.map(el => delete el.mark)
    result.urlset.url = links;
    // Конвертация измененного JSON обратно в XML
    const updatedXml = builder.buildObject(result);
    // Запись обновленного XML обратно в файл
    fs.writeFileSync(SITEMAP_PATH, updatedXml, 'utf-8');
}

async function saveNewLinks(newLinks) {
    return new Promise((resolve, reject) => {
        const filePath = path.join(FolderForSitemap, 'newLinks.txt');
        fs.mkdir(FolderForSitemap, {recursive: true}, (err) => {
            if (err) {
                console.error(`Error creating directory ${FolderForSitemap}:`, err);
                reject(err);
            }

            fs.writeFile(filePath, newLinks.join('\n'), (err) => {
                if (err) {
                    console.error(`Error writing newLinks file ${filePath}:`, err);
                    reject(err);
                }
                resolve();
            });
        });
    });
}

let text = `Файл sitemap.xml успешно перезаписан! Всего страниц ${links.length}, сейчас добавлено: ${newLinks.length}`

console.log('text = ', text)
if (!isLocal) await sendEmail(text);
