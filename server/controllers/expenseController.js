import Expense from '../models/Expense.js';
import ApprovalLog from '../models/ApprovalLog.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import currencyService from '../services/currencyService/index.js';
import ocrService from '../services/ocrService/index.js';
import fraudDetection from '../services/fraudDetection/index.js';
import approvalEngine from '../services/approvalEngine/index.js';
import emailService from '../services/emailService/index.js';
import { EXPENSE_STATUS, ROLES } from '../config/constants.js';

// POST /api/expenses — Save as DRAFT or submit directly
export const submitExpense = asyncHandler(async (req, res) => {
  const { amount, currency, category, description, date, paidBy, remarks, saveAsDraft } = req.body;

  if (!amount || !currency || !category || !description || !date) {
    throw new ApiError(400, 'Amount, currency, category, description, and date are required');
  }

  const companyCurrency = req.user.companyId.defaultCurrency;

  // Currency conversion
  const { convertedAmount, rate } = await currencyService.convertToCompanyCurrency(
    parseFloat(amount),
    currency.toUpperCase(),
    companyCurrency
  );

  // Create the expense (always create first)
  const expense = await Expense.create({
    userId: req.user._id,
    companyId: req.user.companyId._id,
    amount: parseFloat(amount),
    currency: currency.toUpperCase(),
    convertedAmount,
    exchangeRateUsed: rate,
    category,
    description,
    date: new Date(date),
    paidBy: paidBy || 'Employee',
    remarks: remarks || '',
    receiptUrl: req.body.receiptUrl || null,
    ocrRawData: req.body.ocrRawData || {},
    fraudFlags: [],
    status: saveAsDraft ? EXPENSE_STATUS.DRAFT : EXPENSE_STATUS.PENDING,
    submittedAt: saveAsDraft ? null : new Date(),
  });

  // If not saving as draft, run fraud checks and initiate approval
  if (!saveAsDraft) {
    await processSubmission(expense, req.user);
  }

  const populated = await Expense.findById(expense._id)
    .populate('userId', 'name email')
    .populate('approvalFlowId');

  const message = saveAsDraft ? 'Expense saved as draft' : 'Expense submitted successfully';
  res.status(201).json(new ApiResponse(201, populated, message));
});

// PATCH /api/expenses/:id/submit — Submit a DRAFT expense
export const submitDraft = asyncHandler(async (req, res) => {
  const expense = await Expense.findOne({
    _id: req.params.id,
    userId: req.user._id,
    status: EXPENSE_STATUS.DRAFT,
  });

  if (!expense) throw new ApiError(404, 'Draft expense not found');

  // Update any changed fields from the body
  const { amount, currency, category, description, date, paidBy, remarks } = req.body;
  if (amount) expense.amount = parseFloat(amount);
  if (currency) expense.currency = currency.toUpperCase();
  if (category) expense.category = category;
  if (description) expense.description = description;
  if (date) expense.date = new Date(date);
  if (paidBy) expense.paidBy = paidBy;
  if (remarks !== undefined) expense.remarks = remarks;

  // Re-run currency conversion
  const companyCurrency = req.user.companyId.defaultCurrency;
  const { convertedAmount, rate } = await currencyService.convertToCompanyCurrency(
    expense.amount,
    expense.currency,
    companyCurrency
  );
  expense.convertedAmount = convertedAmount;
  expense.exchangeRateUsed = rate;
  expense.status = EXPENSE_STATUS.PENDING;
  expense.submittedAt = new Date();
  await expense.save();

  await processSubmission(expense, req.user);

  const populated = await Expense.findById(expense._id)
    .populate('userId', 'name email')
    .populate('approvalFlowId');

  res.json(new ApiResponse(200, populated, 'Expense submitted for approval'));
});

// Helper: Run fraud detection + initiate approval flow
async function processSubmission(expense, user) {
  // Fraud detection
  const fraudFlags = await fraudDetection.checkFraud({
    userId: user._id,
    amount: expense.amount,
    convertedAmount: expense.convertedAmount,
    date: expense.date,
    currency: expense.currency,
    expenseId: expense._id, // Pass expense ID to exclude from duplicate check
  });

  expense.fraudFlags = fraudFlags;

  // Initiate approval flow
  await approvalEngine.initiateApprovalFlow(expense);

  // If fraud flags exist, mark as FLAGGED (unless already approved by flow)
  if (fraudFlags.length > 0 && expense.status !== EXPENSE_STATUS.APPROVED) {
    expense.status = EXPENSE_STATUS.FLAGGED;
    await expense.save();
  }
}

