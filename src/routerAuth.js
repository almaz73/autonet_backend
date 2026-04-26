// routerAuth.js
import Router from 'express';
import { login, authMiddleware } from './authController.js';

// Create auth router
const router = new Router();

// Auth routes
router.post('/login', login);
router.get('/verify', authMiddleware);

// Export router
export default router;