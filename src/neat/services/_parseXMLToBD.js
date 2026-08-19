import {devMode, FolderXML, xmlNames} from "../../constants.js";
import path from "path";
import fs from "fs";
import {parseString} from "xml2js";

export async function _parseXMLToBD(db) {
    let countCars = 0
    let ARR = xmlNames
    if (devMode) ARR = ['AlfaAvto5_Tver.xml','alfa-trade.xml']

    for (const xmlName of ARR) {
        let xmlData = '';
        const filePath = path.join(FolderXML, xmlName);
        const fileContent = fs.readFileSync(filePath, 'utf8');
        xmlData += fileContent; // Combine all XML files content

        countCars += await new Promise((resolve, reject) => {
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

    return ` В БД ${countCars} автомобиля`
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
            return carsCount;
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

async function processSectionRecursive(sections, db, parentInfo) {
    for (const section of sections) {
        const sectionData = section.data;

        // Extract id from the section data
        let id = '';
        if (sectionData.$ && sectionData.$.id) {
            id = extractValueClean(sectionData.$.id);
        } else if (sectionData.id && typeof sectionData.id === 'object' && sectionData.id._) {
            // Handle case where id is an object with a value
            id = extractValueClean(sectionData.id._);
        } else if (sectionData.id) {
            id = extractValueClean(sectionData.id);
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

async function insertCars(cars, db) {
    let insertedCount = 0;
    for (const car of cars) {
        try {
            // Convert the car object to a JSON string to store all fields
            const carData = JSON.stringify(car);

            // Check if car already exists (using a hash of the data to prevent duplicates)
            // language=SQLite
            const existingCar = await db.get(
                'SELECT id FROM cars WHERE data = ?', [carData]
            );

            if (!existingCar) {
                // language=SQLite
                await db.run(
                    'INSERT INTO cars (data) VALUES (?)',
                    [carData]
                );

                // Insert into thestructured cars_table as well
                await insertIntoCarsTable(car, db);
                insertedCount++;
                // console.log(`Inserted car: ${getCarName(car)}`);
            } else {
                console.log(`Skipped duplicate car: ${getCarName(car)}`);
            }
        } catch (error) {
            console.error('Error inserting car:', error.message, car);
        }
    }

    return insertedCount;
}

async function findAndProcessCars(data, db, path = '') {
    let count = 0;

    if (data && typeof data === 'object') {
        // Check if this object contains carsif (data.cars && data.cars.car) {
        const cars = Array.isArray(data.cars.car)
            ? data.cars.car
            : [data.cars.car];
        count += await insertCars(cars, db);
    }

    // Also check for cars arrays that mightnot be nested in a "cars" container
    for (const key in data) {
        if (key.toLowerCase() === 'car' && Array.isArray(data[key])) {
            count += await insertCars(data[key], db);
        } else if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
            //Lookfor individual car objects
            if (looksLikeCarObject(data[key])) {
                // This looks like a car object
                count += await insertCars([data[key]], db);
            }
            count += await this.findAndProcessCars(data[key], db, `${path}.${key}`);
        } else if (Array.isArray(data[key])) {
            //Process arrays that might contain cars
            for (const item of data[key]) {
                if (item && typeof item === 'object' && looksLikeCarObject(item)) {
                    count += await insertCars([item], db);
                }
            }
        }
    }
}

async function insertIntoCarsTable(car, db) {
    // Extract values from the car object, handling nested properties
    const id = extractValue(car, ['id', 'Id', '_id']);
    const name = extractValue(car, ['Наименование', 'name', 'title', 'model']);
    const section = extractValue(car, ['section', 'section_id']);
    const price = extractNumericValue(car, ['price', 'cost']);
    const prop_milleage = extractNumericValue(car, ['Пробег', 'prop_milleage', 'mileage', 'mileage_value']);
    const prop_year = extractNumericValue(car, ['ГодВыпуска', 'year', 'production_year']);
    const prop_color = extractValue(car, ['Цвет', 'color', 'colour']);
    const prop_engine_capacity = extractNumericValue(car, ['ОбъемДвигателя', 'engine_capacity']);
    const prop_engine_type = extractValue(car, ['ТипДвигателя', 'engine_type', 'fuel_type']);
    const prop_power = extractNumericValue(car, ['Мощность', 'power']);
    const prop_transmission_type = extractValue(car, ['ТипКПП', 'transmission_type', 'gearbox']);
    const prop_drive = extractValue(car, ['Привод', 'drive', 'drive_type']);
    const prop_body_type = extractValue(car, ['ТипКузова', 'body_type', 'car_body']);
    const prop_steering_wheel = extractValue(car, ['Руль', 'steering_wheel', 'wheel_position']);
    const prop_address = extractValue(car, ['Адрес', 'address', 'location']);
    const prop_options = extractValue(car, ['Опции', 'options', 'complectation']);
    const prop_city = extractValue(car, ['Город', 'city', 'location_city']);
    const prop_brand = extractValue(car, ['Марка', 'brand', 'make']);
    const prop_model = extractValue(car, ['Модель', 'model', 'car_model']);
    const prop_VIN = extractValue(car, ['VIN', 'vin']);

    let images = null;
    let imgArr = []

    if(car && car.Images && car.Images.Image) {
        car.Images.Image.forEach((img) => imgArr.push(img.$.url))
        if (imgArr) images = imgArr.join(', ')
    }

    // Insert into the structured cars_table
    // language=SQLite
    await db.run(`
        INSERT
            OR
        REPLACE
        INTO cars_table (id, name, section, price, prop_milleage, prop_year, prop_color,
                         prop_engine_capacity, prop_engine_type, prop_power, prop_transmission_type,
                         prop_drive, prop_body_type, prop_steering_wheel, prop_address, prop_options,
                         prop_city, prop_brand, prop_model, prop_VIN, images)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        id, name, section, price, prop_milleage, prop_year, prop_color,
        prop_engine_capacity, prop_engine_type, prop_power, prop_transmission_type,
        prop_drive, prop_body_type, prop_steering_wheel, prop_address, prop_options,
        prop_city, prop_brand, prop_model, prop_VIN, images
    ]);
}

function extractNumericValue(obj, possibleKeys) {
    for (const key of possibleKeys) {
        if (obj && obj.properties && obj.properties[key] !== undefined && obj.properties[key] !== null) {
            const value = parseFloat(obj.properties[key]);
            return isNaN(value) ? null : value;
        }

        if (obj && obj[key] !== undefined && obj[key] !== null) {
            const value = parseFloat(obj[key]);
            return isNaN(value) ? null : value;
        }
    }
    return null;
}

function extractValueClean(value) {
    if (value && typeof value === 'object' && value._) return value._.toString().trim();
    if (value && typeof value === 'object') return JSON.stringify(value);
    return value ? value.toString().trim() : '';
}
function extractValue(obj, possibleKeys) {
    for (const key of possibleKeys) {
        if (obj && obj.properties && obj.properties[key] !== undefined && obj.properties[key] !== null) {
            return String(obj.properties[key])
        }

        if (obj && obj[key] !== undefined && obj[key] !== null) {
            return String(obj[key]);
        }
    }
    return null;
}