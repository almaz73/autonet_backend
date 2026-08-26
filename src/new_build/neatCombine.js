/*
* Последовательный обход всех шагов обновления сайта
* */

import {open} from "sqlite";
import sqlite3 from "sqlite3";
import {getTime, Version, reportAboutUpdate, addReportAboutUpdate, isLocal} from "../constants.js";
import {_copyXml} from "../new_build/services/_copyXml.js"
import {_clearTables} from "../new_build/services/_clearTables.js";
import {_parseXMLToBD} from "../new_build/services/_parseXMLToBD.js"
import {_clearBadPhotos} from "../new_build/services/_clearBadPhotos.js";

import {_createHelpFiles} from "../new_build/services/_createHelpFiles.js"
import {_addNewPhotos} from '../new_build/services/_addNewPhotos.js'
import {_publicBD} from "../new_build/services/_publicBD.js"
import {_updHistory} from "../new_build/services/_updHistory.js";
import {sendEmail} from "../post/sendEmail.js";


const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
});
addReportAboutUpdate(`\n\n:: ${getTime()} :: Отчет ${Version} ::`)

const step = process.argv[2];  // если запускают файл с параметром step (только один узел) // для отладки
await startUpdate(+step)

export async function startUpdate(step) {
    // console.log(`   Идет обновление ...
    // 1. Загрузка XML
    // 2. Очистка таблиц
    // 3. Парсинг в БД
    // 4. Очистка плохих ссылок на фото
    // 5. Вспомогательные файлы
    // 6. Загрузка фоток
    // 7. Публикация БД
    // 8. Сохранение истории`)
    const startTime = performance.now();
    let rowsGlobal = []

    if (!step || step === 1) {
        try {
            // Копируем XML в свою папку
            let text = await _copyXml()
            addReportAboutUpdate(`\n     1. ${text}`); //1
        } catch (e) {
            addReportAboutUpdate('\n ошибка копирования XML')
        }
    }
    if (!step || step === 2) {
        try {
            // Чистим БД перед парсингом
            let text = await _clearTables(db)
            addReportAboutUpdate(`\n     2. ${text}`); //2
        } catch (e) {
            addReportAboutUpdate('\n ошибка очистки баз ', e)
        }
    }
    if (!step || step === 3) {
        try {
            // Парсинг XML и БД
            let text = await _parseXMLToBD(db)
            addReportAboutUpdate(`\n     3. ${text}`); //1
        } catch (e) {
            addReportAboutUpdate('\n ошибка парсинга XML = ', e)
        }
    }
    if (!step || step === 4) {
        try {
            // Удаляем плохие ссылки на фото, которые не открываются
            let text = await _clearBadPhotos(db)
            addReportAboutUpdate(`\n     4. ${text}`); //1
        } catch (e) {
            addReportAboutUpdate('\n ошибка удаления плохих ссылок на фото, авто без фоток =', e)
        }
    }
    if (!step || step === 5) {
        try {
            //Используя предыдущий список sitemap и новый список бд создаем вспомогательные файлы
            let text = await _createHelpFiles(db)
            addReportAboutUpdate(`\n     5.  ${text}`)
        } catch (e) {
            addReportAboutUpdate('\n Не получилось создать вспомогательные файлы', e)
        }
    }
    if (!step || step === 6) {
        try {
            // добавление новых фото
            let text = await _addNewPhotos()
            addReportAboutUpdate(`\n     6.  Добавление новых фоток: ${text} ${isLocal?"(не более 5 из-за режима dev)":""}`); //1
        } catch (e) {
            addReportAboutUpdate('\n Не получилось фотки', e)
        }
    }
    if (!step || step === 7) {
        try {
            // публикация
            let text = await _publicBD(db)
            addReportAboutUpdate(`\n     7.  Публикация новой БД ${text}`);
        } catch (e) {
            addReportAboutUpdate('\n Не получилось опубликовать', e)
        }
    }
    if (!step || step === 8) {
        try {
            // запись истории удаленных, добавленных
            let text = await _updHistory(rowsGlobal)
            addReportAboutUpdate(`\n     8.  ${text}`);
        } catch (e) {
            addReportAboutUpdate('\n Неудача сохранении истории', e)
        }
    }


    const endTime = performance.now();
    const duration = parseInt((endTime - startTime) / 1000);
    addReportAboutUpdate(`\n::   Общее время обновления сайта ${duration} сек. ::`)
    await db.close();

    if (isLocal) console.log('reportAboutUpdate = ', reportAboutUpdate)
    else await sendEmail(reportAboutUpdate);
}