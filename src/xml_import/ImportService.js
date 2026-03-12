import {parseString} from 'xml2js';
import {insertCars, findAndProcessCars} from './ServiceCars.js'
import PreliminaryTables from "./PreliminaryTables.js";
import PrepareXMLService from "./PrepareXMLService.js"
import A_car from "../API/A_car.js";
import PreparePhotoService from "./PreparePhotoService.js";
import path from "path";

class importService {
    constructor() {
        this.xmlNames = [
            'AVTO_NIGNEKAMSK.xml',
            'AlfaAvto5_AMK.xml',
            'AlfaAvto5_Astrahan.xml',
            'AlfaAvto5_Tver.xml',
            'alfa5_gktm.xml',
            'alfa-trade.xml'
        ];
    }

    // по команде api/import-xml запускается этот метод
    // Сперва скачиваем xml к себе, это обеспечит отсутствие некоторых xml, и чтобы не потерять данные
    // Потом по скачанным xml создаем предварительные таблицы, заранее очистив их
    // Из предварительных таблиц, создаем черновичные таблицы, которые потом станут таблицами для работы сайта
    // Проверяем дубликаты на VIN, если есть сообщаем
    // Сосчитаем общее количество ссылок на фото
    // Создаем список ссылок на фото на "старой" базе, из опубликованной рабочей базы
    // Создаем список ссылок из "новой" базы, только что слитой из XML

    // Находим новые ссылки на фото, добавляем,
    // опубликуем новую базу
    // Устаревшие фотки удаляем
    // Проверяем устаревшие больше чем на 2 месяца фотки, создаем список, если они еще активны, если нет удаляем

    // Который по всем ссылкам из массива xmlUrls последовательно скачивает,
    // парсит и сохраняет данные в базу данных. Перед сохранением данных,
    // он очищает все таблицы, чтобы избежать дублирования.
    // В конце он возвращает статистику по количеству импортированных секций и автомобилей.
    async importXmlData(db) {
        try {
            console.time('⚡ Общее время обновления')

            await PrepareXMLService.saveXmlFilesToPublic() // копируем к себе из интернета
            await PreliminaryTables.clearTables(db);
            await PreliminaryTables.createTables(db); // почистили старые предварительные базы

            let totalResult = {
                sectionsImported: 0,
                carsImported: 0,
                total: 0
            };
            for (const xmlName of this.xmlNames) {
                let xmlData = await PrepareXMLService.getXMLContent(xmlName)

                const result = await new Promise((resolve, reject) => {
                    parseString(xmlData, {
                        explicitArray: false,
                        ignoreAttrs: false
                    }, (err, result) => {
                        if (err) {
                            console.error('Errorparsing XML:', err);
                            reject(err);
                            return;
                        }

                        this.processXmlData(result, db)
                            .then(resolve)
                            .catch(reject);
                    });
                });

                // Accumulate results from each XML file
                totalResult.sectionsImported += result.sectionsImported;
                totalResult.carsImported += result.carsImported;
                totalResult.total += result.total;
            }

            // Считаем общее количество ссылок на фото
            let newPhotos = await A_car.getNewLinks()
            console.log('⚡ all newPhoto links:', newPhotos.length)
            let oldPhotos = await A_car.getOldLinks()
            console.log('⚡ all oldPhoto links:', oldPhotos.length)


            const newLinksWithPhoto = newPhotos.filter(link => !oldPhotos.includes(link));
            console.log('⚡ ::: Появились новые фотки:', newLinksWithPhoto.length)


            if (newLinksWithPhoto.length) {
                console.log('⚡ ::: Фотки адаптируем и кладем в папку')
                let placeInLine = 0
                for (const url of newLinksWithPhoto) {
                    placeInLine++
                    if (placeInLine > 2) break // todo пока по частям добавляем
                    await PreparePhotoService.addNewPhoto(url, placeInLine)
                }
            }

            ////////////////////////////////////////////////////////////////////////////////////////////////////////////


            // тут обновляем базы из временных в работающие
            console.log('⚡ Публикуем обновленную базу ')
            console.log('⚡ ====================================')
            await PreliminaryTables.copyToInfoTables(db);
            // тут нужно будет удалять кэш, если был


            // нет ли копий VIN
            await A_car.checkDuplicateVINs()

            // Находим устаревшие ссылки (которые есть в oldLinks, но нет в newLinks)
            const staleLinksWithPhoto = oldPhotos.filter(link => !newPhotos.includes(link));
            console.log('⚡ ::: Список фоток на удаление:', staleLinksWithPhoto.length)

            if (staleLinksWithPhoto.length) {
                console.log('⚡ ::: Удаляем фотки')
                let placeInLine = 0
                for (const url of staleLinksWithPhoto) {

                    const urlObj = new URL(url);
                    let originalFilename = path.basename(urlObj.pathname);
                    const baseName = path.parse(originalFilename).name;

                    placeInLine++
                    if (placeInLine > 2) break // todo пока по частям удаляем
                    await PreparePhotoService.deleteFileByName(baseName+'_small.webp')
                    await PreparePhotoService.deleteFileByName(baseName+'_big.webp')
                }
            }




            // TODO когда все удачно, подменяю. Нужно тервожный сигнал себе отправлять, если неудачно



// TODO нужно будет дополнительное удаление файлов по старости, и заодно создавать талицу непродоваемых авто
// TODO для этого находим все файлы по старости (2 месяца), ищем в списке существующих, и удаляем те, которых нет в списке.
// TODO И добавляем в базу непродаваемых авто в отдельную таблицу (просто для знакомства)

            await PrepareXMLService.getOldPhotoToDelete()



            console.timeEnd('⚡ Общее время обновления')

            console.log(' ')
            console.log('▼ Дополнительно проверяю и добрасываю недостающие фотки ▼')

            PreparePhotoService.uploadAllPhotos() // todo тут записывание обработанных фоток к себе в первый раз, вне потока импорта

            return totalResult;
        } catch (error) {
            console.error('Error fetching XML data:', error.message);
            throw error;
        }
    }


