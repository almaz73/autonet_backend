/*
* Последовательный обход всех шагов обновления сайта
* */

import {open} from "sqlite";
import sqlite3 from "sqlite3";
import path from "path";
import {fileURLToPath} from "url";
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


const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.resolve(__dirname, '../../database.sqlite')

const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
});
addReportAboutUpdate(`\n\n:: ${getTime()} :: Отчет ${Version} ::`)

const step = Number(process.argv[2]) || 0;  // если запускают файл с параметром step (только один узел) // для отладки
await startUpdate(step)

export async function startUpdate(step = 0) {
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
    let abortedStep = 0

    // критичный шаг: при ошибке следующие не выполняем, чтобы не опубликовать неполные данные
    const runStep = async (number, critical, action) => {
        if (abortedStep) return
        if (step && step !== number) return

        try {
            const text = await action()
            addReportAboutUpdate(`\n     ${number}. ${text}`)
        } catch (e) {
            const message = e?.message || String(e)
            console.error(`Ошибка шага ${number}:`, e)
            addReportAboutUpdate(`\n     ${number}. Ошибка: ${message}`)
            if (critical) abortedStep = number
        }
    }

    await runStep(1, false, _copyXml) // если XML не скачался, парсер возьмёт копию прошлого запуска
    await runStep(2, true, () => _clearTables(db))
    await runStep(3, true, () => _parseXMLToBD(db))
    await runStep(4, false, () => _clearBadPhotos(db))
    await runStep(5, true, () => _createHelpFiles(db))
    await runStep(6, false, _addNewPhotos)
    await runStep(7, true, () => _publicBD(db))
    await runStep(8, false, () => _updHistory())

    if (abortedStep) addReportAboutUpdate(`\n:: Обновление остановлено на шаге ${abortedStep} ::`)

    const endTime = performance.now();
    const duration = parseInt((endTime - startTime) / 1000);
    addReportAboutUpdate(`\n::   Общее время обновления сайта ${duration} сек. ::`)
    await db.close();

    console.log('reportAboutUpdate = ', reportAboutUpdate)
    if (!isLocal) await sendEmail(reportAboutUpdate);
}
