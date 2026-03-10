import axios from 'axios';
import {parseString} from 'xml2js';
import {insertCars, findAndProcessCars} from './ServiceCars.js'
import ServiceSections from "./ServiceSections.js";
import PrepareXMLService from "./PrepareXMLService.js"

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
    // находим новые ссылки на фото, добавляем,
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

            await ServiceSections.clearTables(db);
            await ServiceSections.createTables(db);

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

            console.log(`⚡ Total sections imported: ${totalResult.sectionsImported}`);


            // TODO когда все удачно, подменяю. Нужно тервожный сигнал себе отправлять, если неудачно
// TODO - потом включим. Перед копированием нужно создать список фоток для удаления и добавления.

// await this.copyToInfoTables(db);
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

                await ServiceSections.processSections(global.db);
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



    async copyToInfoTables(db) {
        try {
            // Create a_car table if it doesn't exist (matching cars_table structure)
            // language=SQLite
            await db.exec(`
                CREATE TABLE IF NOT EXISTS a_car (
                    id TEXT PRIMARY KEY,
                    name TEXT,
                    section TEXT,
                    price REAL,
                    prop_milleage INTEGER,
                    prop_year INTEGER,
                    prop_color TEXT,
                    prop_engine_capacity REAL,
                    prop_engine_type TEXT,
                    prop_power INTEGER,
                    prop_transmission_type TEXT,
                    prop_drive TEXT,
                    prop_body_type TEXT,
                    prop_steering_wheel TEXT,
                    prop_address TEXT,
                    prop_options TEXT,
                    prop_guarantee TEXT,
                    prop_city TEXT,
                    prop_brand TEXT,
                    prop_model TEXT,
                    prop_VIN TEXT,
                    images TEXT
                )
            `);

            // Create a_section table if it doesn't exist (matching sections_table structure)
            // language=SQLite
            await db.exec(`
                CREATE TABLE IF NOT EXISTS a_section
                (
                    id       TEXT PRIMARY KEY,
                    parentId TEXT,
                    Brand    TEXT,
                    Model    TEXT
                )
            `);

            // Clear existing data in a_car and a_section tables

            // TODO перед публикацией баз придется делать
            // await this.deleteFromTableIfExists(db, 'a_car');
            // await this.deleteFromTableIfExists(db, 'a_section');

            // Copy data from cars_table to a_car
            await this.copyTableData(db, 'cars_table', 'a_car');

            // Copy data from sections_table to a_section
            await this.copyTableData(db, 'sections_table', 'a_section');

            console.log('⚡ Data copied to a_car and a_section tables successfully');
        } catch (error) {
            console.error('Error copying data to info tables:', error.message);
            throw error;
        }
    }

    async copyTableData(db, sourceTable, targetTable) {
        try {
            // Check if source table exists
            const sourceExists = await db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${sourceTable}'`);

            if (!sourceExists) {
                console.log(`⚡ Source table ${sourceTable} does not exist, skipping copy to ${targetTable}`);
                return;
            }

            // Get all data from source table
            const sourceData = await db.all(`SELECT * FROM ${sourceTable}`);

            if (sourceData.length > 0) {
                // Build the column list dynamically
                const columns = Object.keys(sourceData[0]).join(', ');

                // Prepare placeholders for the INSERT statement
                const placeholders = Array(Object.keys(sourceData[0]).length).fill('?').join(', ');

                // Create INSERT statement
                const insertSql = `INSERT INTO ${targetTable} (${columns}) VALUES (${placeholders})`;

                // Insert all rows
                for (const row of sourceData) {
                    const values = Object.values(row);
                    await db.run(insertSql, values);
                }

                console.log(`⚡ Copied ${sourceData.length} rows from ${sourceTable} to ${targetTable}`);
            } else {
                console.log(`No data to copy from ${sourceTable} to ${targetTable}`);
            }
        } catch (error) {
            console.error(`Error copying data from ${sourceTable} to ${targetTable}:`, error.message);
            // Don't throw the error, just log it to allow the process to continue
        }
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
