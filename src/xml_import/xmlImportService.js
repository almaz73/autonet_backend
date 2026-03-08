import axios from 'axios';
import {parseString} from 'xml2js';
import {insertCars, findAndProcessCars} from './ServiceCars.js'

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
            //Clear all tables before importing new data
            await this.clearTables(db);

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


    // ... existing code ...
    async clearTables(db) {
        try {
            // Clear all the tables with conditional checks
            await this.deleteFromTableIfExists(db, 'cars');
            await this.deleteFromTableIfExists(db, 'cars_table');
            await this.deleteFromTableIfExists(db, 'sections');
            await this.deleteFromTableIfExists(db, 'section_table');

            console.log('All tables cleared successfully');
        } catch (error) {
            console.error('Error clearing tables:', error.message);
            throw error;
        }
    }

    async deleteFromTableIfExists(db, tableName) {
        try {
            // Check if the table exists
            const result = await db.get(`SELECT name
                                         FROM sqlite_master
                                         WHERE type = 'table'
                                           AND name = '${tableName}'`);

            if (result) {
                // Table exists, proceed with deletion
                await db.exec(`DELETE
                               FROM ${tableName};`);
            } else {
                // Table doesn't exist, log and continue
                console.log(`Table ${tableName} does not exist, skipping...`);
            }
        } catch (error) {
            console.warn(`Warning: Could not clear table ${tableName}:`, error.message);
        }
    }

// ... existing code ...


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

                carsCount = await insertCars(cars, db);
            }
        } else {
            // If catalog doesn't exist, try to find sections and cars anywhere in the structure
            sectionsCount = await this.findAndProcessSections(parsedData, db);
            carsCount = await findAndProcessCars(parsedData, db);
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

export default new XmlImportService();