// PATCH /api/expenses/:id — Update a DRAFT expense (not yet submitted)
export const updateDraft = asyncHandler(async (req, res) => {
  const expense = await Expense.findOne({
    _id: req.params.id,
    userId: req.user._id,
    status: EXPENSE_STATUS.DRAFT,
  });

  if (!expense) throw new ApiError(404, 'Draft expense not found or already submitted');

  const { amount, currency, category, description, date, paidBy, remarks } = req.body;
  if (amount) expense.amount = parseFloat(amount);
  if (currency) expense.currency = currency.toUpperCase();
  if (category) expense.category = category;
  if (description) expense.description = description;
  if (date) expense.date = new Date(date);
  if (paidBy) expense.paidBy = paidBy;
  if (remarks !== undefined) expense.remarks = remarks;

  // Recalculate conversion
  const companyCurrency = req.user.companyId.defaultCurrency;
  const { convertedAmount, rate } = await currencyService.convertToCompanyCurrency(
    expense.amount,
    expense.currency,
    companyCurrency
  );
  expense.convertedAmount = convertedAmount;
  expense.exchangeRateUsed = rate;

  await expense.save();

  res.json(new ApiResponse(200, expense, 'Draft updated'));
});

// GET /api/expenses/my — Employee's own expenses
export const getMyExpenses = asyncHandler(async (req, res) => {
  const expenses = await Expense.find({ userId: req.user._id })
    .sort({ submittedAt: -1, createdAt: -1 })
    .populate('approvalFlowId');

  // Attach approval logs for each expense
  const enriched = await Promise.all(
    expenses.map(async (exp) => {
      const logs = await ApprovalLog.find({ expenseId: exp._id })
        .populate('approverId', 'name email role')
        .sort({ stepOrder: 1 });
      return { ...exp.toObject(), approvalLogs: logs };
    })
  );

  res.json(new ApiResponse(200, enriched, 'Your expenses fetched'));
});

// GET /api/expenses/pending — Approver's pending queue
export const getPendingExpenses = asyncHandler(async (req, res) => {
  const pending = await approvalEngine.getExpensesPendingForApprover(req.user._id);
  res.json(new ApiResponse(200, pending, 'Pending expenses fetched'));
});

// GET /api/expenses/all — Admin views all company expenses
export const getAllExpenses = asyncHandler(async (req, res) => {
  const { status, category, userId: filterUserId } = req.query;
  const filter = { companyId: req.user.companyId._id };

  if (status) filter.status = status;
  if (category) filter.category = category;
  if (filterUserId) filter.userId = filterUserId;

  // Don't show DRAFT expenses of other users
  if (!status || status !== EXPENSE_STATUS.DRAFT) {
    filter.status = filter.status || { $ne: EXPENSE_STATUS.DRAFT };
  }

  const expenses = await Expense.find(filter)
    .populate('userId', 'name email role')
    .populate('approvalFlowId')
    .sort({ submittedAt: -1, createdAt: -1 });

  res.json(new ApiResponse(200, expenses, 'All expenses fetched'));
});

// GET /api/expenses/:id — Single expense detail
export const getExpenseById = asyncHandler(async (req, res) => {
  const expense = await Expense.findOne({
    _id: req.params.id,
    ...(req.user.role === ROLES.EMPLOYEE ? { userId: req.user._id } : { companyId: req.user.companyId._id }),
  })
    .populate('userId', 'name email role')
    .populate('approvalFlowId');

  if (!expense) throw new ApiError(404, 'Expense not found');

  const logs = await ApprovalLog.find({ expenseId: expense._id })
    .populate('approverId', 'name email role')
    .sort({ stepOrder: 1 });

  res.json(new ApiResponse(200, { ...expense.toObject(), approvalLogs: logs }, 'Expense fetched'));
});

