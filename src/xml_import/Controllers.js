import ImportService from "./ImportService.js";
import A_section from "../API/A_section.js";
import A_car from "../API/A_car.js";
import GetListService from "../API/GetListService.js";
import PhotoPrepareService from './PreparePhotoService.js';
import PrepareXMLService from "./PrepareXMLService.js";
import PreparePhotoService from "./PreparePhotoService.js";
import {Worker} from 'worker_threads';
import {Version} from "../constants.js";

class Controllers {
    async test(req, res) {
        try {
            console.log(`   ⚡ test ⚡ test ⚡ Есть связь с сервером !!! ${Version}`)
            res.json(` ⚡ ⚡ ⚡ Есть связь с сервером!!! ⚡ ⚡ ⚡ ${Version}`);
        } catch (error) {
            console.error('Ошибка сервера:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async workerImportXML(req, res) {
        try {
            // Store the response data to build a report
            let responseData = null;
            let hasCompleted = false;

            const worker = new Worker('./src/worker/ImportXMLWorker.js');

            worker.on('message', (message) => {
                // console.log('!!!! Worker message:', message);
                responseData = message;

                // Only send response if worker has completed successfully
                if (message.status === 'COMPLETE' && !hasCompleted) {
                    hasCompleted = true;
                    try {
                        res.json({
                            success: true,
                            message: 'Параллельный поток ОБНОВЛЕНИЯ БАЗ ИЗ ХМЛ завершился',
                            data: message.message
                        });
                    } catch (e) {
                        return message.message
                    }
                }
            });

            worker.on('error', (error) => {
                console.error('Worker error:', error);
                if (!hasCompleted) {
                    hasCompleted = true;
                    res.status(500).json({
                        success: false,
                        error: error.message,
                        message: 'Worker error occurred'
                    });
                }
            });

            worker.on('exit', (code) => {
                if (code !== 0 && !hasCompleted) {
                    hasCompleted = true;
                    res.status(500).json({
                        success: false,
                        error: `Worker stopped with exit code ${code}`,
                        message: `Worker stopped with exit code ${code}`
                    });
                } else if (code === 0 && !hasCompleted && responseData) {
                    // In case COMPLETE message wasn't received but worker exited normally
                    hasCompleted = true;
                    res.json({
                        success: true,
                        message: 'Параллельный поток ОБНОВЛЕНИЯ БАЗ ИЗ ХМЛ завершился',
                        data: responseData.message
                    });
                }
            });

        } catch (error) {
            console.error('Ошибка запуска воркера:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async importXML(req, res) {
        console.log('  import XML ⚡ start ⚡ start ⚡ start ⚡ start ⚡ start ⚡')
        try {
            const result = await ImportService.importXmlData(global.db);
            res.json(' БАЗА ОБНОВЛЕНА ' + result);
        } catch (error) {
            console.error('Ошибка импорта XML:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }


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
            const list = await GetListService.getSpecials(req.query.city)
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
            const list = await A_section.getModelList(req.query.brandId)
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

    async postEmail(req, res) {
        try {
            const receivedData = req.body; // Данные находятся в req.body

            let result = await transporter.sendMail({
                from: 'autoset_info@cartat.ru',
                to: 'a.fayzrakhmanov@cartat.ru, ',
                subject: receivedDataTypes[receivedData.type],
                html:
                    'This <i>message</i> was sent from <strong>Node.js</strong> server.',
            });

            // Отправка ответа клиенту
            res.status(200).json({
                message: 'Данные успешно получены',
                data: result
            });
        } catch (error) {
            console.error('Error postEmail:', error);
            res.status(500).json({error: error.message});
        }

    }

    async postEmailWithAttachement(req, res) {
        try {
            // Check if file was uploaded
            if (!req.file) {
                return res.status(400).json({
                    error: 'No file uploaded'
                });
            }

            // Log file information
            console.log('File info:', {
                originalName: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            });

            const receivedData = req.body;
            console.log('Received data:', receivedData);

            // Prepare email with attachment
            let mailOptions = {
                from: 'autoset_info@cartat.ru',
                to: 'info@cartat.ru',
                subject: receivedData.subject || 'Email with attachment',
                text: receivedData.text || 'Email with attachment',
                html: receivedData.html || '<p>Email with attachment</p>',
                attachments: [
                    {
                        filename: req.file.originalname,
                        content: req.file.buffer,
                        contentType: req.file.mimetype
                    }
                ]
            };

            // Send email with attachment
            let result = await transporter.sendMail(mailOptions);

            // Send response to client
            res.status(200).json({
                message: 'Email with attachment sent successfully',
                data: {
                    fileInfo: {
                        originalName: req.file.originalname,
                        size: req.file.size,
                        mimetype: req.file.mimetype
                    },
                    emailResult: result
                }
            });
        } catch (error) {
            console.error('Error postEmailWithAttachement:', error);

            // Handle specific multer errors
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    error: 'File too large. Maximum size is 10MB.'
                });
            }

            if (error.code === 'LIMIT_UNEXPECTED_FILE') {
                return res.status(400).json({
                    error: 'Unexpected file field. Expected field name is "file".'
                });
            }

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
            let list = await A_car.checkDuplicateVINs()
            console.log('⚡ ' + list)
            res.json(list);
        } catch (error) {
            console.error('Error checkDuplicateVINs:', error);
            res.status(500).json({error: error.message});
        }
    }

    async saveXmlFilesToPublic(req, res) {
        console.log('⚡ Сохраним XML к себе ...')
        try {
            let list = await PrepareXMLService.saveXmlFilesToPublic()
            res.json(list);
        } catch (error) {
            console.error('Error saveXmlFilesToPublic:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getOldPhotoToDelete(req, res) {
        try {
            let list = await PrepareXMLService.getOldPhotoToDelete()
            res.json(list);
        } catch (error) {
            console.error('Error getOldPhotoToDelete:', error);
            res.status(500).json({error: error.message});
        }
    }

    async getListExistPhoto(req, res) {
        try {
            let list = await PrepareXMLService.getListExistPhoto()
            res.json(list);
        } catch (error) {
            console.error('Error getListExistPhoto:', error);
            res.status(500).json({error: error.message});
        }
    }

    async unnecessaryPhoto(req, res) {
        try {
            let list = await PreparePhotoService.unnecessaryPhoto()
            res.json(list);
        } catch (error) {
            console.error('Error getListExistPhoto:', error);
            res.status(500).json({error: error.message});
        }
    }


}
export default new Controllers();