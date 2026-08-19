// 1. превращаем xml в массив
// 2. Заливаем в базу
// 3. удаляем не маркированные, значит их в базе больше нет.
// 4. удаляем маркер, сохраняем обратно в xml

import xml2js from "xml2js";
import fs from 'fs';
import {pages} from '../../../sitePages.js'
import sqlite3 from "sqlite3";
import {open} from "sqlite";
import {transliterate} from "../../constants.js";

// Настройки для парсера и билдера
const parser = new xml2js.Parser({explicitArray: false});
const builder = new xml2js.Builder({
    xmldec: {version: '1.0', encoding: 'UTF-8'}
});

const SITEMAP_PATH = '../front/sitemap.xml';
let urls = []
let result = {}
let countAdded = 0
let countDeleted = 0

export async function _updateSitemap() {
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
        return searchAndAddNodes()
    } catch (e) {
        console.log('Не получилось прочитать sitemap.xml ', e)
    }
}

async function searchAndAddNodes() {

    // проходим по страницам сайта и маркируем
    for (let page of pages) {
        urls.map(el => {
            if (el.loc === page) el.mark = true
        })
    }


    // Получаем из базы все автомобили, проходим по всем, если нет добавляем с маркировкой, если находим маркируем
    const db = await open({filename: './database.sqlite', driver: sqlite3.Database});

    //  language=SQLite
    const rows = await db.all(`
        SELECT ac.prop_guarantee as linkId,
               ac.prop_brand     as brand,
               ac.prop_model     as model
        FROM a_car ac
    `);
    await db.close();


    for (let row of rows) {
        let model = row.model && row.model.replace(' ', '')
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

    return deleteUnnecessaryNodes()
}

function deleteUnnecessaryNodes() {
    let count = urls.length
    // Очистка удаленных страниц
    let zzz = urls.filter(item => !item.mark);
    console.log('zzz = ', zzz)
    urls = urls.filter(item => item.mark);
    countDeleted = count - urls.length
    return saveSitemap()
}

function saveSitemap() {

    // Обновляем массив в структуре JSON
    urls.map(el => delete el.mark)
    result.urlset.url = urls;
    // Конвертация измененного JSON обратно в XML
    const updatedXml = builder.buildObject(result);
    // Запись обновленного XML обратно в файл
    fs.writeFileSync(SITEMAP_PATH, updatedXml, 'utf-8');
    console.log('Файл sitemap.xml успешно перезаписан!');


    let report = `, добавлено-${countAdded} удалено-${countDeleted}`

    return report
}
