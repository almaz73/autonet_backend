import {Version, getTime} from "./constants.js";
import {open} from "sqlite";
import sqlite3 from "sqlite3";
import {copyXmlToFolder} from './stepsImportPhoto/copyXmlToFolder.js'
import {clearTables} from './stepsImportPhoto/clearTables.js'
import {parseXMLToBD} from "./stepsImportPhoto/parseXMLToBD.js";
import {countNewCars} from './stepsImportPhoto/countNewCars.js'
import {publicBD} from "./stepsImportPhoto/publicBD.js";
import {sendTelegram} from "./telegramReport.js";
import {uploadPhotos} from './stepsImportPhoto/uploadPhotos.js'
import {uploadNewPhotos} from './stepsImportPhoto/uploadNewPhotos.js'
import {clearDeprecatedPhotos} from './stepsImportPhoto/clearDeprecatedPhotos.js'
import {clearBadPhotos} from './stepsImportPhoto/clearBadPhotos.js'
import {uploadPhotosFromLinksWithCheck} from "./stepsImportPhoto/uploadPhotosFromLinksWithCheck.js";




const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
});

let report = `:::::: ${getTime()} :::::: Отчет ${Version} ::::::`
let reportForTelegram = `  ::::::  ${getTime()}  ::::::  `

let text = ''
let newCars = []

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

    3
    text = await parseXMLToBD(db)
    report +=    `\n 3. ⚡. ${text} автомобиля`
    reportForTelegram += ` ➜counter auto ⋲ ${text} `
    if (text < 1 ) break

    // 4
    // newCars = await countNewCars(db)
    // text = '⚡. Новые авто в базе: ' + newCars.length
    // report += `\n 4. ${text}`
    // reportForTelegram += ` ➜авто ⋲ ${newCars.length}`
    // if (text.indexOf('⚡') < 0) break

    //5
    // let countPhotoInFolder = await uploadNewPhotos(db, newCars)
    // text = '⚡. Новые фото в папке: ' + countPhotoInFolder
    // report += `\n 5. ${text}`
    // reportForTelegram += ` ➜in folder ⋲ ${countPhotoInFolder}`
    // if (text.indexOf('⚡') < 0) break

    //6
    text = await clearBadPhotos(db)
    reportForTelegram += ` ➜badLink ⋲ ${text} `
    report += `\n ⚡. 4. Очищены плохие ссылки на ${text} фото`
    console.log('text = ',text)
    if (text == undefined) break


    //4 new
    let newAddedCarsAndPhotos = await uploadPhotosFromLinksWithCheck(db)
    text = newAddedCarsAndPhotos
    report += `\n 5. ${text}`
    reportForTelegram += ` ➜ ⋲ ${text}`
    if (text.indexOf('⚡') < 0) break

    //7
    text = await publicBD(db)
    reportForTelegram += ' ➜public BD '
    report += `\n 6. ${text}`
    if (text.indexOf('⚡') < 0) break


    if (text !== 0 && !text) break

    report += '\n ⚡⚡⚡ Новая публикация прошла успешно.'
    reportForTelegram += ' SUCCESS'
}

if (report.indexOf('успешно') < 0) {
    report += ' \n ВНИМАНИЕ!!! ☹  ☹  ☹ НЕУДАЧА'
    reportForTelegram += '☹  ☹  ☹ FAILED'
}

console.log('\n' + report)

sendTelegram(reportForTelegram)


