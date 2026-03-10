import {parseString} from 'xml2js';
import {insertCars, findAndProcessCars} from './ServiceCars.js'
import PreliminaryTables from "./PreliminaryTables.js";
import PrepareXMLService from "./PrepareXMLService.js"
import A_car from "../API/A_car.js";

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
    // Опубликуем новую базу
    // Устаревшие фотки удаляем
    // Проверяем устаревшие больше чем на 2 месяца фотки, создаем список, если они еще активны, если нет удаляем

    // который по всем ссылкам из массива xmlUrls последовательно скачивает,
    // парсит и сохраняет данные в базу данных. Перед сохранением данных,
    // он очищает все таблицы, чтобы избежать дублирования.
    // В конце он возвращает статистику по количеству импортированных секций и автомобилей.
    async importXmlData(db) {
        try {
            console.time('⚡ Время парсинга xml в предварительные базы')

            await PreliminaryTables.clearTables(db);
            await PreliminaryTables.createTables(db);

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

                        console.log('⚡ заполняем базу из xml...');
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

            // нет ли копий VIN
            await A_car.checkDuplicateVINs()

            // Считаем общее количество ссылок на фото
            let newLinks = await A_car.getNewLinks()
            console.log('⚡ newLinks',newLinks.length)
            let oldLinks = await A_car.getOldLinks()
            console.log('⚡ oldLinks',oldLinks.length)

            // Находим устаревшие ссылки (которые есть в oldLinks, но нет в newLinks)
            const staleLinks = oldLinks.filter(link => !newLinks.includes(link));
            console.log('⚡ устаревшие ссылки', staleLinks.length)

            const addLinks = newLinks.filter(link => !oldLinks.includes(link));
            console.log('⚡ добавляемые ссылки', addLinks.length)

// ... existing code ...


            // TODO когда все удачно, подменяю. Нужно тервожный сигнал себе отправлять, если неудачно
// TODO - потом включим. Перед копированием нужно создать список фоток для удаления и добавления.


// await PreliminaryTables.copyToInfoTables(db);
// TODO после скопирования удалить несуществующие файлы
// TODO нужно будет дополнительное удаление файлов по старости, и заодно создавать талицу непродоваемых авто
// TODO для этого находим все файлы по старости (2 месяца), ищем в списке существующих, и удаляем те, которых нет в списке.
// TODO И добавляем в базу непродаваемых авто в отдельную таблицу (просто для знакомства)



            console.log('⚡ ::: SUCCESS Предварительные таблицы запонены :::');

            // PhotoPrepareService.savePhotos() // todo тут записывание обработанных фоток к себе

            console.timeEnd('⚡ Время парсинга xml в предварительные базы')

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

        console.log(`⚡ success импортированы Секций: ${sectionsCount} и автомобилей: ${carsCount}`);
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
