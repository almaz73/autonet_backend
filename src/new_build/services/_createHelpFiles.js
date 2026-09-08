import {FolderForSitemap, FolderLINKS, FolderPhoto, isToday, transliterate} from "../../constants.js";
import fs from "fs";
import xml2js from "xml2js";
import path from "path";
import {fileURLToPath} from 'url';
import {access} from 'fs/promises';
import {_saveLinks, _saveNewLinks} from "./_saveLinks.js"

// Настройки для парсера и билдера
const parser = new xml2js.Parser({explicitArray: false});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITEMAP_PATH = FolderForSitemap + '/sitemap.xml';
let newPhotos = []
let newAuto = []
let oldAuto = []
let newAutoIDS = [] // Этот список нужен будет для A_car.getLatestCarArrivials()
getNewAutoIdsFromFile() // используем прежние данные если сегодняшний
let newLinks = [] // Этот список нужен будет для A_car.getLatestCarArrivials()
getNewLinks() // используем прежние данные если сегодняшний

export async function _createHelpFiles(db) {
    let newDbRows = await getAllNewCarsWithPhoto(db)
    let autoLinksFromSitemap = await getAutoLinksFromSitemap()
    await getNewCarLinks_NewBD_Sitemap(newDbRows, autoLinksFromSitemap)
    await getOldAuto(autoLinksFromSitemap)

    await _saveLinks('_newPhotos.js', newPhotos)
    await _saveLinks('_oldAuto.js', oldAuto)
    await _saveLinks('_newAuto.js', newAuto)
    await _saveLinks('_newAutoIDS.js', newAutoIDS)
    await _saveNewLinks(newLinks)

    return `Новых авто: ${newAuto.length}, Удаляемых авто:${oldAuto.length}, Новых фото: ${newPhotos.length}`
}

function getNewAutoIdsFromFile() {
    try {
        const filePath = path.join(FolderLINKS, '_newAutoIDS.js'); // вытаскивание по дате
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const timeUpdateFile = fs.statSync(filePath);
        // Если файл сегодняшний, забираем
        if (fileContent && isToday(new Date(timeUpdateFile.mtime))) newAutoIDS = JSON.parse(fileContent)
    } catch (e) {
        return []
    }
}

function getNewLinks() {
    try {
        const filePath = path.join(FolderForSitemap, 'newLinks.txt');
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const timeUpdateFile = fs.statSync(filePath);
        // Если файл сегодняшний, забираем
        if (fileContent && isToday(new Date(timeUpdateFile.mtime))) newLinks = fileContent.split('\n')
    } catch (e) {
        return []
    }
}

async function getAllNewCarsWithPhoto(db) {
    try {
        // language=SQLite
        const allCarsWitnPhoto = await db.all(`
            SELECT id,
                   images,
                   prop_city     as sity,
                   prop_year     as year,
                   prop_brand    as brand,
                   prop_model    as model,
                   price,
                   prop_milleage as milleage
            FROM cars_table
            WHERE images IS NOT NULL
              AND images != ''
        `);
        return allCarsWitnPhoto
    } catch (e) {
        console.log('Не получилось прочитать cars_table ', e)
    }
}

async function getAutoLinksFromSitemap() {
    try {
        const xmlData = fs.readFileSync(SITEMAP_PATH, 'utf-8');
        let result = await parser.parseStringPromise(xmlData);
        let urls = Array.isArray(result.urlset.url) ? result.urlset.url : [result.urlset.url]; // Приводим к массиву для безопасности
        // выбираем только то что относится к авто
        urls = urls.filter(el => el.loc.includes('/cars/')) // оставляем только страницы авто
        urls = urls.filter(el =>el && !el.loc.split('/')[4]) // удаляем страницы типа https://xn--80aej9aped4f.xn--p1ai/cars/0/VAZ(LADA)
        return urls
    } catch (e) {
        return []
    }
}

async function getNewCarLinks_NewBD_Sitemap(newDbRows, autoLinksFromSitemap) {
    try {
        if (!newDbRows) return console.log('новая база пустая')

        for (let car of newDbRows) {
            let dbLink = 'https://xn--80aej9aped4f.xn--p1ai/cars/' + transliterate(car.brand + '/' + car.model + '/' + car.year + '-' + car.sity + '-' + car.price + '-' + car.milleage + 'km').replaceAll(' ', '')
            let found = autoLinksFromSitemap.find(el => el.loc === dbLink)
            if (found) {
                found.mark = true
            } else {
                if (!newLinks.includes(dbLink)) {
                    if (!newAuto.includes('/null')) {
                        newLinks.push(dbLink)
                        newAutoIDS.push(car.id)
                    }
                }
                await addNewPhotosWithCheck(car.images)
            }
        }
    } catch (e) {
        return 'getNewCarLinks_NewBD_Sitemap e = ' + e
    }

}

async function addNewPhotosWithCheck(images) {
    if (!images.length) return false
    for (let image of images.split(',')) {
        try {
            if (!image) return {error: 'Image URL is required'};

            const urlObj = new URL(image);
            let originalFilename = path.basename(urlObj.pathname);
            const baseName = path.parse(originalFilename).name;// имя файла в нашей системе

            // проверяем Есть ли он уже у нас
            const uploadDir = path.join(__dirname, '../../..', FolderPhoto);
            const filePath = path.join(uploadDir, baseName);

            try {
                // Проверяем существование файла
                await access(filePath + '_small.webp');
                // console.log(`Фотография ${baseName} найдена!`);
                return true;
            } catch {
                newPhotos.push(image)
                return false;
            }

        } catch (e) {
            console.log('addNewPhotosWithCheck image,e = ', image, e)
        }

    }

}

async function getOldAuto(autoLinksFromSitemap) {
    try {
        let diff = autoLinksFromSitemap.filter(el => !el.mark)
        oldAuto.push(...diff)
    } catch (e) {
        console.log('getOldAuto e = ', e)
    }
}