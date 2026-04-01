import {Version, getTime} from "./constants.js";
import {open} from "sqlite";
import sqlite3 from "sqlite3";
import {copyXmlToFolder} from './stepsImportPhoto/copyXmlToFolder.js'
import {clearTables} from './stepsImportPhoto/clearTables.js'
import {parseXMLToBD} from "./stepsImportPhoto/parseXMLToBD.js";
import {countNewPhoto} from './stepsImportPhoto/countNewPhoto.js'
import {publicBD} from "./stepsImportPhoto/publicBD.js";
import {sendTelegram} from "./telegramReport.js";
import {uploadPhotos} from './stepsImportPhoto/uploadPhotos.js'
import {clearDeprecatedPhotos} from './stepsImportPhoto/clearDeprecatedPhotos.js'


const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
});

let report = `:::::: ${getTime()} :::::: Отчет ${Version} ::::::`
let reportForTelegram = report

let text = ''
let newLinksWithPhoto = []

for (let i in [1]) {
    // 1
    text = await copyXmlToFolder()
    report += `\n 1. ${text}`
    reportForTelegram += ' 1.copy XML'
    if (text.indexOf('Удачно') < 0) break

    // 2
    text = await clearTables(db)
    report += `\n 2. ${text}`
    reportForTelegram += ' 2.clear table'
    if (text.indexOf('Удачно') < 0) break

    // 3
    text = await parseXMLToBD(db)
    report += `\n 3. ${text}`
    reportForTelegram += ' 3. created datas'
    if (text.indexOf('Удачно') < 0) break

    // 4
    newLinksWithPhoto = await countNewPhoto(db)
    text = '⚡ Удачно. Новые фото в базе: ' + newLinksWithPhoto.length
    report += `\n 4. ${text}`
    reportForTelegram += ' 4. new:(' + newLinksWithPhoto.length + ' photo) '
    if (text.indexOf('Удачно') < 0) break

    // 5
    text = await publicBD(db)
    reportForTelegram += ' 5. public '
    report += `\n 5. ${text}`
    if (text.indexOf('Удачно') < 0) break

    text = await uploadPhotos(db)
    report += '\n 6. ⚡ Удачно. Добавлены недостающие ' + text + ' фото'
    reportForTelegram += ` 6. added missing ${text} photo`

    text =  await clearDeprecatedPhotos(db)
    report += '\n 7. ⚡ Удачно. Удалены неиспользуемые ' + text + ' фото'
    reportForTelegram += ` 7. removed unnecessary ${text} photo`

    if (text !== 0 && !text) break

    report += '\n  Все шаги пройдены успешно.'
    reportForTelegram += ' SUCCESS'
}

if (report.indexOf('успешно') < 0) {
    report += ' \n ВНИМАНИЕ!!! ☹  ☹  ☹ НЕУДАЧА'
    reportForTelegram += '☹  ☹  ☹ FAILED'
}

console.log('\n' + report)

console.log('### reportForTelegram = ', reportForTelegram)
// sendTelegram(reportForTelegram)

// if (newLinksWithPhoto.length) {
//     console.log('Добавляем фотки isNeedAddNewPhoto = ')
//     let addedReport = await uploadPhotos(db)
//     sendTelegram(addedReport)
//
//     console.log('Удаляем устаревшие не нужные фотки')
//     let removedReport = await clearDeprecatedPhotos(db)
//     sendTelegram(removedReport)
// }
