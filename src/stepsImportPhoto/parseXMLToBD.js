import {parseString} from "xml2js";
import {devMode, FolderXML, xmlNames} from "../constants.js";
import path from "path";
import fs from "fs";
import {findAndProcessCars, insertCars} from "../xml_import/ServiceCars.js";

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
            await processSections(db)

            if (!sectionsCount || !carsCount) return `☹ Пустая Таблица sectionsCount: ${sectionsCount} carsCount: ${carsCount}`;
            return `⚡ Удачно. Заполнены таблицы sectionsCount: ${sectionsCount} carsCount: ${carsCount}`;
        }
    } else {
        // If catalog doesn't exist, try to find sections and cars anywhere in the structure
        sectionsCount = await findAndProcessSections(parsedData, db);
        carsCount = await findAndProcessCars(parsedData, db);
    }


    // console.log(`⚡     добавлено СЕКЦИЙ: ${sectionsCount}, АВТОМОБИЛЕЙ: ${carsCount}`);
    return {
        sectionsImported: sectionsCount,
        carsImported: carsCount,
        total: sectionsCount + carsCount
    };
}

export async function parseXMLToBD(db) {
    let ARR = xmlNames
    if (devMode) ARR = ['alfa-trade.xml']
    for (const xmlName of ARR) {

        // console.log('      Заполняем базу из', xmlName)
        let xmlData = '';
        const filePath = path.join(FolderXML, xmlName);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        xmlData += fileContent; // Combine all XML files content

        return await new Promise((resolve, reject) => {
            parseString(xmlData, {
                explicitArray: false,
                ignoreAttrs: false
            }, (err, result) => {
                if (err) {
                    console.error('Error parsing XML:', err);
                    reject(err);
                    return 'Error parsing XML:' + err;
                }

                return processXmlData(result, db)
                    .then(resolve)
                    .catch(reject);
            });
        });

    }
}