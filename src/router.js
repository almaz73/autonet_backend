
import Router from 'express'
import PostController from "./PostController.js";
import xmlImportService from './xmlImportService.js';
import sectionsProcessingService from './sectionsProcessingService.js';

const router = new Router()

router.post('/posts', PostController.create)
router.get('/posts', PostController.getAll)
router.get('/posts/:id', PostController.getOne)
router.put('/posts', PostController.update)
router.delete('/posts/:id', PostController.delete)

// Endpoint to import XML data
router.get('/import-xml', async (req, res) => {
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
});

// Endpoint to process sections data according to requirements
router.get('/process-sections', async (req, res) => {
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
});

router.get('*', (req, res) => {
    console.log(2222)
    res.status(404).json({message: 'not found endpoint'})
})
export default router;