import {getTime} from "../constants.js";
import {removeUnNecessary} from "./services/removeUnNecessary.js"
import {sendEmail} from "../post/sendEmail.js"
import {sendTelegram} from "../telegramReport.js";
import { promisify } from 'util';


let report = `:::::: ${getTime()} ::::::`
let reportForTelegram = `  ::::::  ${getTime()}  ::::::  `

let text = ''

try {
    // 11 удаление ненужных фоток
    text = await removeUnNecessary()
    reportForTelegram += `  ➜  remodev unNecessary ⋲ ${text} `
    report += `\n 11. ⚡. Удалены лишние фотки: ${text}`
    if (text == undefined) throw new Error('removeUnNecessary returned undefined');
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


