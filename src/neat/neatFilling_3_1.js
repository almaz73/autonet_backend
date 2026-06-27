import {getTime} from "../constants.js";
import {sendEmail} from "../post/sendEmail.js"

import {collectDeletedCars} from "./services/historyOfSold.js";



let report = `:::::: ${getTime()} ::::::`
let reportForTelegram = `  ::::::  ${getTime()}  ::::::  `

let text = ''

for (let i in [1]) {
    // 9 история удаляемых машин
    text = await collectDeletedCars()
    reportForTelegram += '  ➜  public_BD '
    report += `\n 9. ${text}`
    if (text && text.indexOf('⚡') < 0) break

}

console.log('\n' + report)

try {
    setTimeout(() => sendEmail(report), 100)
} catch (e) {
}


// try {
//     setTimeout(() => sendTelegram(reportForTelegram), 2000)
// } catch (e) {
//     console.log('e2 = ', e)
// }


