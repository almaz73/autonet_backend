import * as os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
export const Version = 'ver.3.522'

export const isLocal = os.platform() === 'win32'
export const devMode = false // для тестирования

// абсолютные пути: не зависят от cwd процесса (nodemon, Passenger, воркер стартуют из разных папок)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FRONT_DIR = path.resolve(__dirname, '../../front')

export const FolderPhoto = '../front/pub_auto'
export const FolderXML = '../front/XML'
export const FolderForSitemap = FRONT_DIR
export const FolderLINKS = path.join(FRONT_DIR, 'LINKS') // тут ссылки для новых фоток, ссылки существующих фоток и ссылки фоток для удаления
export const FolderPhotoForPromoActions = '../front/pub_promo'
export const FolderPhotoForArticle = '../front/pub_article'
export const FolderDealerPhotos = path.join(FRONT_DIR, 'st/photo/contacts')

export const receivedDataTypes = {
    '1': 'Обратный звонок',
    '2': 'Забронировать автомобиль',
    '3': 'Оценить автомобиль',
    '4': 'Заявка на техосмотр автомобиля',
    '5': 'Запись на шиномонтаж',
    '6': 'Заявка на автокредит',
    '7': 'Заявка на замену масла',
    '8': 'Заявка на ремонт двигателя',
    '9': 'Заявка на подбор автомобиля',
    '10': 'Заявка на франшизу',
    '11': 'Вакансии - анкета с сайта',
    '12': 'Ремонт АКПП',
    '13': 'Сервисное обслуживание',
    '15': 'Письмо ген. директору',
    '17': 'Автострахование'
}

export let xmlUrls = [
    'https://export.cartat.ru/avtoset_upload/Avtoset_new/AVTO_NIGNEKAMSK.xml',
    'https://export.cartat.ru/avtoset_upload/Avtoset_new/AlfaAvto5_AMK.xml',
    'https://export.cartat.ru/avtoset_upload/Avtoset_new/AlfaAvto5_Astrahan.xml',
    'https://export.cartat.ru/avtoset_upload/Avtoset_new/AlfaAvto5_Tver.xml',
    'https://export.cartat.ru/avtoset_upload/Avtoset_new/alfa5_gktm.xml',
    'https://export.cartat.ru/avtoset_upload/Avtoset_new/alfa-trade.xml'
];
export let xmlNames = [
    'AVTO_NIGNEKAMSK.xml',
    'AlfaAvto5_AMK.xml',
    'AlfaAvto5_Astrahan.xml',
    'AlfaAvto5_Tver.xml',
    'alfa5_gktm.xml',
    'alfa-trade.xml'
];

export let xmlUrls_forDev = [
    'https://export.cartat.ru/avtoset_upload/Avtoset_new/alfa-trade.xml'
];
export let xmlNames_forDev = xmlUrls_forDev.map(el => el.slice(52))

export function getTime() {
    return new Date().toLocaleDateString('ru') + ' ' + new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    }) + ' '
}

export {transliterate} from './shared/transliterate.js'

// чтобы привязать динамические сслыки к html прямо на сервере
export let manifest_links = {}
export function set_manifest(val) {
    manifest_links = val
}

export const RussianBrandsRus = ['ВАЗ (LADA)', 'ЗАЗ', 'УАЗ', 'ИЖ', 'Богдан', 'ГАЗ', 'Атом', 'Москвич', 'ЛуАЗ', 'ВИС', 'ЗиС']
export const RussianBrandsLat = ['VAZ(LADA)', 'ZAZ', 'UAZ', 'IZH', 'Bogdan', 'GAZ', 'Atom', 'Moskvich', 'Luaz', 'VIS', 'ZiS']
export let reportAboutUpdate='' // сюда собрать и отправить отчет одним письмом
export function addReportAboutUpdate(val) {
    if (!val) reportAboutUpdate = ''
    reportAboutUpdate += val
}

// _newAutoIDS.js: новый формат {generatedAt, ids}, старый — просто массив id
export const NEW_AUTO_IDS_TTL_MS = 24 * 60 * 60 * 1000

export const getNewAutoIds = (data) => {
    if (Array.isArray(data)) return data
    return Array.isArray(data?.ids) ? data.ids : []
}

// свежесть по timestamp внутри файла (не зависит от TZ), для старого формата — по mtime
export const isFreshNewAutoIds = (data, mtimeMs) => {
    const updatedAt = Array.isArray(data) ? mtimeMs : Date.parse(data?.generatedAt)
    return Number.isFinite(updatedAt) && Date.now() - updatedAt <= NEW_AUTO_IDS_TTL_MS
}
export const isToday = (date) => { // для определения даты изменения файла, забираем до 6:45 следующего дня
    const today = new Date();
    return date.toDateString() === today.toDateString();
};