import {Version, getTime} from "../constants.js";
import {open} from "sqlite";
import sqlite3 from "sqlite3";
import {sendEmail} from "../post/sendEmail.js"
import {sendTelegram} from "../telegramReport.js";
import {clearBadPhotos} from './services/clearBadPhotos.js'
import {getAllNewCarsWithPhoto} from "./services/getAllNewCarsWithPhoto.js"
import {saveLinks} from "./services/saveLinks.js"


const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
});

let report = `:::::: ${getTime()} ::::::`
let reportForTelegram = `  ::::::  ${getTime()}  ::::::  `

let text = ''

for (let i in [1]) {
    //4 удаление плохих ссылок
    text = await clearBadPhotos(db)
    reportForTelegram += `  ➜  badLinks ⋲ ${text} `
    report += `\n 5. ⚡. Удалены ${text} авто с плохими фото-ссылками`
    if (text == undefined) break

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

    report += `\n 6, ⚡. Новые ${links_short_need.length} фото-ссылки подготовлены. В папке ${existPhotoslength} фоток. На удаление  ${links_unnecessary.length}`
    reportForTelegram += `  ➜  newLinks ${links_short_need.length} ➜ inFolder now: ${existPhotoslength} ➜ unnecessary: ${links_unnecessary.length}`
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


