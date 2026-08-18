import {getTime, addReportAboutUpdate, reportAboutUpdate} from "../constants.js";
import {open} from "sqlite";
import sqlite3 from "sqlite3";
import {sendEmail} from "../post/sendEmail.js"
import {sendTelegram} from "../telegramReport.js";
import {clearBadPhotos} from './services/clearBadPhotos.js'
import {getAllNewCarsWithPhoto} from "./services/getAllNewCarsWithPhoto.js"
import {saveLinks} from "./services/saveLinks.js"
import { promisify } from 'util';


const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
});

let report = `:::::: ${getTime()} ::::::`
let reportForTelegram = `  ::::::  ${getTime()}  ::::::  `

let text = ''

try {
    // 4. удаление плохих ссылок
    text = await clearBadPhotos(db);
    reportForTelegram += `  ➜  badLinks ⋲ ${text} `
    report += `\n 5. ⚡. Отредактированы ${text} авто, удалены плохие фото-ссылки`
    if (text == undefined) throw new Error('clearBadPhotos returned undefined')

    // 5. получение ссылок для обновления
    let {
        links_short_need,
        links_all,
        allCarsWitnPhoto,
        existPhotoslength,
        links_unnecessary
    } = await getAllNewCarsWithPhoto(db)

    await saveLinks('links_short_need.js', links_short_need)
    await saveLinks('links_all.js', links_all)
    await saveLinks('allCarsWitnPhoto.js', allCarsWitnPhoto)
    await saveLinks('links_unnecessary.js', links_unnecessary)

    report += `\n 6, ⚡. Новые ${links_short_need.length} фото-ссылки подготовлены. В папке ${existPhotoslength} фоток. На удаление  ${links_unnecessary.length}.`
    reportForTelegram += `  ➜  newLinks ${links_short_need.length} ➜ inFolder now: ${existPhotoslength} ➜ unnecessary: ${links_unnecessary.length}`
} catch (error) {
    report += `\n ❌ Ошибка: ${error.message}`;
    reportForTelegram += `\n ❌ Ошибка: ${error.message}`;
    console.error('Error in processing pipeline:', error);
}

// console.log('\n' + report)

addReportAboutUpdate(report)

// try {
//     // Promisify setTimeout for better async handling
//     const delay = promisify(setTimeout);
//
//     // Send email with delay
//     await delay(100);
//     await sendEmail(report);
// } catch (e) {
//     console.error('Error sending email:', e);
//     report += `\n ❌ Ошибка при отправке email: ${e.message}`;
// }

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


