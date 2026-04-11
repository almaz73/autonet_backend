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

for (let i in [1]) {
    //7
    text = await clearDeprecatedPhotos(db)
    report += '\n 8. ⚡. Удалены неиспользуемые ' + text + ' фото'
    reportForTelegram += ` ➜removed unnecessary ${text} photo`

    text = await uploadPhotos(db)
    report += '\n 9. ⚡. Добавлены недостающие ' + text + ' фото'
    reportForTelegram += ` ➜added missing ${text} photo`


    if (text !== 0 && !text) break

    report += '\n ⚡⚡⚡ Ссылки проверены на наличие фоток.'
    reportForTelegram += ' SUCCESS'
}

if (report.indexOf('успешно') < 0) {
    report += ' \n ВНИМАНИЕ!!! ☹  ☹  ☹ НЕУДАЧА'
    reportForTelegram += '☹  ☹  ☹ FAILED'
}

console.log('\n' + report)

sendTelegram(reportForTelegram)


