import {Version, getTime} from "../constants.js";
import {open} from "sqlite";
import sqlite3 from "sqlite3";
import {sendEmail} from "../post/sendEmail.js"
import {sendTelegram} from "../telegramReport.js";
import {copyXmlToFolder} from '../stepsImportPhoto/copyXmlToFolder.js'
import {clearTables} from '../stepsImportPhoto/clearTables.js'
import {parseXMLToBD} from "../stepsImportPhoto/parseXMLToBD.js";
import { promisify } from 'util';

const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
});

let report = `:::::: ${getTime()} :::::: Отчет ${Version} ::::::`
let reportForTelegram = `  ::::::  ${getTime()}  ::::::  `

let text = ''

try {
    // 1
    text = await copyXmlToFolder();
    report += `\n 1. ${text}`;
    reportForTelegram += '  ➜  copy_XML';
    if (text.indexOf('⚡') < 0) throw new Error('copyXmlToFolder failed');

    // 2
    text = await clearTables(db);
    report += `\n 2. ${text}`;
    reportForTelegram += '  ➜  clear_BD';
    if (text.indexOf('⚡') < 0) throw new Error('clearTables failed');

    // 3
    text = await parseXMLToBD(db);
    report += `\n 3. ⚡. В БД ${text} автомобиля`;
    reportForTelegram += `  ➜  cars ⋲ ${text} `;
    if (text < 1) throw new Error('No cars found in XML');

    report += '\n ⚡⚡⚡ Предварительные таблицы заполнены из XML.';
    reportForTelegram += ' \nSUCCESS';
} catch (error) {
    report += `\n ❌ Ошибка: ${error.message}`;
    reportForTelegram += `\n ❌ Ошибка: ${error.message}`;
    console.error('Error in processing pipeline:', error);
}


console.log('\n' + report)

try {
    // Promisify setTimeout for better async handling
    const delay = promisify(setTimeout);
    
    // Send email with delay
    await delay(100);
    await sendEmail('ОБНОВЛЕНО:\n ' + report);
} catch (e) {
    console.error('Error sending email:', e);
    report += `\n ❌ Ошибка при отправке email: ${e.message}`;
}

/*
try {
    // Send Telegram message with delay
    await delay(2000);
    await sendTelegram(reportForTelegram);
} catch (e) {
    console.error('Error sending Telegram message:', e);
    reportForTelegram += `\n ❌ Ошибка при отправке Telegram: ${e.message}`;
}
*/
