import Router from 'express'
import PostController from "./posts/PostController.js";
import SectionController from "./xml_import/SectionController.js";

const router = new Router()

router.post('/posts', PostController.create)
router.get('/posts', PostController.getAll)
router.get('/posts/:id', PostController.getOne)
router.put('/posts', PostController.update)
router.delete('/posts/:id', PostController.delete)

router.get('/import-xml', SectionController.importXML)
router.get('/process-sections', SectionController.processSections)
router.get('/sections', SectionController.sections)
router.get('/cars', SectionController.cars)

router.get('*', (req, res) => {
    console.log('404 404 404 404 404')
    res.status(404).json({message: ' !!! НЕ НАЙДЕН ENDPOINT'})
})
export default router;