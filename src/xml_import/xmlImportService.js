import axios from 'axios';
import {parseString} from 'xml2js';

class XmlImportService {
    constructor() {
        this.xmlUrls = [
            // 'https://export.cartat.ru/avtoset_upload/Avtoset_new/AVTO_NIGNEKAMSK.xml',
            // 'https://export.cartat.ru/avtoset_upload/Avtoset_new/AlfaAvto5_AMK.xml',
            // 'https://export.cartat.ru/avtoset_upload/Avtoset_new/AlfaAvto5_Astrahan.xml',
            // 'https://export.cartat.ru/avtoset_upload/Avtoset_new/AlfaAvto5_Tver.xml',
            // 'https://export.cartat.ru/avtoset_upload/Avtoset_new/alfa5_gktm.xml',
            'https://export.cartat.ru/avtoset_upload/Avtoset_new/alfa-trade.xml'
        ];
    }

    async importXmlData(db) {
        try {
            let totalResult = {
                sectionsImported: 0,
                carsImported: 0,
                total: 0
            };

            for (const xmlUrl of this.xmlUrls) {
                console.log('Fetching XML data from:', xmlUrl);

                // Fetch the XML data from the remoteURL
                const response = await axios.get(xmlUrl, {
                    timeout: 30000, // 30 seconds timeout
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; AutoNetBot/1.0)'
                    }
                });

                // Parse the XMLdata
                const xmlData = response.data;

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

                        console.log('XML parsed successfully, processing data...');
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

            return totalResult;
        } catch (error) {
            console.error('Error fetching XML data:', error.message);
            throw error;
        }
    }

    async processXmlData(parsedData, db) {
        // Create tables for sections and cars
        await this.createTables(db);

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

                carsCount = await this.insertCars(cars, db);
            }
        } else {
            // If catalog doesn't exist, try to find sections and cars anywhere in the structure
            sectionsCount = await this.findAndProcessSections(parsedData, db);
            carsCount = await this.findAndProcessCars(parsedData, db);
        }

        console.log(`Successfully imported ${sectionsCount} sections and ${carsCount} cars`);
        return {
            sectionsImported: sectionsCount,
            carsImported: carsCount,
            total: sectionsCount + carsCount
        };
    }

    async createTables(db) {
        // Create sections table with dynamic columns based on XML structure
        // language=SQLite
        await db.exec(`
            CREATE TABLE IF NOT EXISTS sections
            (
                id
                    INTEGER
                    PRIMARY
                        KEY
                    AUTOINCREMENT,
                data
                    TEXT
            )
        `);

        // Create cars table with dynamic columns based on XML structure
        // language=SQLite
        await db.exec(`
            CREATE TABLE IF NOT EXISTS cars
            (
                id
                    INTEGER
                    PRIMARY
                        KEY
                    AUTOINCREMENT,
                data
                    TEXT
                    NOT
                        NULL
            )
        `);

        // Create a more structured cars table
        // language=SQLite
        await db.exec(`
            CREATE TABLE IF NOT EXISTS cars_table
            (
                id                     TEXT PRIMARY KEY,
                name                   TEXT,
                section                TEXT,
                price                  REAL,
                prop_milleage          INTEGER,
                prop_year              INTEGER,
                prop_color             TEXT,
                prop_engine_capacity   REAL,
                prop_engine_type       TEXT,
                prop_power             INTEGER,
                prop_transmission_type TEXT,
                prop_drive             TEXT,
                prop_body_type         TEXT,
                prop_steering_wheel    TEXT,
                prop_address           TEXT,
                prop_options           TEXT,
                prop_guarantee         TEXT,
                prop_city              TEXT,
                prop_brand             TEXT,
                prop_model             TEXT,
                prop_VIN               TEXT,
                images                 TEXT
            )
        `);

        console.log('???? Sections, section_table, cars and cars_table tables created/verified');
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

                    // Insert into the structured section_table as well
                    await this.insertIntoSectionTable(section, db);
                    insertedCount++;
                    console.log(`Inserted section: ${this.getSectionName(section)}`);
                } else {
                    console.log(`Skipped duplicate section: ${this.getSectionName(section)}`);
                }
            } catch (error) {
                console.error('Error inserting section:', error.message, section);
            }
        }
        return insertedCount;
    }

    async insertIntoSectionTable(section, db) {

        console.log('::::section', section)

        // Extract values from the section object, handling nested properties
        const id = this.extractValue(section, ['id', '_id']) || this.generateSectionId(section);
        const name = this.extractValue(section, ['name', 'title']);
        const title = this.extractValue(section, ['title', 'name']);
        const address = this.extractValue(section, ['address', 'addr']);
        const phones = this.extractValue(section, ['phones', 'phone', 'telephone']);
        const schedule = this.extractValue(section, ['schedule', 'work_time', 'opening_hours']);
        const services = this.extractValue(section, ['services', 'service_list']);
        const coordinates = this.extractValue(section, ['coordinates', 'coords', 'location']);
        const work_time = this.extractValue(section, ['work_time', 'working_hours', 'schedule']);
        const city = this.extractValue(section, ['city', 'location_city']);
        const region = this.extractValue(section, ['region', 'location_region']);
        const district = this.extractValue(section, ['district', 'location_district']);
        const brand = this.extractValue(section, ['brand', 'brand_name']);
        const type = this.extractValue(section, ['type', 'section_type']);
        const subtype = this.extractValue(section, ['subtype', 'sub_type']);
        const logo = this.extractValue(section, ['logo', 'logo_url']);
        const image = this.extractValue(section, ['image', 'img', 'picture']);
        const rating = this.extractNumericValue(section, ['rating', 'score']);
        const reviews_count = this.extractNumericValue(section, ['reviews_count', 'review_count']);
        const data = JSON.stringify(section);

        // Insert intothe structured section_table
        // language=SQLite
        await db.run(`
            INSERT
                OR
            REPLACE
            INTO section_table (id, name, title, address, phones, schedule, services, coordinates,
                                work_time, city, region, district, brand, type, subtype, logo,
                                image, rating, reviews_count, data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, name, title, address, phones, schedule, services, coordinates,
            work_time, city, region, district, brand, type, subtype, logo,
            image, rating, reviews_count, data
        ]);
    }

    // Helper method to generate a unique ID fora section if no ID is provided
    generateSectionId(section) {
        // Generate a unique ID based on section properties
        const name = this.extractValue(section, ['name', 'title']) || '';
        const address = this.extractValue(section, ['address']) || '';
        return `${name}_${address}`.replace(/\s+/g, '_').substring(0, 100);
    }

    async insertCars(cars, db) {
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
                    await this.insertIntoCarsTable(car, db);
                    insertedCount++;
                    console.log(`Inserted car: ${this.getCarName(car)}`);
                } else {
                    console.log(`Skipped duplicate car: ${this.getCarName(car)}`);
                }
            } catch (error) {
                console.error('Error inserting car:', error.message, car);
            }
        }

        return insertedCount;
    }

    async insertIntoCarsTable(car, db) {
        // Extract values from the car object, handling nested properties
        const id = this.extractValue(car, ['id', '_id']) || this.generateCarId(car);
        const name = this.extractValue(car, ['name', 'title', 'model']);
        const section = this.extractValue(car, ['section', 'section_id']);
        const price = this.extractNumericValue(car, ['price', 'cost']);
        const prop_milleage = this.extractNumericValue(car, ['prop_milleage', 'mileage', 'mileage_value']);
        const prop_year = this.extractNumericValue(car, ['prop_year', 'year', 'production_year']);
        const prop_color = this.extractValue(car, ['prop_color', 'color', 'colour']);
        const prop_engine_capacity = this.extractNumericValue(car, ['prop_engine_capacity', 'engine_capacity', 'engine_size']);
        const prop_engine_type = this.extractValue(car, ['prop_engine_type', 'engine_type', 'fuel_type']);
        const prop_power = this.extractNumericValue(car, ['prop_power', 'power', 'horsepower']);
        const prop_transmission_type = this.extractValue(car, ['prop_transmission_type', 'transmission_type', 'gearbox']);
        const prop_drive = this.extractValue(car, ['prop_drive', 'drive', 'drive_type']);
        const prop_body_type = this.extractValue(car, ['prop_body_type', 'body_type', 'car_body']);
        const prop_steering_wheel = this.extractValue(car, ['prop_steering_wheel', 'steering_wheel', 'wheel_position']);
        const prop_address = this.extractValue(car, ['prop_address', 'address', 'location']);
        const prop_options = this.extractValue(car, ['prop_options', 'options', 'complectation']);
        const prop_guarantee = this.extractValue(car, ['prop_guarantee', 'guarantee', 'warranty']);
        const prop_city = this.extractValue(car, ['prop_city', 'city', 'location_city']);
        const prop_brand = this.extractValue(car, ['prop_brand', 'brand', 'make']);
        const prop_model = this.extractValue(car, ['prop_model', 'model', 'car_model']);
        const prop_VIN = this.extractValue(car, ['prop_VIN', 'VIN', 'vin']);

        // Handle images -convert array to JSON string if it exists
        let images = null;
        if (car.images && car.images.image) {
            const imageArray = Array.isArray(car.images.image) ? car.images.image : [car.images.image];
            images = JSON.stringify(imageArray);
        } else if (Array.isArray(car.images)) {
            images = JSON.stringify(car.images);
        } else if (typeof car.images === 'string') {
            images = JSON.stringify([car.images]);
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
                             prop_guarantee, prop_city, prop_brand, prop_model, prop_VIN, images)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, name, section, price, prop_milleage, prop_year, prop_color,
            prop_engine_capacity, prop_engine_type, prop_power, prop_transmission_type,
            prop_drive, prop_body_type, prop_steering_wheel, prop_address, prop_options,
            prop_guarantee, prop_city, prop_brand, prop_model, prop_VIN, images
        ]);
    }

    // Helper method to extract a value from an object using multiple possible keys
    extractValue(obj, possibleKeys) {
        for (const key of possibleKeys) {
            if (obj && obj[key] !== undefined && obj[key] !== null) {
                return String(obj[key]);
            }
        }
        return null;
    }

    // Helper method to extract a numeric value from an object using multiple possiblekeys
    extractNumericValue(obj, possibleKeys) {
        for (const key of possibleKeys) {
            if (obj && obj[key] !== undefined && obj[key] !== null) {
                const value = parseFloat(obj[key]);
                return isNaN(value) ? null : value;
            }
        }
        return null;
    }

    // Helper method to generatea uniqueID for acar ifno ID is provided
    generateCarId(car) {
        // Generate a unique ID based on car properties
        const name = this.extractValue(car, ['name', 'title', 'model']) || '';
        const year = this.extractNumericValue(car, ['prop_year', 'year']) || '';
        const vin = this.extractValue(car, ['prop_VIN', 'VIN']) || '';
        return `${name}_${year}_${vin}`.replace(/\s+/g, '_').substring(0, 100);
    }

//
// //Helper method to get a namefor logging purposesfrom a sectiongetSectionName(section) {
//        return section.name || section.title|| section.id || 'Unnamed Section';
//     }

    // Helper method to get a name for logging purposes froma car
    getCarName(car) {
        return car.name || car.title || car.model || car.id || 'Unnamed Car';
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

//Methodto find and process cars in case they're not under catalog
    async findAndProcessCars(data, db, path = '') {
        let count = 0;

        if (data && typeof data === 'object') {
            // Check if this object contains carsif (data.cars && data.cars.car) {
            const cars = Array.isArray(data.cars.car)
                ? data.cars.car
                : [data.cars.car];
            count += await this.insertCars(cars, db);
        }

        // Also check for cars arrays that mightnot be nested in a "cars" container
        for (const key in data) {
            if (key.toLowerCase() === 'car' && Array.isArray(data[key])) {
                count += await this.insertCars(data[key], db);
            } else if (data[key] && typeof data[key] === 'object' && !Array.isArray(data[key])) {
                //Lookfor individual car objects
                if (this.looksLikeCarObject(data[key])) {
                    // This looks like a car object
                    count += await this.insertCars([data[key]], db);
                }
                count += await this.findAndProcessCars(data[key], db, `${path}.${key}`);
            } else if (Array.isArray(data[key])) {
                //Process arrays that might contain cars
                for (const item of data[key]) {
                    if (item && typeof item === 'object' && this.looksLikeCarObject(item)) {
                        count += await this.insertCars([item], db);
                    }
                }
            }
        }
    }

    // return count;
    // }

    // Helper method to determine if an object looks like a car object
    looksLikeCarObject(obj) {
        // Check forcommon car properties
        return obj && (
            obj.name ||
            obj.model ||
            obj.prop_VIN || obj.price ||
            obj.year ||
            obj.mileage ||
            obj.color ||
            obj.engine_capacity ||
            obj.VIN
        );
    }
}

export default new XmlImportService();