// PATCH /api/expenses/:id/approve — Approver approves
export const approveExpense = asyncHandler(async (req, res) => {
  const { comment } = req.body;
  const { expense, log } = await approvalEngine.processApproval(
    req.params.id,
    req.user._id,
    'APPROVED',
    comment || ''
  );

  // Send email notification if fully approved
  if (expense.status === EXPENSE_STATUS.APPROVED) {
    const employee = await User.findById(expense.userId);
    if (employee) {
      emailService.sendExpenseStatusUpdate({
        name: employee.name,
        email: employee.email,
        expenseDescription: expense.description,
        status: 'APPROVED',
        approverName: req.user.name || 'Approver',
        comment: comment || '',
      }).catch(() => {}); // fire and forget
    }
  }

  res.json(new ApiResponse(200, { expense, log }, 'Expense approved'));
});

// PATCH /api/expenses/:id/reject — Approver rejects
export const rejectExpense = asyncHandler(async (req, res) => {
  const { comment } = req.body;
  if (!comment) throw new ApiError(400, 'A rejection reason (comment) is required');

  const { expense, log } = await approvalEngine.processApproval(
    req.params.id,
    req.user._id,
    'REJECTED',
    comment
  );

  // Send email notification
  const employee = await User.findById(expense.userId);
  if (employee) {
    emailService.sendExpenseStatusUpdate({
      name: employee.name,
      email: employee.email,
      expenseDescription: expense.description,
      status: 'REJECTED',
      approverName: req.user.name || 'Approver',
      comment,
    }).catch(() => {}); // fire and forget
  }

  res.json(new ApiResponse(200, { expense, log }, 'Expense rejected'));
});

// POST /api/expenses/:id/override — Admin override
export const overrideExpense = asyncHandler(async (req, res) => {
  const { action, comment } = req.body;
  if (!['APPROVE', 'REJECT'].includes(action)) {
    throw new ApiError(400, 'Action must be APPROVE or REJECT');
  }

  const expense = await approvalEngine.adminOverride(
    req.params.id,
    req.user._id,
    action,
    comment || ''
  );
  res.json(new ApiResponse(200, expense, `Expense ${action}D by admin override`));
});

// GET /api/expenses/approval-history — All expenses this approver has previously actioned
export const getApprovalHistory = asyncHandler(async (req, res) => {
  // Find all approval logs where this user was the approver
  const myLogs = await ApprovalLog.find({ approverId: req.user._id })
    .sort({ actedAt: -1 });

  if (!myLogs.length) {
    return res.json(new ApiResponse(200, [], 'No approval history yet'));
  }

  const expenseIds = [...new Set(myLogs.map((l) => l.expenseId.toString()))];

  const expenses = await Expense.find({
    _id: { $in: expenseIds },
    companyId: req.user.companyId._id,
  })
    .populate('userId', 'name email role')
    .populate('companyId', 'defaultCurrency name')
    .populate('approvalFlowId')
    .sort({ updatedAt: -1 });

  // Enrich each with approval logs
  const enriched = await Promise.all(
    expenses.map(async (exp) => {
      const logs = await ApprovalLog.find({ expenseId: exp._id })
        .populate('approverId', 'name email role')
        .sort({ stepOrder: 1, actedAt: 1 });
      return { ...exp.toObject(), approvalLogs: logs };
    })
  );

  res.json(new ApiResponse(200, enriched, 'Approval history fetched'));
});

// GET /api/expenses/export — CSV export
export const exportExpenses = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const filter = { companyId: req.user.companyId._id, status: { $ne: EXPENSE_STATUS.DRAFT } };
  if (status) filter.status = status;

  const expenses = await Expense.find(filter)
    .populate('userId', 'name email')
    .sort({ date: -1 });

  const rows = [
    ['Date', 'Submitter', 'Description', 'Category', 'Paid By', 'Amount', 'Currency', 'Converted Amount', 'Status', 'Remarks', 'Fraud Flags'],
    ...expenses.map((e) => [
      new Date(e.date).toISOString().split('T')[0],
      e.userId?.name || '',
      e.description,
      e.category,
      e.paidBy || 'Employee',
      e.amount,
      e.currency,
      e.convertedAmount,
      e.status,
      e.remarks || '',
      e.fraudFlags.join(','),
    ]),
  ];

  const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="expenses.csv"');
  res.send(csv);
});
