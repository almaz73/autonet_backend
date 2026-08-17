import {getTime, addReportAboutUpdate} from "../constants.js";
import {sendEmail} from "../post/sendEmail.js"

import {collectDeletedCars} from "./services/historyOfSold.js";
import {promisify} from "util";



let report = `:::::: ${getTime()} ::::::`
let reportForTelegram = `  ::::::  ${getTime()}  ::::::  `

let text = ''

try {
    // 9 история удаляемых машин
    text = await collectDeletedCars()
    reportForTelegram += '  ➜  public_BD '
    report += `\n 9. ${text}`
    if (text && text.indexOf('⚡') < 0) throw new Error('collectDeletedCars returned no changes');
} catch (error) {
    report += `\n ❌ Ошибка: ${error.message}`;
    reportForTelegram += `\n ❌ Ошибка: ${error.message}`;
    console.error('Error in processing pipeline:', error);
}

console.log('\n' + report)
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

