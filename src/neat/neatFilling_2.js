import {getTime, addReport} from "../constants.js";
import {sendEmail} from "../post/sendEmail.js"
import {sendTelegram} from "../telegramReport.js";
import {addFirstPhotos} from "./services/addFirstPhotos.js"
import { promisify } from 'util';




let report = `:::::: ${getTime()} ::::::`
let reportForTelegram = `  ::::::  ${getTime()}  ::::::  `

let text = ''

try {
    // 7 добавление первых фоток
    text = await addFirstPhotos()
    reportForTelegram += `  ➜  addedFirstPhoto ⋲ ${text} `
    report += `\n 7. ⚡. Добавление основных фоток: ${text}`
    if (text == undefined) throw new Error('addFirstPhotos returned undefined')
} catch (error) {
    report += `\n ❌ Ошибка: ${error.message}`;
    reportForTelegram += `\n ❌ Ошибка: ${error.message}`;
    console.error('Error in processing pipeline:', error);
}

console.log('\n' + report)
addReport(report)
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
