import ImportService from "./ImportService.js";
import A_section from "../API/A_section.js";
import A_car from "../API/A_car.js";
import GetListService from "../API/GetListService.js";

import PhotoPrepareService from './PreparePhotoService.js';
import PrepareXMLService from "./PrepareXMLService.js";


class Controllers {

    async test(req, res) {
        try {
            console.log('   ⚡ test ⚡ test ⚡ Есть связь с сервером!!!'  )
            res.json(' ⚡ Есть связь с сервером!!! ⚡ ⚡ ⚡ ');
        } catch (error) {
            console.error('Ошибка сервера:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    async importXML(req, res) {
        try {
            const result = await ImportService.importXmlData(global.db);
            res.json(' БАЗА ОБНОВЛЕНА '+result);
        } catch (error) {
            console.error('Ошибка импорта XML:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }


    // async processSections(req, res) {
    //     try {
    //         const result = await PreliminaryTables.processSections(global.db);
    //         res.json(result);
    //     } catch (error) {
    //         console.error('Error processing sections:', error);
    //         res.status(500).json({
    //             success: false,
    //             error: error.message
    //         });
    //     }
    // }

    // async sections(req, res) {
    //     try {
    //         // language=SQLite
    //         const sections = await global.db.all('SELECT * FROM sections');
    //         // Parse the JSON data for each section
    //         const sectionsWithParsedData = sections.map(section => ({
    //             ...section,
    //             data: JSON.parse(section.data)
    //         }));
    //         res.json(sectionsWithParsedData);
    //     } catch (error) {
    //         console.error('Error getting sections:', error);
    //         res.status(500).json({error: error.message});
    //     }
    // }

    // async cars(req, res) {
    //     try {
    //         // language=SQLite
    //         const cars = await global.db.all('SELECT * FROM cars');
    //         // Parse the JSON data for each car
    //         const carsWithParsedData = cars.map(car => ({
    //             ...car,
    //             data: JSON.parse(car.data)
    //         }));
    //         res.json(carsWithParsedData);
    //     } catch (error) {
    //         console.error('Error getting cars:', error);
    //         res.status(500).json({error: error.message});
    //     }
    // }


    async getList(req, res) {
        try {
            const list = await GetListService.getList(req.query)
            res.json(list);
        } catch (error) {
            console.error('Error getList:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getSpecials(req, res) {
        try {
            const list = await A_car.getSpecials(req.query.city)
            res.json(list);
        } catch (error) {
            console.error('Error getSpecials:', error);
            res.status(500).json({error: error.message});
        }
    }


    async getFullAutoInfo(req, res) {
        try {
            const list = await A_car.getFullAutoInfo(req.query.guid)
            res.json(list);
        } catch (error) {
            console.error('Error getFullAutoInfo:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getCarCount(req, res) {
        try {
            const list = await A_car.getCarCount()
            res.json(list);
        } catch (error) {
            console.error('Error getCarCount:', error);
            res.status(500).json({error: error.message});
        }
    }


    async getBrandList(req, res) {
        try {
            const list = await A_section.getBrandList()
            res.json(list);
        } catch (error) {
            console.error('Error getBrandList:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getModelList(req, res) {
        try {
            const list = await A_section.getModelList(req.query.id)
            res.json(list);
        } catch (error) {
            console.error('Error getModelList:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getCities(req, res) {
        try {
            const list = await A_car.getCitiesFromACar()
            res.json(list);
        } catch (error) {
            console.error('Error getCities:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getGearboxTypes(req, res) {
        try {
            const list = await A_car.getGearboxTypes()
            res.json(list);
        } catch (error) {
            console.error('Error getGearboxTypes:', error);
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
            console.error('Error getDriveTypes:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getWheelTypes(req, res) {
        try {
            const list = await A_car.getWheelTypes()
            res.json(list);
        } catch (error) {
            console.error('Error ggetWheelTypes:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getBodyTypes(req, res) {
        try {
            const list = await A_car.getBodyTypes()
            res.json(list);
        } catch (error) {
            console.error('Error getBodyTypes:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getColorList(req, res) {
        try {
            const list = await A_car.getColorList()
            res.json(list);
        } catch (error) {
            console.error('Error getColorList:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getYearGap(req, res) {
        try {
            const list = await A_car.getYearGap()
            res.json(list);
        } catch (error) {
            console.error('Error getYearGap:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getImageLinksCount(req, res) {
        console.log('⚡ Сосчитаем общее количество фоток')
        try {
            const list = await A_car.getImageLinksCount()
            res.json(list);
        } catch (error) {
            console.error('Error getImageLinksCount:', error);
            res.status(500).json({error: error.message});
        }
    }

    async uploadAllPhotos(req, res) {
        console.log('🐾🐾🐾 Дозаполнение фоток... ☄☄☄ Этот метод переносит все существующие ссылки в фотки ☄☄☄')
        try {
            await PhotoPrepareService.uploadAllPhotos()
            res.json('Фотки скопипрованы с оптимизацией');
        } catch (error) {
            console.error('Error uploadAllPhotos:', error);
            res.status(500).json({error: error.message});
        }
    }

    async checkDuplicateVINs(req, res) {
        console.log('⚡ Есть ли дубликаты VIN ?...')
        try {
            let list= await A_car.checkDuplicateVINs()
            console.log('⚡ '+list)
            res.json(list);
        } catch (error) {
            console.error('Error checkDuplicateVINs:', error);
            res.status(500).json({error: error.message});
        }
    }

    async saveXmlFilesToPublic(req, res) {
        console.log('⚡ Сохраним XML к себе ...')
        try {
            let list= await PrepareXMLService.saveXmlFilesToPublic()
            res.json(list);
        } catch (error) {
            console.error('Error saveXmlFilesToPublic:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getOldPhotoToDelete(req, res) {
        try {
            let list= await PrepareXMLService.getOldPhotoToDelete()
            res.json(list);
        } catch (error) {
            console.error('Error getOldPhotoToDelete:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getListExistPhoto(req, res) {
        try {
            let list= await PrepareXMLService.getListExistPhoto()
            res.json(list);
        } catch (error) {
            console.error('Error getListExistPhoto:', error);
            res.status(500).json({error: error.message});
        }
    }





}

export default new Controllers();
