import {Version, getTime} from "./constants.js";
import {open} from "sqlite";
import sqlite3 from "sqlite3";
import {sendEmail} from "./post/sendEmail.js"
import {sendTelegram} from "./telegramReport.js";
import {clearBadPhotos} from './neatFilling/clearBadPhotos.js'
import {getAllNewCarsWithPhoto} from "./neatFilling/getAllNewCarsWithPhoto.js"
import {saveLinks} from "./neatFilling/saveLinks.js"


const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
});

let report = `:::::: ${getTime()} :::::: Отчет ${Version} ::::::`
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
        existPhotoslength
    } = await getAllNewCarsWithPhoto(db)

    await saveLinks('links_short_need.js', links_short_need)
    await saveLinks('links_all.js', links_all)
    await saveLinks('allCarsWitnPhoto.js', allCarsWitnPhoto)

    report += `\n 6, ⚡. ссылки ${links_short_need.length} подготовлены. в папке ${existPhotoslength} фоток.`
    reportForTelegram += `  ➜  newLinks ${links_short_need.length} ➜ inFolder now: ${existPhotoslength}`
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


