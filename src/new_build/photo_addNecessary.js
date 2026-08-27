import fs from 'fs';
import path from 'path';
import {fileURLToPath} from "url";
import {FolderPhoto, isLocal} from "../constants.js";
import {open} from "sqlite";
import sqlite3 from "sqlite3";
import {sendEmail} from "../post/sendEmail.js";
import {_saveLinks} from "./services/_saveLinks.js";
import PhotoSaver from "./services/_сreaterSmallBigPhotoSteps.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pubAutoPath = path.join(__dirname, '../..', FolderPhoto);

// сравнивая базу и список фоток, создаем список для добавления.
// логика:
// - собираю весь список фоток из БД
// - получаю весь список фоток из папки
// - получаю разницу
// - добавляю

console.log('старт ДОБАВЛЯТОРА фоток')
// нужно вытащить ссылки на все файлы из папки ../front/pub_auto
let linksFolder = getLinksFromFolder()
// фотки из БД
let {allBasedNamesBD, allLinksFromXMLBD} = await getLinksFromBD()

// Вычитаем одно из другого, Нативное вычитание множеств
const difference = [...new Set(allBasedNamesBD).difference(new Set(linksFolder))];
let newPhotosFromAdder = []

console.log('Недостающих : ', difference.length)

// добавляем недостающие фотки
let text = await collectPhotoBasedNames(difference)

let result = `Добавление недостающих фоток. В папке было ${linksFolder.length} фоток, в БД есть ссылки на ${allBasedNamesBD.length}. Добавлены ${text}`

await _saveLinks('_newPhotosFromAdder.js', newPhotosFromAdder)
console.log('ОТЧЕТ: ', result)
if (!isLocal) await sendEmail(result);

function getLinksFromFolder() {
    try {
        const files = fs.readdirSync(pubAutoPath, {withFileTypes: true});

        let result = files
            // .map(file => ({
            //     // photoName: file.name,
            //     // createDate: fs.statSync(path.join(pubAutoPath, file.name)).birthtime
            // }));
            .map(el => el.name.slice(0, -5).replace('_small', '').replace('_big', ''))

        result = [...new Set(result)]

        return result;
    } catch (error) {
        console.error('Ошибка при получении ссылок на фото:', error);
        return [];
    }
}

async function getLinksFromBD() {
    const db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });
    // получаем список всех авто
    // language=SQLite
    let allAutoDB = await db.all(`
        SELECT ac.images
        FROM a_car ac
                 LEFT JOIN a_section ast ON ac.section = ast.id
    `);
    await db.close();

    allAutoDB = allAutoDB.map(el => el.images && el.images.split(','))

    let allBasedNamesBD = []
    let allLinksFromXMLBD = []

    for (let auto of allAutoDB) {
        if (auto && auto.length) {
            for (let link of auto) {
                let ind = link.lastIndexOf('/')
                allBasedNamesBD.push(link.slice(ind + 1).split('.')[0])
                allLinksFromXMLBD.push(link)
            }
        }
    }

    return {allBasedNamesBD, allLinksFromXMLBD}
}

export async function collectPhotoBasedNames(difference) {
    try {
        let count = 0
        console.time('🐾 Общее время размещения фоток')
        for (const photo of difference) {
            let linkXML = allLinksFromXMLBD.find(el=>el.includes(photo))
            await PhotoSaver.savePhotoToServer(linkXML, FolderPhoto);
            newPhotosFromAdder.push(photo)
            count++
        }
        console.timeEnd('🐾 Общее время размещения фоток')
        return count
    } catch (e) {
        console.log('collectPhotoBasedNames e = ', e)
    }
}

async function deleteFileByName(filename) {
    try {
        if (!filename) return {error: 'Filename is required'};
        const filePath = path.join(pubAutoPath, filename)
        await fs.promises.unlink(filePath);
        console.log(`       👻  ${filename} - удален`)
    } catch (error) {
        console.log('Error deleting file:', error.message)
        return {error: error.message};
    }
}