import { Router } from 'express';
import { parseReceipt, upload, getRatePreview } from '../controllers/ocrController.js';
import authMiddleware from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.post('/parse-receipt', upload.single('receipt'), parseReceipt);
router.get('/rate-preview', getRatePreview);

export default router;
