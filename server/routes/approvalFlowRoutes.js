import { Router } from 'express';
import { getApprovalFlow, upsertApprovalFlow } from '../controllers/approvalFlowController.js';
import authMiddleware from '../middleware/auth.js';
import roleMiddleware from '../middleware/role.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getApprovalFlow);
router.post('/', roleMiddleware('ADMIN'), upsertApprovalFlow);

export default router;
