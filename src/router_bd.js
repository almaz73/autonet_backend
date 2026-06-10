import Router  from 'express'
import * as bdService from './clientBaza/listEmailsFromForms/bdService.js';

// bd routes
const router = new Router()

// Import auth middleware from authController
import { authMiddleware } from './authController.js';

// Apply auth middleware to all bd routes
router.use(authMiddleware);

// Get all bd items
router.get('/bd', async (req, res) => {
    try {
        const bdItems = await bdService.getAll_bd();
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