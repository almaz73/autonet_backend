import {Version, getTime} from "./constants.js";
import {open} from "sqlite";
import sqlite3 from "sqlite3";
import {uploadPhotosFromLinksWithCheck} from "./stepsImportPhoto/uploadPhotosFromLinksWithCheck.js";
import {sendEmail} from "./post/sendEmail.js"
import {copyXmlToFolder} from './stepsImportPhoto/copyXmlToFolder.js'
import {clearTables} from './stepsImportPhoto/clearTables.js'
import {parseXMLToBD} from "./stepsImportPhoto/parseXMLToBD.js";
// import {countNewCars} from './stepsImportPhoto/countNewCars.js'
import {publicBD} from "./stepsImportPhoto/publicBD.js";
import {sendTelegram} from "./telegramReport.js";
// import {uploadPhotos} from './stepsImportPhoto/uploadPhotos.js'
// import {uploadNewPhotos} from './stepsImportPhoto/uploadNewPhotos.js'
// import {clearDeprecatedPhotos} from './stepsImportPhoto/clearDeprecatedPhotos.js'
import {clearBadPhotos} from './stepsImportPhoto/clearBadPhotos.js'




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
    reportForTelegram += '  ➜  copy_XML'
    if (text.indexOf('⚡') < 0) break

    // 2
    text = await clearTables(db)
    report += `\n 2. ${text}`
    reportForTelegram += '  ➜  clear_BD'
    if (text.indexOf('⚡') < 0) break

    // 3
    text = await parseXMLToBD(db)
    report +=    `\n 3. ⚡. ${text} автомобиля`
    reportForTelegram += `  ➜  cars ⋲ ${text} `
    if (text < 1 ) break

    //4
    text = await publicBD(db)
    reportForTelegram += '  ➜  public_BD '
    report += `\n 4. ${text}`
    if (text.indexOf('⚡') < 0) break

    //5
    text = await clearBadPhotos(db)
    reportForTelegram += `  ➜  badLinks ⋲ ${text} `
    report += `\n 5. ⚡. Очищены плохие ссылки на ${text} фото`
    if (text == undefined) break


    //6
    let newAddedCarsAndPhotos = await uploadPhotosFromLinksWithCheck(db)
    text = newAddedCarsAndPhotos
    report += `\n 6. ${text}`
    reportForTelegram += `  ➜  ${text}`
    if (text.indexOf('⚡') < 0) break


    if (text !== 0 && !text) break

    report += '\n ⚡⚡⚡ Новая публикация прошла успешно.'
    reportForTelegram += ' \nSUCCESS'
}

if (report.indexOf('успешно') < 0) {
    report += ' \n ВНИМАНИЕ!!! ☹  ☹  ☹ НЕУДАЧА'
    reportForTelegram += '☹  ☹  ☹ FAILED'
}

console.log('\n' + report)

sendEmail('ОБНОВЛЕНО:\n '+ report) // на почту

try {
    sendTelegram(reportForTelegram)
} catch (e) {
    console.log('e = ',e)
}


