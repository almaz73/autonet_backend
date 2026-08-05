import {Version, getTime} from "../constants.js";
import {sendEmail} from "../post/sendEmail.js"
import {sendTelegram} from "../telegramReport.js";
import {publicBD} from "./services/publicBD.js"
import {open} from "sqlite";
import sqlite3 from "sqlite3";
import { promisify } from 'util';


const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
});

let report = `:::::: ${getTime()} ::::::`
let reportForTelegram = `  ::::::  ${getTime()}  ::::::  `

let text = ''

try {
    // 10 публикация
    text = await publicBD(db)
    reportForTelegram += '  ➜  public_BD '
    report += `\n 10. ${text}`
    if (text.indexOf('⚡') < 0) throw new Error('publicBD returned no changes');
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
    await sendEmail(report);
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

