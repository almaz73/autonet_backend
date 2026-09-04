import fs from 'fs';
import * as fs_promises from 'node:fs/promises'
import path from 'path';
import {FolderForSitemap, isLocal, transliterate} from "../constants.js";
import {open} from 'sqlite';
import sqlite3 from 'sqlite3';
import {sitePages} from '../../sitePages.js'
import * as promoService from "../clientBaza/promo/promoService.js";
import xml2js from "xml2js";
import {sendEmail} from "../post/sendEmail.js"

const SITEMAP_PATH = FolderForSitemap + '/sitemap.xml';
const SITEMAP_PATH2 = FolderForSitemap + '/sitemap2.xml';
const parser = new xml2js.Parser({explicitArray: false});
const builder = new xml2js.Builder({
    xmldec: {version: '1.0', encoding: 'UTF-8'}
});

let links = []
let newLinks = [] // новые авто

// 1. Чтение исходного XML-файла
const xmlData = fs.readFileSync(SITEMAP_PATH, 'utf-8');
// 2. Конвертация XML в JSON объект
let result = await parser.parseStringPromise(xmlData);


// создавать sitemap будем каждый раз заново, а старый сохраним в копию
// создание копии
await makeDoubleOldSitemap()
// создание костяка из файла sitePages
await addRootPages()
// получаю список всех акций и добавляю
await addPromoPages()
// получаю список всех авто и добавляю, дату обновления беру со старого sitemap
await addAllAuto()

await saveFileSitemap(links)
await saveNewLinks(newLinks)




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

        links.push({
                loc: page[0],
                lastmod: page[1] || new Date().toISOString().split('T')[0], // Формат YYYY-MM-DD
            })
    }
}

async function addPromoPages() {
    try {
        const promoItems = await promoService.getAllPromo();
        let promos = promoItems.map(el => 'https://xn--80aej9aped4f.xn--p1ai/promo/' + el.code + '/')

        for (let page of promos) {
            links.push({
                loc: page,
                lastmod: new Date().toISOString().split('T')[0], // Формат YYYY-MM-DD
            })
        }
    } catch (error) {
        console.error('Error getting promo items:', error);
    }
}

async function addAllAuto() {
    const db = await open({
        filename: './database.sqlite',
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
    let site = 'https://xn--80aej9aped4f.xn--p1ai/cars/'

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
        let link = transliterate(car.brand + '/' + car.model + '/' + car.year + '-' + car.city + '-' + car.price + '-' + car.milleage + 'km').replaceAll(' ', '')
        let sitemapNode = sitemapNodes.find(el => el.loc === link) // Если в старом, дату берем оттуда
        if (sitemapNode) {
            links.push({
                loc: site + link,
                lastmod: sitemapNode.lastmod, // Формат YYYY-MM-DD
            })
        } else {
            links.push({
                loc: site + link,
                lastmod: new Date().toISOString().split('T')[0],
            })
            newLinks.push(site + link)
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