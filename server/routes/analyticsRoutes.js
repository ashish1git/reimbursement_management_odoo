import { Router } from 'express';
import { getSummary } from '../controllers/analyticsController.js';
import authMiddleware from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/summary', getSummary);

export default router;
