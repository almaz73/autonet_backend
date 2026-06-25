import {getTime} from "../constants.js";
import {removeUnNecessary} from "./services/removeUnNecessary.js"
import {sendEmail} from "../post/sendEmail.js"
import {sendTelegram} from "../telegramReport.js";


let report = `:::::: ${getTime()} ::::::`
let reportForTelegram = `  ::::::  ${getTime()}  ::::::  `

let text = ''

for (let i in [1]) {
    // 10 удаление ненужных фоток
    text = await removeUnNecessary()
    reportForTelegram += `  ➜  remodev unNecessary ⋲ ${text} `
    report += `\n 10. ⚡. Удалены лишние фотки: ${text}`
    if (text == undefined) break

}

console.log('\n' + report)

try {
    setTimeout(() => sendEmail(report), 100)
} catch (e) {
}


// try {
//     setTimeout(() => sendTelegram(reportForTelegram), 2000)
// } catch (e) {
// }


