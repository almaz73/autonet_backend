// routerAuth.js
import Router from 'express';
import { login, verifyToken, authMiddleware } from './authController.js';

// Create auth router
const router = new Router();

// Auth routes
router.post('/login', login);
router.get('/verify', authMiddleware, verifyToken);

// Export router
export default router;