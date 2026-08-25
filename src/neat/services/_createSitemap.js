// 1. превращаем xml в массив
// 2. Заливаем в базу
// 3. удаляем не маркированные, значит их в базе больше нет.
// 4. удаляем маркер, сохраняем обратно в xml

import xml2js from "xml2js";
import fs from 'fs';
import {pages} from '../../../sitePages.js'
import sqlite3 from "sqlite3";
import {open} from "sqlite";
import path from "path";
import {FolderForSitemap, RussianBrandsLat, RussianBrandsRus, transliterate} from "../../constants.js";
import {_saveLinks} from "./_saveLinks.js"

// Настройки для парсера и билдера
const parser = new xml2js.Parser({explicitArray: false});
const builder = new xml2js.Builder({
    xmldec: {version: '1.0', encoding: 'UTF-8'}
});

const SITEMAP_PATH = FolderForSitemap + '/sitemap.xml';
let urls = [] // все ссылки собираемые для sitemap
let rows = [] // все поля bd
let result = {}
let countAdded = 0
let countDeleted = 0

export async function _updateSitemap(onlyRows) {
    //readXmlToJson
    try {
        // 1. Чтение исходного XML-файла
        const xmlData = fs.readFileSync(SITEMAP_PATH, 'utf-8');
        // 2. Конвертация XML в JSON объект
        result = await parser.parseStringPromise(xmlData);
        // Массив всех страниц находится в result.urlset.url
        // Если в sitemap всего одна страница, xml2js вернет объект вместо массива.
        // Приводим к массиву для безопасности:
        urls = Array.isArray(result.urlset.url) ? result.urlset.url : [result.urlset.url];
        // console.log(`Исходное количество страниц: ${urls.length}`);
        return searchAndAddNodes(onlyRows)
    } catch (e) {
        console.log('Не получилось прочитать sitemap.xml ', e)
    }
}

async function searchAndAddNodes(onlyRows) {
    // проходим по страницам сайта и маркируем, чтобы не удалить потом.
    for (let page of pages) {
        urls.map(el => {
            if (el.loc === page) el.mark = true
        })
    }


    // Получаем из базы все автомобили, проходим по всем, если нет добавляем с маркировкой, если находим маркируем
    const db = await open({filename: './database.sqlite', driver: sqlite3.Database});
    //  language=SQLite
    rows = await db.all(`
        SELECT ac.id,
               ac.prop_guarantee as linkId,
               ac.prop_brand     as brand,
               ac.prop_model     as model
        FROM a_car ac
    `);
    await db.close();


    if (onlyRows) return rows

    for (let row of rows) {
        let model = row.model && transliterate(row.model).replace(' ', '')
        if (!model) continue
        let brand = transliterate(row.brand).replaceAll(" ", "");
        let link = 'https://xn--80aej9aped4f.xn--p1ai/cars/' + brand + '/' + model + '/' + row.linkId
        if (urls.some(el => el.loc === link)) {  // уже существует, временно маркируем, чтобы не удалять
            let el = urls.find(el => el.loc === link)
            el.mark = true
        } else { // добавляем новый узел
            countAdded++
            urls.push({
                loc: link,
                lastmod: new Date().toISOString().split('T')[0], // Формат YYYY-MM-DD
                mark: true
            })
        }
    }

    try {
        await findAndSaveTodaysCars(rows)
        await saveFileAboutDeletedCars()
    } catch (e) {
        console.log('Не получилось создать список сегодняшних авто = ', e)
    }

    return deleteUnnecessaryNodes()
}

function deleteUnnecessaryNodes() {

    let count = urls.length
    // Очистка удаленных страниц
    urls = urls.filter(item => item.mark);
    countDeleted = count - urls.length
    return saveSitemap()
}

// запишем список сегодняшних авто в файл (Это нужно для первой страницы - свежие постуления)
async function findAndSaveTodaysCars(rows) {
    let day = new Date().toISOString().split('T')[0]
    let todaysCars = urls.filter(el => el.lastmod === day)
    let Ids = []
    let links = []
    todaysCars = todaysCars.map(el => el.loc.slice(39))
    todaysCars = todaysCars.map(el => el.split('/'))
    todaysCars = todaysCars.map(el => {
        let brand
        let placeRusBrand = RussianBrandsLat.findIndex(item => item === el[0])
        if (placeRusBrand !== -1) brand = RussianBrandsRus[placeRusBrand]
        el = brand + '/' + el[2]
        return el
    })
    rows.forEach(el => {
        if (todaysCars.includes(`${el.brand}/${el.linkId}`)) {
            Ids.push(el.id)
            links.push(transliterate(el.brand).replaceAll(" ", "") + '/' + transliterate(el.model).replaceAll(" ", "") + '/' + transliterate(el.linkId).replaceAll(" ", ""))
        }
    })

    _saveLinks('ids_todays_cars.js', Ids)
    _saveLinks('links_todays_cars.js', links)
    saveNewLinks(links)
}

async function saveNewLinks(links) {
    let newLinks = links.map(el => 'https://xn--80aej9aped4f.xn--p1ai/cars/' + el)

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

async function saveFileAboutDeletedCars() {
    let deletedToday_cars = urls.filter(item => !item.mark);
    _saveLinks('links_deletedToday_cars.js', deletedToday_cars)
}

function saveSitemap() {
    if (urls.length < 70) return console.log('sitemap сильно обрезан. Не получилось обновить')
    // Обновляем массив в структуре JSON
    urls.map(el => delete el.mark)
    result.urlset.url = urls;
    // Конвертация измененного JSON обратно в XML
    const updatedXml = builder.buildObject(result);
    // Запись обновленного XML обратно в файл
    fs.writeFileSync(SITEMAP_PATH, updatedXml, 'utf-8');
    console.log('Файл sitemap.xml успешно перезаписан!');


    let report = {text: `, добавлено-${countAdded} удалено-${countDeleted}`, rows}

    return report
}


