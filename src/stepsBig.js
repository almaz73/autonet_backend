// Добавление недостающих фоток (сильно грузит)


import {Version, getTime} from "./constants.js";
import {open} from "sqlite";
import sqlite3 from "sqlite3";
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

// sendTelegram(reportForTelegram)


