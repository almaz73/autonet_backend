import {parentPort, workerData} from 'worker_threads';
import {devMode, FolderPhoto} from '../constants.js'
import {open} from 'sqlite';
import sqlite3 from 'sqlite3';
import PrepareXMLService from "../xml_import/PrepareXMLService.js";
import PreliminaryTables from "../xml_import/PreliminaryTables.js";
import {parseString} from "xml2js";
import PreparePhotoService from "../xml_import/PreparePhotoService.js";
import path from "path";
import {findAndProcessCars, insertCars} from "../xml_import/ServiceCars.js";
import PhotoSaver from "../xml_import/CreaterSmallBigPhoto.js";
import fs from "fs";
import {sendTelegram} from "../telegramReport.js";

async function processXMLImport() {
    try {
        console.log('================== Обработка XML импорта в параллельном потоке... ==================');

        const db = await open({
            filename: './database.sqlite',
            driver: sqlite3.Database
        });

        const result = await importXmlData(db);

        await db.close();

        parentPort.postMessage({status: 'COMPLETE', message: result});
    } catch (error) {
        parentPort.postMessage({
            status: 'ERROR',
            message: 'Ошибка при обработке XML',
            error: error.message
        });
    }
}

// This should be the function you copied from ImportService
// Since you've already copied the method from ImportService,
// the implementation of importXmlData should already exist in this file
// at line 39 as shown in your selected code
// We'll call the existing function

// Start the processing
processXMLImport();

let xmlNames = [
    'AVTO_NIGNEKAMSK.xml',
    'AlfaAvto5_AMK.xml',
    'AlfaAvto5_Astrahan.xml',
    'AlfaAvto5_Tver.xml',
    'alfa5_gktm.xml',
    'alfa-trade.xml'
];
if (devMode) xmlNames = ['alfa-trade.xml']



async function getAllImageLinksFromBD() {
    const db = global.db
    try {
        // language=SQLite
        const results = await db.all(`
                SELECT images
                FROM a_car
                WHERE images IS NOT NULL
                  AND images != ''
            `);

        let links = []

        results.forEach(row => {
            if (row.images && typeof row.images === 'string') {
                links.push(...row.images.split(/, /));
            }
        });


        return links;
    } catch (error) {
        console.error('Error counting image links in a_car table:', error.message);
        throw error;
    }
}

async function getListExistPhoto() {
    try {


        // Check if directory exists
        if (!fs.existsSync(FolderPhoto)) {
            console.log(`Directory does not exist: ${FolderPhoto}`);
            return [];
        }

        const files = fs.readdirSync(FolderPhoto);
        let links = {}

        console.log('!!!!!!! links.length = ', links.length)

        files.forEach(el => {
            el = el.replace('_big.webp', '')
            el = el.replace('_small.webp', '')
            links[el] = 1
        })

        return Object.keys(links);
    } catch (error) {
        console.error('Error in getOldPhotoToDelete:', error.message);
        throw error;
    }
}
async function getCountUplFilews(db) {
    const ListExistPhoto = await getListExistPhoto()
    let count = 0
    try {
        let linksBD = await getAllImageLinksFromBD(db)

        if (linksBD) {
            for (const url of linksBD) {
                const fileName = url.split('/').pop().slice(0, -4)
                if (!ListExistPhoto.find(el => el === fileName)) count++
            }
            console.log('🐾🐾🐾 Теперь в базе ссылок:', linksBD.length)
            console.log('🐾🐾🐾 В папках уже есть фотки по этим ссылкам:', linksBD.length - count)
            console.log('🐾🐾🐾 Осталось обработать:', count)

        }
    } catch (error) {
        console.error('Error retrieving images from a_car table:', error.message);
        throw error;
    }
}
// лишние фотки в папке, которых уже нет в базе
async function unnecessaryPhoto(db) {
    try {

        // беру список файлов из папки
        let linksFolder = await getListExistPhoto()
        console.log(' 👻 👻 👻 Фоток в папке', linksFolder.length)
        // беру список файлов из базы
        let listBD = await getAllImageLinksFromBD(db)
        console.log(' 👻 👻 👻 Ссылок в базе', listBD.length)

        listBD = listBD.map(el => el.split('/').pop().slice(0, -4))
        const deprecatedPhoto = linksFolder.filter(link => !listBD.includes(link));

        console.log(' 👻 👻 👻 Фоток, которых уже нет в базе, но лежат в папке', deprecatedPhoto.length)


        await this.prepareUnnecesaryPhotoForDelete(deprecatedPhoto)

        return ' 👻 👻 👻 Удаление произошло '
    } catch (error) {
        console.error('Error in getOldPhotoToDelete:', error.message);
        throw error;
    }
}

