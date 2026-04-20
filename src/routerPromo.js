import Router  from 'express'
import * as promoService from './clientBaza/promoService.js';

// Promo routes
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

// Apply auth middleware to all promo routes
router.use(authMiddleware);


// Get all promo items
router.get('/promo', async (req, res) => {
    try {
        const promoItems = await promoService.getAllPromo();
        res.json(promoItems);
    } catch (error) {
        console.error('Error getting promo items:', error);
        res.status(500).json({ error: 'Failed to get promo items' });
    }
});

// Get active promo items
router.get('' +
    '', async (req, res) => {
    try {
        const promoItems = await promoService.getActivePromo();
        res.json(promoItems);
    } catch (error) {
        console.error('Error getting active promo items:', error);
        res.status(500).json({ error: 'Failed to get active promo items' });
    }
});

// Get promo item by ID
router.get('/promo/:id', async (req, res) => {
    try {
        const promoItem = await promoService.getPromoById(req.params.id);
        if (!promoItem) {
            return res.status(404).json({ error: 'Promo item not found' });
        }
        res.json(promoItem);
    } catch (error) {
        console.error('Error getting promo item:', error);
        res.status(500).json({ error: 'Failed to get promo item' });
    }
});

// Create new promo item
router.post('/promo', async (req, res) => {
    try {
        const { name, onMain, priority, active, photoBig, photoMiddle, photoSmall, photoSM_ver, photoSM_hor } = req.body;

        const promo = {
            name,
            onMain: onMain === 'true' ? true : (onMain === 'false' ? false : onMain),
            priority: parseInt(priority) || 0,
            active: active === 'true' ? true : (active === 'false' ? false : active),
            photoBig,
            photoMiddle,
            photoSmall,
            photoSM_ver,
            photoSM_hor
        };

        const newPromoId = await promoService.createPromo(promo);
        res.status(201).json({ id: newPromoId });
    } catch (error) {
        console.error('Error creating promo item:', error);
        res.status(500).json({ error: 'Failed to create promo item' });
    }
});

// Update promo item
router.put('/promo/:id', async (req, res) => {
    try {
        const { name, onMain, priority, active, photoBig, photoMiddle, photoSmall, photoSM_ver, photoSM_hor } = req.body;

        const promo = {
            name,
            onMain: onMain === 'true' ? true : (onMain === 'false' ? false : onMain),
            priority: parseInt(priority) || 0,
            active: active === 'true' ? true : (active === 'false' ? false : active),
            photoBig,
            photoMiddle,
            photoSmall,
            photoSM_ver,
            photoSM_hor
        };

        console.log('promo = ',promo)

        const changes = await promoService.updatePromo(req.params.id, promo);
        if (changes === 0) {
            return res.status(404).json({ error: 'Promo item not found' });
        }
        res.json({ message: 'Promo item updated successfully' });
    } catch (error) {
        console.error('Error updating promo item:', error);
        res.status(500).json({ error: 'Failed to update promo item' });
    }
});

// Delete promo item
router.delete('/promo/:id', async (req, res) => {
    try {
        const changes = await promoService.deletePromo(req.params.id);
        if (changes === 0) {
            return res.status(404).json({ error: 'Promo item not found' });
        }
        res.json({ message: 'Promo item deleted successfully' });
    } catch (error) {
        console.error('Error deleting promo item:', error);
        res.status(500).json({ error: 'Failed to delete promo item' });
    }
});

// router.post('/promo/upload', upload.single('photoData'), async (req, res) => { ... })


// Upload promo photo
// Upload promo photo
router.post('/promo/upload', upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileName = req.body.fileName;
        const photoData = req.file.buffer; // Get the binary data from the upload
        const photoUrl = await promoService.savePromoPhoto(fileName, photoData);
        res.json({ photoUrl });
    } catch (error) {
        console.error('Error uploading promo photo:', error);
        res.status(500).json({ error: 'Failed to upload promo photo' });
    }
});

router.get('*', (req, res) => {
    console.log('404 404 404 404 404')
    res.status(404).json({message: ' !!! НЕ НАЙДЕН ENDPOINT'})
})

export default router;