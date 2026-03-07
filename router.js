import Router from 'express'
import PostController from "./src/PostController.js";

const router = new Router()

router.post('/posts', PostController.create)
router.get('/posts', PostController.getAll)
router.get('/posts/:id', PostController.getOne)
router.put('/posts', PostController.update)
router.delete('/posts/:id', PostController.delete)

router.get('*', (req, res) => {
    console.log(2222)
    res.status(404).json({message: 'not found endpoint'})
})
export default router;