async function uploadAllPhotos(db) {
    // await getCountUplFilews(db) // Сколько нжно хотел вычислить.. можно без этого  
    const ListExistPhoto = await getListExistPhoto()
    let count = 0
    let addCount = 0
    try {
        // Query the a_car table to get the images column
        // language=SQLite
        const cars = await db.all('SELECT images FROM a_car WHERE images IS NOT NULL AND images != ""');

        console.time('🐾🐾🐾 Общее время оптимизации/копирования фоток')

        for (const car of cars) {
            if (car.images) {
                let imageArray = [];
                imageArray = car.images.split(',').map(url => url.trim());

                let placeInLine = 0

                if(devMode) imageArray.length =2

                for (const url of imageArray) {
                    count++
                    placeInLine++
                    const urlParts = url.split('/');
                    let fileName = urlParts[urlParts.length - 1];
                    fileName = fileName.substring(0, fileName.lastIndexOf('.'));

                    let exist = ListExistPhoto.find(el => el === fileName)
                    if (exist) continue

                    addCount++

                    let zz = await PhotoSaver.savePhotoToServer(url, placeInLine, FolderPhoto);
                    console.log(zz, '(', addCount, ')');
                }
            }
        }

        console.timeEnd('🐾🐾🐾 Общее время оптимизации/копирования фоток')

        // await unnecessaryPhoto(db) // удаляем ненужные фотки

        return'Готово'
    } catch (error) {
        console.error('Error retrieving images from a_car table:', error.message);
        throw error;
    }
}

async function checkDuplicateVINs(db) {
    try {
        // Query to find duplicate prop_VIN values
        // language=SQLite
        const results = await db.all(`
            SELECT prop_VIN, COUNT(*) as count
            FROM a_car
            WHERE prop_VIN IS NOT NULL
              AND prop_VIN != ''
            GROUP BY prop_VIN
            HAVING COUNT(*) > 1
        `);


        let results2
        if (results.length) {
            // language=SQLite
            results2 = await db.all(`
                SELECT prop_VIN, name, prop_city as 'Город'
                FROM a_car
                WHERE prop_VIN = ?
            `, results[0].prop_VIN);
        }

        console.log('Дубликатов VIN:', results.length ? results : 'НЕТ');
        if (results2) console.log('results2', results2)
        return results.length ? results2 : 'Нет дубликатов VIN';
    } catch (error) {
        console.error('Error checking duplicate VINs in a_car table:', error.message);
        throw error;
    }
}

async function getOldLinks(db) {
    try {
        // Проверка наличия
        const tableInfo = await db.all("PRAGMA table_info(a_car)");
        const hasImagesColumn = tableInfo.some(column => column.name === 'images');

        // Query the a_car table to get all non-null images
        // language=SQLite
        let results = []
        if (hasImagesColumn) {
            results = await db.all(`
                SELECT images
                FROM a_car
                WHERE images IS NOT NULL
                  AND images != ''
            `);
        }

        let totalLinks = [];
        results.forEach(row => {
            if (row.images && typeof row.images === 'string') {
                const links = row.images.split(/, /).filter(link => link.trim() !== '');
                totalLinks.push(...links)
            }
        });

        return totalLinks
    } catch (error) {
        console.error('Error counting image links in a_car table:', error.message);
        throw error;
    }
}

async function getNewLinks(db) {
    try {
        // Query the a_car table to get all non-null images
        // language=SQLite
        const results = await db.all(`
            SELECT images
            FROM cars_table
            WHERE images IS NOT NULL
              AND images != ''
        `);

        let totalLinks = [];
        results.forEach(row => {
            if (row.images && typeof row.images === 'string') {
                const links = row.images.split(/, /).filter(link => link.trim() !== '');
                totalLinks.push(...links)
            }
        });

        return totalLinks
    } catch (error) {
        console.error('Error counting image links in a_car table:', error.message);
        throw error;
    }
}

function looksLikeSectionObject(obj) {
    // Check for common section properties
    return obj && (
        obj.name ||
        obj.title ||
        obj.address || obj.phones ||
        obj.schedule
    );
}

