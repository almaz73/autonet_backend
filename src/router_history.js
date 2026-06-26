import Router from 'express'
import * as historyService from './clientBaza/history/historyService.js';

// history routes
const router = new Router()

// Import auth middleware from authController
import {authMiddleware} from './authController.js';

// Apply auth middleware to all history routes
router.use(authMiddleware);

// Get all history items with optionalpagination and city filter
router.get('/history', async (req, res) => {
    try {
        // Get query parameters
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
// Get data with filters
        const paginationData = await historyService.getAll_history(page, pageSize);

        // Send response with pagination metadata
        res.json({
            items: paginationData.items,
            total: paginationData.total,
            page: paginationData.page,
            pageSize: paginationData.pageSize,
            totalPages: paginationData.totalPages
        });
    } catch (error) {
        console.error('Error getting history items:', error);
        res.status(500).json({error: 'Failed to get history items'});
    }
});

// Get all history items with optionalpagination and city filter
router.get('/history_period', async (req, res) => {
    try {
        // Get query parameters
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
// Get data with filters
        const paginationData = await historyService.get_history_period(page, pageSize);

        // Send response with pagination metadata
        res.json({
            items: paginationData.items,
            total: paginationData.total,
            page: paginationData.page,
            pageSize: paginationData.pageSize,
            totalPages: paginationData.totalPages
        });
    } catch (error) {
        console.error('Error getting history items:', error);
        res.status(500).json({error: 'Failed to get history items'});
    }
});

router.get('*', (req, res) => {
    console.log('ART 404 404 404 404 404')
    res.status(404).json({message: ' !!! НЕ НАЙДЕН ENDPOINT'})
})

export default router;