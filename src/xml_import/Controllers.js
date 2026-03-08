import xmlImportService from "./xmlImportService.js";
import ServiceSections from "./ServiceSections.js";
import A_section from "../API/A_section.js";
import A_car from "../API/A_car.js";


class Controllers {
    async importXML(req, res) {
        try {
            console.log('Starting XML import process...');
            const result = await xmlImportService.importXmlData(global.db);
            res.json({
                success: true,
                message: 'XML data imported successfully',
                imported: result
            });
        } catch (error) {
            console.error('Error during XML import:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }


    async processSections(req, res) {
        try {
            const result = await ServiceSections.processSections(global.db);
            res.json(result);
        } catch (error) {
            console.error('Error processing sections:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async sections(req, res) {
        try {
            // language=SQLite
            const sections = await global.db.all('SELECT * FROM sections');
            // Parse the JSON data for each section
            const sectionsWithParsedData = sections.map(section => ({
                ...section,
                data: JSON.parse(section.data)
            }));
            res.json(sectionsWithParsedData);
        } catch (error) {
            console.error('Error getting sections:', error);
            res.status(500).json({error: error.message});
        }
    }

    async cars(req, res) {
        try {
            // language=SQLite
            const cars = await global.db.all('SELECT * FROM cars');
            // Parse the JSON data for each car
            const carsWithParsedData = cars.map(car => ({
                ...car,
                data: JSON.parse(car.data)
            }));
            res.json(carsWithParsedData);
        } catch (error) {
            console.error('Error getting cars:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getBrandLidt(req, res) {
        try {
            // language=SQLite
            const list = await A_section.getBrandList()
            res.json(list);
        } catch (error) {
            console.error('Error getting cars:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getCities(req, res) {
        try {
            // language=SQLite
            const list = await A_car.getCitiesFromACar()
            res.json(list);
        } catch (error) {
            console.error('Error getting cars:', error);
            res.status(500).json({ error: error.message });
        }
    }


}

export default new Controllers();
