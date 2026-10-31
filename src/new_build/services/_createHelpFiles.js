import {
    FolderForSitemap,
    FolderLINKS,
    FolderPhoto,
    isToday,
    transliterate,
    getNewAutoIds,
    isFreshNewAutoIds,
} from "../../constants.js";
import fs from "fs";
import xml2js from "xml2js";
import path from "path";
import {fileURLToPath} from 'url';
import {_saveLinks, _saveNewAutoIds, _saveNewLinks} from "./_saveLinks.js"

// Настройки для парсера и билдера
const parser = new xml2js.Parser({explicitArray: false});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SITEMAP_PATH = FolderForSitemap + '/sitemap.xml';
const UPLOAD_DIR = path.join(__dirname, '../../..', FolderPhoto);

let newPhotos = []
let newAuto = []
let oldAuto = []
let newAutoIDS = [] // Этот список нужен будет для A_car.getLatestCarArrivials()
let newLinks = []
let queuedPhotoNames = new Set()
let existingSmallPhotos = new Set()
let existingBigPhotos = new Set()

export async function _createHelpFiles(db) {
    resetState()
    getNewAutoIdsFromFile() // используем прежние данные если сегодняшний
    getNewLinks() // используем прежние данные если сегодняшний
    await loadExistingPhotos()

    const newDbRows = await getAllNewCarsWithPhoto(db)
    const autoLinksFromSitemap = await getAutoLinksFromSitemap()

    await getNewCarLinks_NewBD_Sitemap(newDbRows, autoLinksFromSitemap)
    await getOldAuto(autoLinksFromSitemap)

    await _saveLinks('_newPhotos.js', newPhotos)
    await _saveLinks('_oldAuto.js', oldAuto)
    await _saveLinks('_newAuto.js', newAuto)
    await _saveNewAutoIds(newAutoIDS)
    await _saveNewLinks(newLinks)

    return `Новых авто: ${newAuto.length}, Удаляемых авто:${oldAuto.length}, Новых фото: ${newPhotos.length}`
}

function resetState() {
    newPhotos = []
    newAuto = []
    oldAuto = []
    newAutoIDS = []
    newLinks = []
    queuedPhotoNames = new Set()
}

function getNewAutoIdsFromFile() {
    newAutoIDS = []
    try {
        const filePath = path.join(FolderLINKS, '_newAutoIDS.js'); // вытаскивание по дате
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const timeUpdateFile = fs.statSync(filePath);
        const data = JSON.parse(fileContent);
        // Если файл свежий, забираем накопленные за сутки id
        if (isFreshNewAutoIds(data, timeUpdateFile.mtime.getTime())) newAutoIDS = getNewAutoIds(data)
    } catch (e) {
        newAutoIDS = []
    }
}

function getNewLinks() {
    newLinks = []
    try {
        const filePath = path.join(FolderForSitemap, 'newLinks.txt');
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const timeUpdateFile = fs.statSync(filePath);
        // Если файл сегодняшний, забираем
        if (fileContent && isToday(new Date(timeUpdateFile.mtime))) newLinks = fileContent.split('\n').filter(Boolean)
    } catch (e) {
        newLinks = []
    }
}

// один раз читаем папку с фотками, чтобы не проверять каждую ссылку отдельно
async function loadExistingPhotos() {
    const files = await fs.promises.readdir(UPLOAD_DIR)
    existingSmallPhotos = new Set()
    existingBigPhotos = new Set()

    for (const file of files) {
        if (file.endsWith('_small.webp')) existingSmallPhotos.add(file.slice(0, -'_small.webp'.length))
        else if (file.endsWith('_big.webp')) existingBigPhotos.add(file.slice(0, -'_big.webp'.length))
    }
}

async function getAllNewCarsWithPhoto(db) {
    // получаем список всех авто с фотками из БД
    // language=SQLite
    return db.all(`
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
}

async function getAutoLinksFromSitemap() {
    // получает список существующих в сайтемап ссылок на авто
    // если sitemap не читается — падаем: иначе все авто будут считаться новыми
    const xmlData = fs.readFileSync(SITEMAP_PATH, 'utf-8');
    const result = await parser.parseStringPromise(xmlData);
    if (!result?.urlset) throw new Error('Некорректный sitemap.xml: нет узла <urlset>');

    const urlNodes = result.urlset.url
    if (!urlNodes) return []

    let urls = Array.isArray(urlNodes) ? urlNodes : [urlNodes]; // Приводим к массиву для безопасности

    // оставляем только страницы авто, без   страницы пагинации типа https://xn--80aej9aped4f.xn--p1ai/cars/0/VAZ(LADA)
    return urls.filter(el => el.loc?.includes('/cars/') && isNaN(el.loc.split('/')[4]))
}

async function getNewCarLinks_NewBD_Sitemap(newDbRows, autoLinksFromSitemap) {
    if (!newDbRows) return

    for (let car of newDbRows) {
        let dbLink = 'https://xn--80aej9aped4f.xn--p1ai/cars/' + transliterate(car.brand + '/' + car.model + '/' + car.year + '-' + car.sity + '-' + car.price + '-' + car.milleage + 'km').replaceAll(' ', '')
        let found = autoLinksFromSitemap.find(el => el.loc === dbLink)
        if (found) {
            found.mark = true
        } else {
            if (!newLinks.includes(dbLink)) {
                newAuto.push(dbLink)
                newLinks.push(dbLink)
            }
            if (!newAutoIDS.includes(car.id)) {
                newAutoIDS.push(car.id)
            }
        }
        // фото проверяем у всех авто: файл мог пропасть из папки, а ссылка в БД осталась
        addNewPhotosWithCheck(car.images)
    }
}

function addNewPhotosWithCheck(images) {
    if (!images) return

    for (let image of String(images).split(',')) {
        image = image.trim()
        if (!image) continue

        let baseName = ''
        try {
            baseName = path.parse(path.basename(new URL(image).pathname)).name
        } catch (e) {
            console.log('addNewPhotosWithCheck: неверная ссылка на фото = ', image)
            continue
        }

        if (!baseName || queuedPhotoNames.has(baseName)) continue
        if (existingSmallPhotos.has(baseName) && existingBigPhotos.has(baseName)) continue

        queuedPhotoNames.add(baseName)
        newPhotos.push(image)
    }
}

async function getOldAuto(autoLinksFromSitemap) {
    let diff = autoLinksFromSitemap.filter(el => !el.mark)
    oldAuto.push(...diff)
}
