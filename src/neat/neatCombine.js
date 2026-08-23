/*
* Последовательный обход всех шагов обновления сайта
* */

import {open} from "sqlite";
import sqlite3 from "sqlite3";
import {getTime, Version, reportAboutUpdate, addReportAboutUpdate} from "../constants.js";
import {_copyXml} from "./services/_copyXml.js"
import {_clearTables} from "./services/_clearTables.js";
import {_parseXMLToBD} from "./services/_parseXMLToBD.js"
import {_clearBadPhotos} from "./services/_clearBadPhotos.js";
import {_getAllNewCarsWithPhoto} from "./services/_getAllNewCarsWithPhoto.js";
import {_saveLinks} from "./services/_saveLinks.js";
import {_publicBD} from "./services/_publicBD.js"
import {_updateSitemap} from "./services/_updateSitemap.js"
import {_addFirstPhotos} from "./services/_addFirstPhotos.js";
import {_addAllPhotos} from "./services/_addAllPhotos.js";
import {_saveHistory} from './services/_saveHistory.js'

const db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
});
addReportAboutUpdate(`:: ${getTime()} :: Отчет ${Version} ::`)

const step = process.argv[2];  // если запускают файл с параметром step (только один узел) // для отладки
startUpdate(+step)

export async function startUpdate(step) {
    console.log('Идет обновление ...')
    const startTime = performance.now();
    let rowsGlobal = []

    if (!step || step === 1) {
        try {
            // Копируем XML в свою папку
            let text = await _copyXml()
            addReportAboutUpdate(`\n 1. ${text}`); //1
        } catch (e) {
            addReportAboutUpdate('\n ошибка копирования XML')
        }
    }
    if (!step || step === 2) {
        try {
            // Чистим БД перед парсингом
            let text = await _clearTables(db)
            addReportAboutUpdate(`\n 2. ${text}`); //2
        } catch (e) {
            addReportAboutUpdate('\n ошибка очистки баз ', e)
        }
    }
    if (!step || step === 3) {
        try {
            // Парсинг XML и БД
            let text = await _parseXMLToBD(db)
            addReportAboutUpdate(`\n 3. ${text}`); //1
        } catch (e) {
            addReportAboutUpdate('\n ошибка парсинга XML = ', e)
        }
    }
    if (!step || step === 4) {
        try {
            // Удаляем плохие ссылки на фото, которые не открываются
            let text = await _clearBadPhotos(db)
            addReportAboutUpdate(`\n 4. ${text}`); //1
        } catch (e) {
            addReportAboutUpdate('\n ошибка удаления плохих ссылок на фото, авто без фоток =', e)
        }
    }
    if (!step || step === 5) {
        try {
            // сравнивая БД составляем список добавляемых фото для новых авто и удаляемых фото удаленных авто
            let {
                links_short_need,
                links_all,
                allCarsWitnPhoto,
                existPhotoslength,
                links_unnecessary
            } = await _getAllNewCarsWithPhoto(db)

            await _saveLinks('links_short_need.js', links_short_need)
            await _saveLinks('links_all.js', links_all)
            await _saveLinks('allCarsWitnPhoto.js', allCarsWitnPhoto)
            await _saveLinks('links_unnecessary.js', links_unnecessary)

            let text = ` Новые ${links_short_need.length} фото-ссылки подготовлены. В папке ${existPhotoslength} фоток. На удаление  ${links_unnecessary.length}.`
            addReportAboutUpdate(`\n 5. ${text}`);
        } catch (e) {
            addReportAboutUpdate('\n Создаем список вновьдобавленных и удаленных =', e)
        }
    }
    if (!step || step === 6) {
        try {
            // добавление главных фото (отдельно, чтобы оптимизипровать - возможно не надо делить todo)
            let text = await _addFirstPhotos()
            addReportAboutUpdate(`\n 6.  Добавление главных фоток: ${text}`); //1
        } catch (e) {
            addReportAboutUpdate('\n Не получилось добавить первые фотки', e)
        }
    }
    if (!step || step === 7) {
        try {
            // добавление остальных фото
            let text = await _addAllPhotos()
            addReportAboutUpdate(`\n 7.  Добавление остальных фоток: ${text}`); //1
        } catch (e) {
            addReportAboutUpdate('\n Не получилось добавить все остальные фотки', e)
        }
    }
    if (!step || step === 8) {
        try {
            // публикация фото
            let text = await _publicBD(db)
            addReportAboutUpdate(`\n 8.  Публикация новой БД ${text}`);
        } catch (e) {
            addReportAboutUpdate('\n Не получилось опубликовать', e)
        }
    }
    if (!step || step === 9) {
        try {
            // обновление sitemap
            let {text, rows} = await _updateSitemap()
            rowsGlobal = rows
            addReportAboutUpdate(`\n 9.  Обновлен sitemap.xml ${text}`);
        } catch (e) {
            addReportAboutUpdate('\n Неудача при обновлении sitemap', e)
        }
    }
    if (!step || step === 10) {
        try {
            // запись истории удаленных, добавленных, список
            if (!rowsGlobal.length)  rowsGlobal = await _updateSitemap('onlyRows')
            let text = await _saveHistory(rowsGlobal)
            addReportAboutUpdate(`\n 10.  ${text}`);
        } catch (e) {
            addReportAboutUpdate('\n Неудача сохранении истории', e)
        }
    }

    const endTime = performance.now();
    const duration = parseInt((endTime - startTime) / 1000);
    addReportAboutUpdate(`\n::   Общее время обновления сайта ${duration} сек. ::`)
    await db.close();
    prepareEmail()
}


function prepareEmail() {
    console.log(reportAboutUpdate)
}