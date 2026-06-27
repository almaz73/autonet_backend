// У нас есть список фоток на удаление front/LINKS/links_unnecessary.js.
// и есть таблица добавляемых авто
// создаем список авто на удалени, потом из таблицы добавленных достаем дату добавления, чтобы записать сколько дней продовался
// удаляем их из links_unnecessary, и записываем данные автомобиля (frendly), startDate, endDate, days


import path from "path";
import {FolderLINKS, transliterate} from "../../constants.js";
import fs from "fs";
import {open} from "sqlite";
import sqlite3 from "sqlite3";

let links_unnecessary = [] // список удаляемых фоток
let foundedBeforeDelete = [] // здесь список frendly удаляемых с витрины авто
let historyPeriodSell = []


const dbOld = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
});

const dbClient = await open({
    filename: './client.sqlite',
    driver: sqlite3.Database
});

// language=SQLite
const allOldCars = await dbOld.all(`
    SELECT id,
           images,
           prop_city     as sity,
           prop_year     as year,
           prop_brand    as brand,
           prop_model    as model,
           price,
           prop_milleage as milleage
    FROM a_car
    WHERE images IS NOT NULL
      AND images != ''
`);
// language=SQLite
const allAddedCars = await dbClient.all(`
    SELECT id, date, carsPerDay
    FROM history
    WHERE date >= date('now', '-1 month')
    ORDER BY date ASC
`);

console.log('allOldCars.length = ', allOldCars.length)
console.log('allAddedCars.length = ', allAddedCars.length)


async function findCarinTable(link) {
    let car = allOldCars.find(el => el && el.images.includes(link))
    if (car) {
        let forSitemap = car.brand + '-' + car.model + '-' + car.year + '-' + car.sity + '-' + car.price + '-' + car.milleage + 'km'
        forSitemap = transliterate(forSitemap)
        forSitemap = forSitemap.replaceAll(" ", "");
        if (!foundedBeforeDelete.includes(forSitemap)) foundedBeforeDelete.push(forSitemap)
    }
    return true
}

async function siclicSearchInOldBD() {
    // пробежимся по старой базе, найдем удаляемые авто
    await findCarinTable(links_unnecessary.pop().replaceAll('_small.webp', '').replaceAll('_big.webp', ''))
    if (links_unnecessary.length) await siclicSearchInOldBD()
}

async function findCreatedTime() {
    // пробежимся по списку ранее сохраненной истории по добавлению авто
    for (var i = 0; i < foundedBeforeDelete.length; i++) {
        let car = foundedBeforeDelete[i]
        let started = allAddedCars.find(el => el.carsPerDay && el.carsPerDay.includes(car))
        if (started) historyPeriodSell.push({car, startDate: started.date})
        else historyPeriodSell.push({car, startDate: null})
    }
}

async function savePeriodInBD() {
    try {
        // language=SQLite
        await dbClient.run(`
            CREATE TABLE IF NOT EXISTS history_period
            (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                car         TEXT,
                startedDate TEXT,
                endDate     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                days        INTEGER
            )
        `);

        for (let el in historyPeriodSell) {
            const startedDate = historyPeriodSell[el].startDate ? historyPeriodSell[el].startDate : null;
            let days = '-'
            if (startedDate) days = Math.floor(Math.abs(new Date(startedDate) - new Date()) / (1000 * 60 * 60 * 24));

            // language=SQLite
            const stmt = await dbClient.prepare(`
                INSERT INTO history_period (car, startedDate, endDate, days)
                VALUES (?, ?, CURRENT_TIMESTAMP, ?)`);
            await stmt.run(historyPeriodSell[el].car, startedDate, days);
        }
        return true

    } catch (error) {
        console.error('Error saving links in client:', error);
        throw error;
    }
}

export async function collectDeletedCars() {

    try {
        const filePath = path.join(FolderLINKS, 'links_unnecessary.js');
        const fileContent = fs.readFileSync(filePath, 'utf8');
        links_unnecessary = JSON.parse(fileContent)

        await siclicSearchInOldBD(links_unnecessary)
        await findCreatedTime()
        console.log(':: foundedBeforeDelete.length = ', foundedBeforeDelete.length)
        console.log(':::: historyPeriodSell.length = ', historyPeriodSell.length)

        await savePeriodInBD()

        return '⚡. Записана история удаляемых машин'
    } catch (e) {

    }
}