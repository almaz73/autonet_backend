import {addReport, getTime} from "../constants.js";
import {sendEmail} from "../post/sendEmail.js"
import {sendTelegram} from "../telegramReport.js";
import {addAllPhotos} from "./services/addAllPhotos.js"
import { promisify } from 'util';




let report = `:::::: ${getTime()} ::::::`
let reportForTelegram = `  ::::::  ${getTime()}  ::::::  `

let text = ''

try {
    // 8 добавление остальных фоток
    text = await addAllPhotos()
    reportForTelegram += `  ➜  addedAllPhoto ⋲ ${text} `
    report += `\n 8. ⚡. Добавление остальных фоток автомобиля: ${text}`
    if (text == undefined) throw new Error('addAllPhotos returned undefined');
} catch (error) {
    report += `\n ❌ Ошибка: ${error.message}`;
    reportForTelegram += `\n ❌ Ошибка: ${error.message}`;
    console.error('Error in processing pipeline:', error);
}

console.log('\n' + report)
addReport(report)
// try {
//     setTimeout(() => sendEmail(report), 100)
// } catch (e) {
//     console.log('e1 = ', e)
// }

/*
try {
    // Promisify setTimeout for better async handling
    const delay = promisify(setTimeout);
    
    // Send Telegram message with delay
    await delay(2000);
    await sendTelegram(reportForTelegram);
} catch (e) {
    console.error('Error sending Telegram message:', e);
    reportForTelegram += `\n ❌ Ошибка при отправке Telegram: ${e.message}`;
}
*/

