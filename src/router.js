
import Router from 'express'
import PostController from "./PostController.js";

const router = new Router()

router.post('/posts', PostController.create)
router.get('/posts', PostController.getAll)
router.get('/posts/:id', PostController.getOne)
router.put('/posts', PostController.update)
router.delete('/posts/:id', PostController.delete)

// New routes for sections and cars
router.get('/sections', (req, res) => {
    // This would typically be handled by a controller, but for now using inline handler
    // Will be handled by express routes in index.js
    res.status(200).json({message: 'Sections route'});
});
router.get('/cars', (req, res) => {
    // This would typically be handled by a controller, but for now using inline handler
    // Will be handled by express routes in index.js
    res.status(200).json({message: 'Cars route'});
});

router.get('*', (req, res) => {
    console.log(2222)
    res.status(404).json({message: 'not found endpoint'})
})
export default router;