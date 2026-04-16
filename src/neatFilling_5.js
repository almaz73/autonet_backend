import {getTime} from "./constants.js";
import {removeUnNecessary} from "./neatFilling/removeUnNecessary.js"
import {sendEmail} from "./post/sendEmail.js"
import {sendTelegram} from "./telegramReport.js";


let report = `:::::: ${getTime()} ::::::`
let reportForTelegram = `  ::::::  ${getTime()}  ::::::  `

let text = ''

for (let i in [1]) {
    // 7 добавление первых фоток
    text = await removeUnNecessary()
    reportForTelegram += `  ➜  remodev unNecessary ⋲ ${text} `
    report += `\n 9. ⚡. Удалены лишние фотки: ${text}`
    if (text == undefined) break

}

console.log('\n' + report)

try {
    setTimeout(() => sendEmail(report), 100)
} catch (e) {
}


try {
    setTimeout(() => sendTelegram(reportForTelegram), 2000)
} catch (e) {
}


