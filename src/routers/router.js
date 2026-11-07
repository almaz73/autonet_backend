import Router from 'express'
import Controllers from "../xml_import/Controllers.js";
import Post from '../post/Post.js'
import {emailRateLimit, validateEmailRequest, validateEmailAttachment} from '../post/emailProtection.js'
import multer from "multer";
import {getActiveBanners, getMainBanners} from '../clientBaza/promo/generationPagesForPromo.js'
import {getDealers} from '../clientBaza/dealers/dealersDAO.js'

const router = new Router()

// Configure multer for file uploads with appropriate limits
class MulterConfig {
    static getUpload() {
        //Use memory storage for file uploads
        const storage = multer.memoryStorage();

        // Allow all file types
        const fileFilter = (req, file, cb) => {
            cb(null, true);
        };

        // Set file size limits
        const limits = {
            fileSize: 5 * 1024 * 1024, // 5MB limit
            fieldSize: 10 * 1024 * 1024, // 10MB field size
            fields: 10, // Max number of non-file fields
            parts: 100 // Max number of parts (files + fields)
        };

        // Configuremulter
        return multer({
            storage: storage,
            fileFilter: fileFilter,
            limits: limits
        });
    }
}

const upload = MulterConfig.getUpload();


router.get('/getList', Controllers.getList)
router.get('/getSpecials', Controllers.getSpecials) // Специальные предложения, по городу, их 5 последних в диапазоне цен от 400 до 800 тыс. руб. (для главной страницы)
router.get('/getLatestCarArrivials', Controllers.getLatestCarArrivials) // Свежие поступления авто с пробегом
router.get('/getAutoByParams', Controllers.getAutoByParams)
router.get('/getCarCount', Controllers.getCarCount) // вместо getBrandList можно использовать
// router.get('/getBrandList', Controllers.getBrandList)
router.get('/getModelList', Controllers.getModelList)
router.get('/getCities', Controllers.getCities)
router.get('/getGearboxTypes', Controllers.getGearboxTypes)
router.get('/getEngineTypes', Controllers.getEngineTypes)
router.get('/getDriveTypes', Controllers.getDriveTypes)
router.get('/getWheelTypes', Controllers.getWheelTypes)
router.get('/getBodyTypes', Controllers.getBodyTypes)
router.get('/getColorList', Controllers.getColorList)
router.get('/getYearGap', Controllers.getYearGap)

// Почтовые формы: лимит по IP ставим до multer, чтобы спам не занимал память загрузкой файла
router.post('/postEmail', emailRateLimit, validateEmailRequest, Post.postEmailYa)
router.post('/postEmailWithAttachement', emailRateLimit, upload.single('file'), validateEmailAttachment, Post.postEmailWithAttachementYa)
router.get('/getMainBanners', getMainBanners) // баннеры карусели на главном
router.get('/getActiveBanners', getActiveBanners) // все активные промо-баннеры
router.get('/getDealers', getDealers) // дилерские центры для карты на главной


router.get('/test', Controllers.test)
// Служебные эндпоинты /import-xml и /unnecessaryPhoto удалены: обновление сайта
// и чистка файлов выполняются только через new_build/neatCombine.js, а не по HTTP.
// router.get('/saveXmlFilesToPublic', Controllers.saveXmlFilesToPublic) // сохраняем xml к себе
// router.get('/checkDuplicateVINs', Controllers.checkDuplicateVINs) // нет ли повторяющихся VIN
// router.get('/getImageLinksCount', Controllers.getImageLinksCount) // общее количество ссылок на изображения в базе данных.
// router.get('/getOldPhotoToDelete', Controllers.getOldPhotoToDelete) // чтобы найти старые фотки
// router.get('/getListExistPhoto', Controllers.getListExistPhoto) // получить список фоток из папки с файлами

// router.get('/worker-import-xml', Controllers.workerImportXML) //в неблокирующем отдельном потоке, Обновления БАЗ
// router.get('/uploadAllPhotos', Controllers.uploadAllPhotos) // Это можно фоново запускать, чтобы все ссылки превратить в оптимизированные фотки.


/*
 // Интервал цен
    router.get('/getPriceGap', Controllers.getPriceGap)

 // Получение максимального объема двигателей из всех автомобилей
    router.get('/getMaxEngineCapacity', Controllers.getMaxEngineCapacity)

 // Почта
    router.post('/email/postEmail', Controllers.postEmail)

 // Почта с прикрепленным файлом
    router.post('/email/postEmailWithAttachement', Controllers.postEmailWithAttachement)
*/

export default router;