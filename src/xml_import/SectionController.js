import xmlImportService from "./xmlImportService.js";
import sectionsProcessingService from "./sectionsProcessingService.js";


class SectionController {
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
            const result = await sectionsProcessingService.processSections(global.db);
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


}

export default new SectionController();
