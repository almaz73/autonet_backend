import Router from 'express'
import PostController from "./posts/PostController.js";
import Controllers from "./xml_import/Controllers.js";

const router = new Router()

router.post('/posts', PostController.create)
router.get('/posts', PostController.getAll)
router.get('/posts/:id', PostController.getOne)
router.put('/posts', PostController.update)
router.delete('/posts/:id', PostController.delete)

router.get('/import-xml', Controllers.importXML)
// router.get('/process-sections', Controllers.processSections)
// router.get('/sections', Controllers.sections)
// router.get('/cars', Controllers.cars)


router.get('/getList', Controllers.getList)
router.get('/getBrandList', Controllers.getBrandLidt)
router.get('/getCities', Controllers.getCities)
router.get('/getGearboxTypes', Controllers.getGearboxTypes)
router.get('/getEngineTypes', Controllers.getEngineTypes)
router.get('/getDriveTypes', Controllers.getDriveTypes)
router.get('/getWheelTypes', Controllers.getWheelTypes)
router.get('/getBodyTypes', Controllers.getBodyTypes)
router.get('/getColorList', Controllers.getColorList)


router.get('*', (req, res) => {
    console.log('404 404 404 404 404')
    res.status(404).json({message: ' !!! НЕ НАЙДЕН ENDPOINT'})
})
export default router;