async function findAndProcessSections(data, db, path = '') {
    let count = 0;

    if (data && typeof data === 'object') {
        // Check if this object contains sections
        if (data.sections && data.sections.section) {
            const sections = Array.isArray(data.sections.section)
                ? data.sections.section
                : [data.sections.section];
            count += await insertSections(sections, db);
        }

        // Also check for sections arrays that might not be nested in a "sections" container
        for (const key in data) {
            if (key.toLowerCase() === 'section' && Array.isArray(data[key])) {
                count += await insertSections(data[key], db);
            } else if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
                // Look for individual sectionobjects
                if (looksLikeSectionObject(data[key])) {
                    // This looks like a section object
                    count += await insertSections([data[key]], db);
                }
                count += await findAndProcessSections(data[key], db, `${path}.${key}`);
            } else if (Array.isArray(data[key])) {
                // Processarrays that might contain sections
                for (const item of data[key]) {
                    if (item && typeof item === 'object' && looksLikeSectionObject(item)) {
                        count += await insertSections([item], db);
                    }
                }
            }
        }
    }

    return count;
}

function extractValue(value) {
    if (value && typeof value === 'object' && value._) return value._.toString().trim();
    if (value && typeof value === 'object') return JSON.stringify(value);
    return value ? value.toString().trim() : '';
}

async function processSectionRecursive(sections, db, parentInfo) {
    for (const section of sections) {
        const sectionData = section.data;

        // Extract id from the section data
        let id = '';
        if (sectionData.$ && sectionData.$.id) {
            id = extractValue(sectionData.$.id);
        } else if (sectionData.id && typeof sectionData.id === 'object' && sectionData.id._) {
            // Handle case where id is an object with a value
            id = extractValue(sectionData.id._);
        } else if (sectionData.id) {
            id = extractValue(sectionData.id);
        }

        // Skip if id equals 'ap_probeg'
        if (id === 'ap_probeg' || !id) continue;

        // Extract parentId - check various possible locations
        let parentId = parentInfo; // default to parentInfo passed from parent


        parentId = sectionData.$.parentid || sectionData.$.parentId || sectionData.$.parent_id || parentId;


        // Extract Brand and Model from the section data
        let Brand = '';
        let Model = '';

        if (parentId !== 'ap_probeg') Model = sectionData['_']
        else Brand = sectionData['_']


        // Insert into the new table only if we have meaningful data
        if (id && (Brand || Model)) {
            // language=SQLite
            await db.run(
                'INSERT OR REPLACE INTO sections_table (id, parentId, Brand, Model) VALUES (?, ?, ?, ?)',
                [id, parentId, Brand, Model]
            );
        }

        // Process subsections if they exist
        if (sectionData.section) {
            const subsections = Array.isArray(sectionData.section)
                ? sectionData.section
                : [sectionData.section];

            // Process each subsection recursively, passing current id as parent
            for (const subsection of subsections) {
                // Create a temporary section-like object for the subsection
                const tempSection = {data: subsection};
                await processSectionRecursive([tempSection], db, id);
            }
        }
    }
}

async function processSections(db) {
    try {
        // Get all sections from the database
        // language=SQLite
        const sections = await db.all('SELECT * FROM sections');

        // Parse the JSON data for each section
        const parsedSections = sections.map(section => ({
            ...section,
            data: JSON.parse(section.data)
        }));

        // Create a new table for sections with id, parentId, Brand, Model
        // language=SQLite
        await db.exec(`
            CREATE TABLE IF NOT EXISTS sections_table
            (
                id       TEXT PRIMARY KEY,
                parentId TEXT,
                Brand    TEXT,
                Model    TEXT
            )
        `);

        // Process sections and their potential subsections recursively
        await processSectionRecursive(parsedSections, db, '');

        // Get the processed data
        // language=SQLite
        const processedData = await db.all('SELECT * FROM sections_table');
        return {
            success: true,
            message: 'Sections processed successfully into sections_table',
            count: processedData.length,
            data: processedData
        };
    } catch (error) {
        console.error('Error processing sections:', error);
        throw error;
    }
}
async function processXmlData(parsedData, db) {
    let sectionsCount = 0;
    let carsCount = 0;

    // Process the XML data to find sections and cars
    if (parsedData.catalog) {
        // Process sections
        if (parsedData.catalog.sections && parsedData.catalog.sections.section) {
            const sections = Array.isArray(parsedData.catalog.sections.section)
                ? parsedData.catalog.sections.section
                : [parsedData.catalog.sections.section];

            sectionsCount = await insertSections(sections, db);
        }

        // Process cars
        if (parsedData.catalog.cars && parsedData.catalog.cars.car) {
            const cars = Array.isArray(parsedData.catalog.cars.car)
                ? parsedData.catalog.cars.car
                : [parsedData.catalog.cars.car];

            carsCount = await insertCars(cars, db);

            await processSections(db);
        }
    } else {
        // If catalog doesn't exist, try to find sections and cars anywhere in the structure
        sectionsCount = await findAndProcessSections(parsedData, db);
        carsCount = await findAndProcessCars(parsedData, db);
    }


    console.log(`⚡     добавлено СЕКЦИЙ: ${sectionsCount}, АВТОМОБИЛЕЙ: ${carsCount}`);
    return {
        sectionsImported: sectionsCount,
        carsImported: carsCount,
        total: sectionsCount + carsCount
    };
}

