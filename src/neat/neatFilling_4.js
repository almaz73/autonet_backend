import {Version, getTime} from "../constants.js";
import {sendEmail} from "../post/sendEmail.js"
import {sendTelegram} from "../telegramReport.js";
import {publicBD} from "./services/publicBD.js"
import {open} from "sqlite";
import sqlite3 from "sqlite3";


const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
});

let report = `:::::: ${getTime()} ::::::`
let reportForTelegram = `  ::::::  ${getTime()}  ::::::  `

let text = ''

for (let i in [1]) {
    // 8
    text = await publicBD(db)
    reportForTelegram += '  ➜  public_BD '
    report += `\n 8. ${text}`
    if (text.indexOf('⚡') < 0) break

}

console.log('\n' + report)

try {
    setTimeout(() => sendEmail(report), 100)
} catch (e) {
    console.log('e1 = ', e)
}


// try {
//     setTimeout(() => sendTelegram(reportForTelegram), 2000)
// } catch (e) {
//     console.log('e2 = ', e)
// }


