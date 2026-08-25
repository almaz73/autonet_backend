import path from "path";
import {FolderLINKS, isToday, transliterate} from "../../constants.js";
import fs from "fs";

import {open} from "sqlite";
import sqlite3 from "sqlite3";


export async function _updHistory() {
    //1. Нужно сохранить список добавленных сегодня, с перепроверкой повторов
    //2. Нужно сохранить список удаленных, с перепроверкой, не удален ли уже
    // будем ориентироваться на links_deletedToday_cars, links_todays_cars и прежний список sitemap+id

    let text = await saveNewCarsForThisDay()
    text += await saveDeletedCarsForThisDay()

    return text
}

const dbClient = await open({
    filename: './client.sqlite',
    driver: sqlite3.Database
});

async function saveNewCarsForThisDay() {
    // language=SQLite
    const allAddedCars = await dbClient.all(`
        SELECT id, date, carsPerDay
        FROM history
        WHERE date >= date('now', '-1 day')
        ORDER BY date ASC
    `);


    let arrFromBD = allAddedCars[0] ? allAddedCars[0].carsPerDay.split(',') : []
    let ID = allAddedCars[0] ? allAddedCars[0].id : undefined
    let arrFromFile = []

    const filePath = path.join(FolderLINKS, '_newAuto.js'); // вытаскивание по дате
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const timeUpdateFile = fs.statSync(filePath);
    if (fileContent && isToday(new Date(timeUpdateFile.mtime))) arrFromFile = JSON.parse(fileContent)
    arrFromFile = arrFromFile.map(el => el.slice(39))

    // Объединение без дубликатов - общий список добавленных сегодня
    let result = [...new Set([...arrFromBD, ...arrFromFile])];
    result = result.filter(el => !el.includes('null'))
    const count = result.length;
    const carsPerDay = result.join(',');


    if (arrFromBD.length) { // уже есть за сегодня - обновляем список
        // language=SQLite
        const stmt = await dbClient.prepare(`REPLACE
                                                 INTO history (id, date, count, carsPerDay)
                                             VALUES (?, CURRENT_TIMESTAMP, ?, ?)`)
        await stmt.run(ID, count, carsPerDay);
    } else { // новая запись за сегодня
        // language=SQLite
        await dbClient.run(`
            CREATE TABLE IF NOT EXISTS history
            (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                date       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                count      INTEGER NOT NULL,
                carsPerDay TEXT    NOT NULL
            )
        `);

        // language=SQLite
        const stmt = await dbClient.prepare(`
            INSERT INTO history (date, count, carsPerDay)
            VALUES (CURRENT_TIMESTAMP, ?, ?)
        `);

        await stmt.run(count, carsPerDay);
    }
    return `В историю БД добавлено: ${result.length - arrFromBD.length}. Всего новых за сегодня: ${count}. `


}

async function saveDeletedCarsForThisDay() {
    let deletedLinksFromFile = []
    const filePath = path.join(FolderLINKS, '_oldAuto.js'); // вытаскивание по дате
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const timeUpdateFile = fs.statSync(filePath);

    if (fileContent && isToday(new Date(timeUpdateFile.mtime))) deletedLinksFromFile = JSON.parse(fileContent)

    // language=SQLite
    let allTodayDeletedCars = await dbClient.all(`
        SELECT id, car, startedDate, endDate
        FROM history_period
        WHERE endDate >= date('now', '-1 day')
        ORDER BY endDate ASC
    `);

    allTodayDeletedCars = allTodayDeletedCars.map(el => el.car)
    deletedLinksFromFile = deletedLinksFromFile.filter(el => !allTodayDeletedCars.includes(el.loc.slice(39)))
    

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

    for (let el in deletedLinksFromFile) {
        const startedDate = deletedLinksFromFile[el].lastmod ? deletedLinksFromFile[el].lastmod : null;
        let days = '-'
        if (startedDate) days = Math.floor(Math.abs(new Date(startedDate) - new Date()) / (1000 * 60 * 60 * 24));
        let car = deletedLinksFromFile[el].loc.slice(39)


        // language=SQLite
        const stmt = await dbClient.prepare(`
            INSERT INTO history_period (car, startedDate, endDate, days)
            VALUES (?, ?, CURRENT_TIMESTAMP, ?)`);
        await stmt.run(car, startedDate, days);
    }
    return `В истории БД удаленных за сегодня: ${deletedLinksFromFile.length}`

}


