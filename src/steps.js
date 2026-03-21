import {Version, getTime} from "./constants.js";
import {open} from "sqlite";
import sqlite3 from "sqlite3";
import {copyXmlToFolder} from './stepsImportPhoto/copyXmlToFolder.js'
import {clearTables} from './stepsImportPhoto/clearTables.js'
import {parseXMLToBD} from "./stepsImportPhoto/parseXMLToBD.js";
import {countNewPhoto} from './stepsImportPhoto/countNewPhoto.js'
import {publicBD} from "./stepsImportPhoto/publicBD.js";
import {sendTelegram} from "./telegramReport.js";


const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
});

let report = `:::::: ${getTime()} :::::: Отчет ${Version} ::::::`

let text = ''
let isNeedAddNewPhoto = false

for (let i in [1]) {
    // 1
    text = await copyXmlToFolder()
    report += `\n 1. ${text}`
    if (text.indexOf('Удачно') < 0) break

    // 2
    text = await clearTables(db)
    report += `\n 2. ${text}`
    if (text.indexOf('Удачно') < 0) break

    // 3
    text = await parseXMLToBD(db)
    report += `\n 3. ${text}`
    if (text.indexOf('Удачно') < 0) break

    // 4
    text = await countNewPhoto(db)
    report += `\n 4. ${text}`
    if (parseInt(text.split(':')[1]) > 0) isNeedAddNewPhoto = true
    if (text.indexOf('Удачно') < 0) break

    // 5
    text = await publicBD(db)
    report += `\n 5. ${text}`

    if (text.indexOf('Удачно') < 0) break


    report += '\n  Все шаги пройдены успешно.'
}

if (report.indexOf('успешно') < 0) report += ' \n ВНИМАНИЕ!!! ☹  ☹  ☹ НЕУДАЧА'


console.log('REPORT \n\n'+report)
console.log('isNeedAddNewPhoto = ', isNeedAddNewPhoto)
if (isNeedAddNewPhoto) {
    console.log('Добавляем фотки isNeedAddNewPhoto = ', isNeedAddNewPhoto)
}

sendTelegram(report)