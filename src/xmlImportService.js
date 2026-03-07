import axios from 'axios';
import { parseString } from 'xml2js';

class XmlImportService {
    constructor() {
        this.xmlUrl = 'https://export.cartat.ru/avtoset_upload/Avtoset_new/alfa5_gktm.xml';
    }

    async importXmlData(db) {
        try {
            console.log('Fetching XML data from:', this.xmlUrl);
            
            // Fetch the XML data from the remote URL
            const response = await axios.get(this.xmlUrl, {
                timeout: 30000, // 30 seconds timeout
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; AutoNetBot/1.0)'
                }
            });

            // Parse the XML data
            const xmlData = response.data;
            
            return new Promise((resolve, reject) => {
                parseString(xmlData, { 
                    explicitArray: false,
                    ignoreAttrs: false 
                }, (err, result) => {
                    if (err) {
                        console.error('Error parsing XML:', err);
                        reject(err);
                        return;
                    }
                    
                    console.log('XML parsed successfully, processing data...');
                    this.processXmlData(result, db)
                        .then(resolve)
                        .catch(reject);
                });
            });
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
        await db.exec(`
            CREATE TABLE IF NOT EXISTS sections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT NOT NULL
            )
        `);

        // Create cars table with dynamic columns based on XML structure
        await db.exec(`
            CREATE TABLE IF NOT EXISTS cars (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                data TEXT NOT NULL
            )
        `);

        console.log('Sections and cars tables created/verified');
    }

    async insertSections(sections, db) {
        let insertedCount = 0;
        
        for (const section of sections) {
            try {
                // Convert the section object to a JSON string to store all fields
                const sectionData = JSON.stringify(section);
                
                // Check if section already exists (using a hash of the data to prevent duplicates)
                const existingSection = await db.get(
                    'SELECT id FROM sections WHERE data = ?', 
                    [sectionData]
                );
                
                if (!existingSection) {
                    await db.run(
                        'INSERT INTO sections (data) VALUES (?)',
                        [sectionData]
                    );
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

    async insertCars(cars, db) {
        let insertedCount = 0;
        
        for (const car of cars) {
            try {
                // Convert the car object to a JSON string to store all fields
                const carData = JSON.stringify(car);
                
                // Check if car already exists (using a hash of the data to prevent duplicates)
                const existingCar = await db.get(
                    'SELECT id FROM cars WHERE data = ?', 
                    [carData]
                );
                
                if (!existingCar) {
                    await db.run(
                        'INSERT INTO cars (data) VALUES (?)',
                        [carData]
                    );
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

    // Helper method to get a name for logging purposes from a section
    getSectionName(section) {
        return section.name || section.title || section.id || 'Unnamed Section';
    }

    // Helper method to get a name for logging purposes from a car
    getCarName(car) {
        return car.name || car.title || car.model || car.id || 'Unnamed Car';
    }

    // Method to find and process sections in case they're not under catalog
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
            
            // Recursively search in nested objects
            for (const key in data) {
                if (data[key] && typeof data[key] === 'object') {
                    count += await this.findAndProcessSections(data[key], db, `${path}.${key}`);
                }
            }
        }
        
        return count;
    }

    // Method to find and process cars in case they're not under catalog
    async findAndProcessCars(data, db, path = '') {
        let count = 0;
        
        if (data && typeof data === 'object') {
            // Check if this object contains cars
            if (data.cars && data.cars.car) {
                const cars = Array.isArray(data.cars.car) 
                    ? data.cars.car 
                    : [data.cars.car];
                count += await this.insertCars(cars, db);
            }
            
            // Recursively search in nested objects
            for (const key in data) {
                if (data[key] && typeof data[key] === 'object') {
                    count += await this.findAndProcessCars(data[key], db, `${path}.${key}`);
                }
            }
        }
        
        return count;
    }
}

export default new XmlImportService();
