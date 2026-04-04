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
let reportForTelegram = `  ::::::  ${getTime()}  ::::::  `

let text = ''
let newLinksWithPhoto = []

for (let i in [1]) {
    // 1
    text = await copyXmlToFolder()
    report += `\n 1. ${text}`
    reportForTelegram += ' ➜copy XML'
    if (text.indexOf('⚡') < 0) break

    // 2
    text = await clearTables(db)
    report += `\n 2. ${text}`
    reportForTelegram += ' ➜clear BD'
    if (text.indexOf('⚡') < 0) break

    // 3
    text = await parseXMLToBD(db)
    report +=    `\n 3. ⚡. ${text} авто в базе`
    reportForTelegram += ` ➜counter auto 👉 ${text} `
    if (text < 1 ) break

    // 4
    newLinksWithPhoto = await countNewPhoto(db)
    text = '⚡. Новые фото в базе: ' + newLinksWithPhoto.length
    report += `\n 4. ${text}`
    reportForTelegram += ` ➜photo 👉 ${newLinksWithPhoto.length}`
    if (text.indexOf('⚡') < 0) break

    // 5
    text = await publicBD(db)
    reportForTelegram += ' ➜public BD '
    report += `\n 5. ${text}`
    if (text.indexOf('⚡') < 0) break

    text = await uploadPhotos(db)
    report += '\n 6. ⚡. Добавлены недостающие ' + text + ' фото'
    reportForTelegram += ` ➜added missing ${text} photo`

    text = await clearDeprecatedPhotos(db)
    report += '\n 7. ⚡. Удалены неиспользуемые ' + text + ' фото'
    reportForTelegram += ` ➜removed unnecessary ${text} photo`

    if (text !== 0 && !text) break

    report += '\n ⚡⚡⚡ Все шаги пройдены успешно.'
    reportForTelegram += ' SUCCESS'
}

if (report.indexOf('успешно') < 0) {
    report += ' \n ВНИМАНИЕ!!! ☹  ☹  ☹ НЕУДАЧА'
    reportForTelegram += '☹  ☹  ☹ FAILED'
}

console.log('\n' + report)

// console.log('### reportForTelegram = ', reportForTelegram)
sendTelegram(reportForTelegram)

// if (newLinksWithPhoto.length) {
//     console.log('Добавляем фотки isNeedAddNewPhoto = ')
//     let addedReport = await uploadPhotos(db)
//     sendTelegram(addedReport)
//
//     console.log('Удаляем устаревшие не нужные фотки')
//     let removedReport = await clearDeprecatedPhotos(db)
//     sendTelegram(removedReport)
// }
