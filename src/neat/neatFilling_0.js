import {Version, getTime} from "../constants.js";
import {open} from "sqlite";
import sqlite3 from "sqlite3";
import {sendEmail} from "../post/sendEmail.js"
import {sendTelegram} from "../telegramReport.js";
import {copyXmlToFolder} from '../stepsImportPhoto/copyXmlToFolder.js'
import {clearTables} from '../stepsImportPhoto/clearTables.js'
import {parseXMLToBD} from "../stepsImportPhoto/parseXMLToBD.js";

const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
});

let report = `:::::: ${getTime()} :::::: Отчет ${Version} ::::::`
let reportForTelegram = `  ::::::  ${getTime()}  ::::::  `

let text = ''

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
    report +=    `\n 3. ⚡. В БД ${text} автомобиля`
    reportForTelegram += `  ➜  cars ⋲ ${text} `
    if (text < 1 ) break

    report += '\n ⚡⚡⚡ Предварительные таблицы заполнены из XML.'
    reportForTelegram += ' \nSUCCESS'

}


console.log('\n' + report)

try {
    setTimeout(() => sendEmail('ОБНОВЛЕНО:\n ' + report), 100)
} catch (e) {
    console.log('e1 = ', e)
}


try {
    setTimeout(() => sendTelegram(reportForTelegram), 2000)
} catch (e) {
    console.log('e2 = ', e)
}


