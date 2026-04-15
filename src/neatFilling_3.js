import {Version, getTime} from "./constants.js";
import {sendEmail} from "./post/sendEmail.js"
import {sendTelegram} from "./telegramReport.js";
import {addFirstPhotos} from "./neatFilling/addFirstPhotos.js"
import {addAllPhotos} from "./neatFilling/addAllPhotos.js"




let report = `:::::: ${getTime()} :::::: Отчет ${Version} ::::::`
let reportForTelegram = `  ::::::  ${getTime()}  ::::::  `

let text = ''

for (let i in [1]) {
    // 7 добавление первых фоток
    text = await addAllPhotos()
    reportForTelegram += `  ➜  addedAllPhoto ⋲ ${text} `
    report += `\n 7. ⚡. Добавление остальных фоток автомобиля: ${text}`
    if (text == undefined) break

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


