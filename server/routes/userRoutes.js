import { Router } from 'express';
import {
  getUsers,
  createUser,
  changeRole,
  assignManager,
  getUserById,
  deleteUser,
  sendCredentials,
} from '../controllers/userController.js';
import authMiddleware from '../middleware/auth.js';
import roleMiddleware from '../middleware/role.js';

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware('ADMIN'));

router.get('/', getUsers);
router.post('/', createUser);
router.get('/:id', getUserById);
router.patch('/:id/role', changeRole);
router.patch('/:id/manager', assignManager);
router.post('/:id/send-credentials', sendCredentials);
router.delete('/:id', deleteUser);

export default router;