    async processXmlData(parsedData, db) {
        let sectionsCount = 0;
        let carsCount = 0;

        // Process the XML data to find sections and cars
        if (parsedData.catalog) {
            // Process sections
            if (parsedData.catalog.sections && parsedData.catalog.sections.section) {
                const sections = Array.isArray(parsedData.catalog.sections.section)
                    ? parsedData.catalog.sections.section
                    : [parsedData.catalog.sections.section];

                sectionsCount = await this.insertSections(sections, db);
            }

            // Process cars
            if (parsedData.catalog.cars && parsedData.catalog.cars.car) {
                const cars = Array.isArray(parsedData.catalog.cars.car)
                    ? parsedData.catalog.cars.car
                    : [parsedData.catalog.cars.car];

                carsCount = await insertCars(cars, db);

                await PreliminaryTables.processSections(global.db);
            }
        } else {
            // If catalog doesn't exist, try to find sections and cars anywhere in the structure
            sectionsCount = await this.findAndProcessSections(parsedData, db);
            carsCount = await findAndProcessCars(parsedData, db);
        }


        console.log(`⚡     добавлено СЕКЦИЙ: ${sectionsCount}, АВТОМОБИЛЕЙ: ${carsCount}`);
        return {
            sectionsImported: sectionsCount,
            carsImported: carsCount,
            total: sectionsCount + carsCount
        };
    }


    async insertSections(sections, db) {
        let insertedCount = 0;
        for (const section of sections) {
            try {
                //Convert the section object to a JSON string to store all fields
                const sectionData = JSON.stringify(section);

                // Check if section already exists (using a hash of the data to prevent duplicates)
                // language=SQLite
                const existingSection = await db.get(
                    'SELECT id FROM sections WHERE data = ?',
                    [sectionData]
                );

                if (!existingSection) {
                    // language=SQLite
                    await db.run(
                        'INSERT INTO sections (data) VALUES (?)',
                        [sectionData]
                    );

                    insertedCount++;
                    // console.log(`Inserted section: ${this.getSectionName(section)}`);
                } else {
                    // console.log(`Skipped duplicate section: ${this.getSectionName(section)}`);
                }
            } catch (error) {
                console.error('Error inserting section:', error.message, section);
            }
        }
        return insertedCount;
    }


    // Method to find and process sections incase they're not under catalog
    async findAndProcessSections(data, db, path = '') {
        let count = 0;

        if (data && typeof data === 'object') {
            // Check if this object contains sections
            if (data.sections && data.sections.section) {
                const sections = Array.isArray(data.sections.section)
                    ? data.sections.section
                    : [data.sections.section];
                count += await this.insertSections(sections, db);
            }

            // Also check for sections arrays that might not be nested in a "sections" container
            for (const key in data) {
                if (key.toLowerCase() === 'section' && Array.isArray(data[key])) {
                    count += await this.insertSections(data[key], db);
                } else if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
                    // Look for individual sectionobjects
                    if (this.looksLikeSectionObject(data[key])) {
                        // This looks like a section object
                        count += await this.insertSections([data[key]], db);
                    }
                    count += await this.findAndProcessSections(data[key], db, `${path}.${key}`);
                } else if (Array.isArray(data[key])) {
                    // Processarrays that might contain sections
                    for (const item of data[key]) {
                        if (item && typeof item === 'object' && this.looksLikeSectionObject(item)) {
                            count += await this.insertSections([item], db);
                        }
                    }
                }
            }
        }

        return count;
    }

    // Helper method to determine if an object looks like a sectionobject
    looksLikeSectionObject(obj) {
        // Check for common section properties
        return obj && (
            obj.name ||
            obj.title ||
            obj.address || obj.phones ||
            obj.schedule
        );
    }

}

export default new importService();
