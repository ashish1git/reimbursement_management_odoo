import { Router } from 'express';
import {
  submitExpense,
  submitDraft,
  updateDraft,
  getMyExpenses,
  getPendingExpenses,
  getApprovalHistory,
  getAllExpenses,
  getTeamExpenses,
  getExpenseById,
  approveExpense,
  rejectExpense,
  overrideExpense,
  resubmitExpense,
  exportExpenses,
} from '../controllers/expenseController.js';
import authMiddleware from '../middleware/auth.js';
import roleMiddleware from '../middleware/role.js';

const router = Router();

router.use(authMiddleware);

// Employee expense submission (EMPLOYEE only per SPEC)
router.post('/', roleMiddleware('EMPLOYEE'), submitExpense);
router.patch('/:id/submit', roleMiddleware('EMPLOYEE'), submitDraft);
router.patch('/:id/draft', roleMiddleware('EMPLOYEE'), updateDraft);
router.get('/my', getMyExpenses);
// FLAW #4: Allow employees to resubmit rejected expenses
router.post('/:id/resubmit', roleMiddleware('EMPLOYEE'), resubmitExpense);

// Approver queues — all roles that can appear in approval steps + ADMIN
router.get('/pending', roleMiddleware('MANAGER', 'FINANCE', 'DIRECTOR', 'ADMIN'), getPendingExpenses);
router.get('/approval-history', roleMiddleware('MANAGER', 'FINANCE', 'DIRECTOR', 'ADMIN'), getApprovalHistory);

// FLAW #1: Manager sees ONLY their team (direct reports) expenses
router.get('/team', roleMiddleware('MANAGER'), getTeamExpenses);

// Admin only routes
router.get('/all', roleMiddleware('ADMIN'), getAllExpenses);
router.get('/export', roleMiddleware('ADMIN', 'MANAGER', 'FINANCE', 'DIRECTOR'), exportExpenses);

// Individual expense
router.get('/:id', getExpenseById);
router.patch('/:id/approve', roleMiddleware('MANAGER', 'FINANCE', 'DIRECTOR', 'ADMIN'), approveExpense);
router.patch('/:id/reject', roleMiddleware('MANAGER', 'FINANCE', 'DIRECTOR', 'ADMIN'), rejectExpense);
router.post('/:id/override', roleMiddleware('ADMIN'), overrideExpense);

export default router;
