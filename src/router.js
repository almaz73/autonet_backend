import Router from 'express'
import Controllers from "./xml_import/Controllers.js";

const router = new Router()

router.get('/test', Controllers.test)
router.get('/import-xml', Controllers.importXML)
// router.get('/process-sections', Controllers.processSections)
// router.get('/sections', Controllers.sections)
// router.get('/cars', Controllers.cars)


router.get('/getList', Controllers.getList)
router.get('/getSpecials', Controllers.getSpecials) // Специальные предложения, по городу, их 5 последних в диапазоне цен от 400 до 800 тыс. руб. (для главной страницы)
router.get('/getFullAutoInfo', Controllers.getFullAutoInfo)
router.get('/getCarCount', Controllers.getCarCount)
router.get('/getBrandList', Controllers.getBrandList)
router.get('/getModelList', Controllers.getModelList)
router.get('/getCities', Controllers.getCities)
router.get('/getGearboxTypes', Controllers.getGearboxTypes)
router.get('/getEngineTypes', Controllers.getEngineTypes)
router.get('/getDriveTypes', Controllers.getDriveTypes)
router.get('/getWheelTypes', Controllers.getWheelTypes)
router.get('/getBodyTypes', Controllers.getBodyTypes)
router.get('/getColorList', Controllers.getColorList)
router.get('/upload', Controllers.uploadAllPhotos) // Это можно фоново запускать, чтобы все ссылки превратить в оптимизированные фотки.
router.get('/getYearGap', Controllers.getYearGap)

router.get('/saveXmlFilesToPublic', Controllers.saveXmlFilesToPublic) // сохраняем xml к себе
router.get('/checkDuplicateVINs', Controllers.checkDuplicateVINs) // нет ли повторяющихся VIN
router.get('/getImageLinksCount', Controllers.getImageLinksCount) // общее количество ссылок на изображения в базе данных.
router.get('/getOldPhotoToDelete', Controllers.getOldPhotoToDelete) // чтобы найти старые фотки
router.get('/getListExistPhoto', Controllers.getListExistPhoto) // чтобы найти старые фотки


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

router.get('*', (req, res) => {
    console.log('404 404 404 404 404')
    res.status(404).json({message: ' !!! НЕ НАЙДЕН ENDPOINT'})
})
export default router;