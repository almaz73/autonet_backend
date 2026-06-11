import Router  from 'express'
import * as bdService from './clientBaza/listEmailsFromForms/bdService.js';

// bd routes
const router = new Router()

// Import auth middleware from authController
import { authMiddleware } from './authController.js';

// Apply auth middleware to all bd routes
router.use(authMiddleware);

// Get all bd items withoptional pagination and city filter
router.get('/bd', async (req, res) => {
    try {
        // Get query parameters
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const city = req.query.city || null;
// Get data with filters
        const bdItems = await bdService.getAll_bd(page, pageSize, city);
        res.json(bdItems);
    } catch (error) {
        console.error('Error getting bd items:', error);
        res.status(500).json({ error: 'Failed to get bd items' });
    }
});

router.get('*', (req, res) => {
    console.log('ART 404 404 404 404 404')
    res.status(404).json({message: ' !!! НЕ НАЙДЕН ENDPOINT'})
})

export default router;