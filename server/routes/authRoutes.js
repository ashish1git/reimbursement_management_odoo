import { Router } from 'express';
import { register, login, logout, getMe, checkFirstUser, forgotPassword } from '../controllers/authController.js';
import authMiddleware from '../middleware/auth.js';

const router = Router();

router.get('/check-first-user', checkFirstUser);
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, getMe);

export default router;
