import Router  from 'express'
import * as articleService from './clientBaza/article/articleService.js';

// Article routes
const router = new Router()

// Import auth middleware from authController
import { authMiddleware } from './authController.js';

// Import multer for handling multipart/form-data
import multer from 'multer';

// Configure multer for file uploads
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file size limit
    fileFilter: (req, file, cb) => {
        // Accept images only
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// Apply auth middleware to all article routes
router.use(authMiddleware);


// Get all article items
router.get('/article', async (req, res) => {
    try {
        const articleItems = await articleService.getAllArticle();
        res.json(articleItems);
    } catch (error) {
        console.error('Error getting article items:', error);
        res.status(500).json({ error: 'Failed to get article items' });
    }
});


// Create new article item
router.post('/article', async (req, res) => {
    try {
        const { name, onMain, priority, active, code, photo278, photo585, photo1200 } = req.body;

        const article = {
            name,
            onMain: onMain === 'true' ? true : (onMain === 'false' ? false : onMain),
            priority: parseInt(priority) || 0,
            active: active === 'true' ? true : (active === 'false' ? false : active),
            code,
            photo278,
            photo585,
            photo1200
        };

        const newArticleId = await articleService.createArticle(article);
        res.status(201).json({ id: newArticleId });
    } catch (error) {
        console.error('Error creating article item:', error);
        res.status(500).json({ error: 'Failed to create article item' });
    }
});

// Update article item
router.put('/article/:id', async (req, res) => {
    try {
        const { name, onMain, priority, active, code, photo278, photo585, photo1200} = req.body;

        const article = {
            name,
            onMain: onMain === 'true' ? true : (onMain === 'false' ? false : onMain),
            priority: parseInt(priority) || 0,
            active: active === 'true' ? true : (active === 'false' ? false : active),
            code,
            photo278,
            photo585,
            photo1200
        };

        const changes = await articleService.updateArticle(req.params.id, article);
        if (changes === 0) {
            return res.status(404).json({ error: 'Article item not found' });
        }
        res.json({ message: 'Article item updated successfully' });
    } catch (error) {
        console.error('Error updating article item:', error);
        res.status(500).json({ error: 'Failed to update article item' });
    }
});

// Delete article item
router.delete('/article/:id', async (req, res) => {
    try {
        const changes = await articleService.deleteArticle(req.params.id);
        if (changes === 0) {
            return res.status(404).json({ error: 'Article item not found' });
        }
        res.json({ message: 'Article item deleted successfully' });
    } catch (error) {
        console.error('Error deleting article item:', error);
        res.status(500).json({ error: 'Failed to delete article item' });
    }
});

// Upload article photo
router.post('/article/upload', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileName = req.body.fileName;
        const photoData = req.file.buffer; // Get the binary data from the upload
        const photoUrl = await articleService.saveArticlePhoto(fileName, photoData);
        res.json({ photoUrl });
    } catch (error) {
        console.error('Error uploading article photo:', error);
        res.status(500).json({ error: 'Failed to upload article photo' });
    }
});

router.get('*', (req, res) => {
    console.log('ART 404 404 404 404 404')
    res.status(404).json({message: ' !!! НЕ НАЙДЕН ENDPOINT'})
})

export default router;