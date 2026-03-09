import xmlImportService from "./xmlImportService.js";
import ServiceSections from "./ServiceSections.js";
import A_section from "../API/A_section.js";
import A_car from "../API/A_car.js";
import GetListService from "../API/GetListService.js";

import PhotoPrepareService from './PhotoPrepareService.js';


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


    async getList(req, res) {
        try {
            const list = await GetListService.getList(req.query)
            res.json(list);
        } catch (error) {
            console.error('Error getting cars:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getSpecials(req, res) {
        try {
            const list = await A_car.getSpecials(req.query.city)
            res.json(list);
        } catch (error) {
            console.error('Error getting cars:', error);
            res.status(500).json({error: error.message});
        }
    }


    async getFullAutoInfo(req, res) {
        try {
            const list = await A_car.getFullAutoInfo(req.query.guid)
            res.json(list);
        } catch (error) {
            console.error('Error getting cars:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getCarCount(req, res) {
        try {
            const list = await A_car.getCarCount()
            res.json(list);
        } catch (error) {
            console.error('Error getting cars:', error);
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
            res.status(500).json({error: error.message});
        }
    }

    async getBrandList(req, res) {
        try {
            const list = await A_section.getBrandList()
            res.json(list);
        } catch (error) {
            console.error('Error getting cars:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getModelList(req, res) {
        try {
            const list = await A_section.getModelList(req.query.id)
            res.json(list);
        } catch (error) {
            console.error('Error getting cars:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getCities(req, res) {
        try {
            const list = await A_car.getCitiesFromACar()
            res.json(list);
        } catch (error) {
            console.error('Error getting cars:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getGearboxTypes(req, res) {
        try {
            const list = await A_car.getGearboxTypes()
            res.json(list);
        } catch (error) {
            console.error('Error getting cars:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getEngineTypes(req, res) {
        try {
            const list = await A_car.getEngineTypes()
            res.json(list);
        } catch (error) {
            console.error('Error getting cars:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getDriveTypes(req, res) {
        try {
            const list = await A_car.getDriveTypes()
            res.json(list);
        } catch (error) {
            console.error('Error getting cars:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getWheelTypes(req, res) {
        try {
            const list = await A_car.getWheelTypes()
            res.json(list);
        } catch (error) {
            console.error('Error getting cars:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getBodyTypes(req, res) {
        try {
            const list = await A_car.getBodyTypes()
            res.json(list);
        } catch (error) {
            console.error('Error getting cars:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getColorList(req, res) {
        try {
            const list = await A_car.getColorList()
            res.json(list);
        } catch (error) {
            console.error('Error getting cars:', error);
            res.status(500).json({error: error.message});
        }
    }

    async preparePhoto(req, res) {
        console.log('Начинаем процесс подготовки фоток...')
        try {
            await PhotoPrepareService.getImagesFromACar()
            res.json('Фотки скопипрованы с оптимизацией');
        } catch (error) {
            console.error('Error getting cars:', error);
            res.status(500).json({error: error.message});
        }
    }


}

export default new Controllers();