async function insertSections(sections, db) {
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
            } else {
                // console.log(`Skipped duplicate section: ${this.getSectionName(section)}`);
            }
        } catch (error) {
            console.error('Error inserting section:', error.message, section);
        }
    }
    return insertedCount;
}

async function importXmlData(db) {
    try {
        console.time('⚡ Общее время обновления')

        if (!devMode) await PrepareXMLService.saveXmlFilesToPublic()
        await PreliminaryTables.clearTables(db);
        await PreliminaryTables.createTables(db);

        let textForReport = ''

        for (const xmlName of xmlNames) {
            let xmlData = await PrepareXMLService.getXMLContent(xmlName)

            await new Promise((resolve, reject) => {
                parseString(xmlData, {
                    explicitArray: false,
                    ignoreAttrs: false
                }, (err, result) => {
                    if (err) {
                        console.error('Error parsing XML:', err);
                        reject(err);
                        return;
                    }

                    processXmlData(result, db)
                        .then(resolve)
                        .catch(reject);
                });
            });

        }


        // Считаем общее количество ссылок на фото
        let newPhotos = await getNewLinks(db)
        console.log('⚡ all newPhoto links:', newPhotos.length)
        let oldPhotos = await getOldLinks(db)
        console.log('⚡ all oldPhoto links:', oldPhotos.length)


        const newLinksWithPhoto = newPhotos.filter(link => !oldPhotos.includes(link));
        console.log('⚡ ::: >>> >>> >>> >>> >>> >>> Новые фото:', newLinksWithPhoto.length)
        textForReport += '>>> Новые фото: ' + newLinksWithPhoto.length


        if (newLinksWithPhoto.length && !devMode) {
            console.log('⚡ ::: Забираем к себе Новые фото:')
            let placeInLine = 0
            for (const url of newLinksWithPhoto) {
                placeInLine++
                // if (placeInLine > 2) break
                await PreparePhotoService.addNewPhoto(url, placeInLine)
            }
        }

        ////////////////////////////////////////////////////////////////////////////////////////////////////////////


        // тут обновляем базы из временных в работающие
        console.log('⚡ Публикуем обновленную базу ')
        console.log('⚡ ====================================')
        await PreliminaryTables.copyToInfoTables(db);

        // нет ли копий VIN
        await checkDuplicateVINs(db)

        // Находим устаревшие ссылки (которые есть в oldLinks, но нет в newLinks)
        const staleLinksWithPhoto = oldPhotos.filter(link => !newPhotos.includes(link));
        console.log('  ⚡ ::: Фото на удаление:', staleLinksWithPhoto.length)
        textForReport += '  ⚡ ::: Фото на удаление (по XML): '
            + staleLinksWithPhoto.length + ' ::: ⚡ '
            + new Date().toLocaleDateString('ru') +' '+ new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

        if (staleLinksWithPhoto.length && !devMode) {
            console.log('⚡ ::: Удаляем фотки')
            let placeInLine = 0
            for (const url of staleLinksWithPhoto) {

                const urlObj = new URL(url);
                let originalFilename = path.basename(urlObj.pathname);
                const baseName = path.parse(originalFilename).name;
                placeInLine++
                // if (placeInLine > 2) break
                await PreparePhotoService.deleteFileByName(baseName + '_small.webp')
                await PreparePhotoService.deleteFileByName(baseName + '_big.webp')
            }
        }


// TODO нужно будет дополнительное удаление файлов по старости, и заодно создавать талицу непродоваемых авто
// TODO для этого находим все файлы по старости (2 месяца), ищем в списке существующих, и удаляем те, которых нет в списке.
// TODO И добавляем в базу непродаваемых авто в отдельную таблицу (просто для знакомства)

        await PrepareXMLService.getOldPhotoToDelete()


        console.timeEnd('⚡ Общее время обновления')

        console.log(' ')
        console.log('▼ Дополнительно проверяю и добрасываю недостающие фотки ▼')

        if (!devMode) uploadAllPhotos(db) // записывание обработанных фоток к себе только недобавленые

        sendTelegram(textForReport)
        return textForReport;
    } catch (error) {
        console.error('Error fetching XML data:', error.message);
        throw error;
    }
}
