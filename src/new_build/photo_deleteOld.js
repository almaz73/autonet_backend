import fs from 'fs';
import path from 'path';
import {fileURLToPath} from "url";
import {devMode, FolderPhoto, isLocal} from "../constants.js";
import {open} from "sqlite";
import sqlite3 from "sqlite3";
import {sendEmail} from "../post/sendEmail.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pubAutoPath = path.join(__dirname, '../..', FolderPhoto);

// сравнивая базу и список фоток, создаем список для удаления.
// логика:
// - собираю весь список фоток из БД
// - получаю весь список фоток из папки
// - получаю разницу
// - удаляю


// нужно вытащить ссылки на все файлы из папки ../front/pub_auto
let linksFolder = getLinksFromFolder()

console.log('linksFolder = ',linksFolder)
// фотки из БД
let linksFromBD = await getLinksFromBD()

// Вычитаем одно из другого, Нативное вычитание множеств
const difference = [...new Set(linksFolder).difference(new Set(linksFromBD))];

// удаляем старые фотки
let text = await removeOldPhotos(difference)

let result = `Удаление не используемых Фоток. В папке было ${linksFolder.length} фоток, в БД ссылки есть на ${linksFromBD.length}. Удалены ${text}`

console.log('старт УДАЛЯТОРА')

if (isLocal) console.log('result = ', result)
else await sendEmail(result);

function getLinksFromFolder() {
    try {
        const files = fs.readdirSync(pubAutoPath, {withFileTypes: true});

        let result = files
            // .map(file => ({
            //     // photoName: file.name,
            //     // createDate: fs.statSync(path.join(pubAutoPath, file.name)).birthtime
            // }));
            .map(el => el.name.split('_')[0])

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

    let allAuto = []
    for (let auto of allAutoDB) {
        if (auto && auto.length) {
            for (let link of auto) {
                let ind = link.lastIndexOf('/')
                allAuto.push(link.slice(ind + 1).split('.')[0])
            }
        }
    }

    return allAuto
}

export async function removeOldPhotos(difference) {
    console.log('difference = ',difference)
    if(difference.length<5) return ' 0 '
    try {
        // if (isLocal)
            difference.length = 5 // todo Пока тестируем. Удаялем по 5

        let count = 0
        for (const photo of difference) {
            let bigPhoto = photo + '_big.webp'
            let smallPhoto = photo + '_small.webp'

            await deleteFileByName(bigPhoto);
            await deleteFileByName(smallPhoto);
            count++
        }
        return count
    } catch (e) {
        console.log('removeOldPhotos e = ', e)
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