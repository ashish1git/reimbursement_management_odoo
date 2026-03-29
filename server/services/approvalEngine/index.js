import Expense from '../../models/Expense.js';
import ApprovalFlow from '../../models/ApprovalFlow.js';
import ApprovalLog from '../../models/ApprovalLog.js';
import User from '../../models/User.js';
import ApiError from '../../utils/ApiError.js';
import {
  EXPENSE_STATUS,
  APPROVAL_ACTIONS,
  RULE_TYPES,
  ROLES,
} from '../../config/constants.js';

/**
 * Resolves who should approve at each step for a given expense.
 * Injects manager as step 0 if isManagerApproverFirst === true.
 * Also carries isRequired flag from the flow step definition.
 */
async function buildResolvedSteps(flow, expense) {
  const resolvedSteps = [];

  // Inject manager as the first approver if configured
  if (flow.isManagerApproverFirst) {
    const submitter = await User.findById(expense.userId);
    if (submitter?.managerId) {
      const manager = await User.findById(submitter.managerId);
      if (manager) {
        resolvedSteps.push({
          stepOrder: 0,
          approverId: manager._id,
          role: ROLES.MANAGER,
          label: `Manager (${manager.name})`,
          isRequired: true, // manager step is always required
        });
      }
    }
  }

  // Build remaining steps from the flow definition
  for (const step of flow.steps.sort((a, b) => a.stepOrder - b.stepOrder)) {
    const offset = resolvedSteps.length;
    resolvedSteps.push({
      stepOrder: offset,
      approverId: step.approverId || null,
      role: step.approverRole || null,
      label: step.label || step.approverRole || 'Approver',
      isRequired: step.isRequired || false,
    });
  }

  return resolvedSteps;
}

/**
 * Initiates the approval flow for a newly submitted expense.
 * Handles SEQUENTIAL vs PARALLEL modes.
 */
async function initiateApprovalFlow(expense) {
  const flow = await ApprovalFlow.findOne({ companyId: expense.companyId });

  if (!flow) {
    // No flow configured → auto-approve
    expense.status = EXPENSE_STATUS.APPROVED;
    expense.currentStep = 0;
    expense.resolvedSteps = [];
    await expense.save();
    return expense;
  }

  const resolvedSteps = await buildResolvedSteps(flow, expense);

  if (resolvedSteps.length === 0) {
    // Flow exists but has no steps → auto-approve
    expense.status = EXPENSE_STATUS.APPROVED;
    expense.currentStep = 0;
    expense.resolvedSteps = [];
    await expense.save();
    return expense;
  }

  expense.approvalFlowId = flow._id;
  expense.currentStep = 0;

  // Only set to PENDING if not already FLAGGED
  if (expense.status !== EXPENSE_STATUS.FLAGGED) {
    expense.status = EXPENSE_STATUS.PENDING;
  }
  expense.resolvedSteps = resolvedSteps;
  await expense.save();

  // In PARALLEL mode: create pending log placeholders for all steps so
  // all approvers can see the expense in their queue simultaneously
  if (!flow.isSequential) {
    // We don't create logs here; the queue filter for parallel is handled
    // in getExpensesPendingForApprover by checking ALL steps, not just currentStep
    expense._isParallel = true;
  }

  return expense;
}

/**
 * Checks conditional auto-approval rules after each approval action.
 * Returns true if a rule triggers full auto-approval.
 */
async function evaluateConditionalRule(flow, expense, logs) {
  const rule = flow.rule;
  if (!rule || rule.type === RULE_TYPES.NONE) return false;

  const approvedLogs = logs.filter((l) => l.action === APPROVAL_ACTIONS.APPROVED);
  const totalSteps = expense.resolvedSteps.length;

  let percentageMet = false;
  let specificMet = false;

  if (rule.type === RULE_TYPES.PERCENTAGE || rule.type === RULE_TYPES.HYBRID) {
    const ratio = totalSteps > 0 ? (approvedLogs.length / totalSteps) * 100 : 0;
    percentageMet = ratio >= rule.percentageThreshold;
  }

  if (rule.type === RULE_TYPES.SPECIFIC || rule.type === RULE_TYPES.HYBRID) {
    specificMet = approvedLogs.some(
      (l) => l.approverId.toString() === rule.specificApproverId?.toString()
    );
  }

  return percentageMet || specificMet;
}

/**
 * Core approval processing.
 * Handles sequential and parallel flows, isRequired binding, and conditional rules.
 */
async function processApproval(expenseId, approverId, action, comment = '') {
  const expense = await Expense.findById(expenseId).populate('approvalFlowId');

  if (!expense) throw new ApiError(404, 'Expense not found');
  if (![EXPENSE_STATUS.PENDING, EXPENSE_STATUS.FLAGGED].includes(expense.status)) {
    throw new ApiError(400, `Expense is already ${expense.status} — cannot approve/reject`);
  }

  const approver = await User.findById(approverId);
  if (!approver) throw new ApiError(404, 'Approver not found');

  const flow = expense.approvalFlowId;
  const isParallel = flow && !flow.isSequential;

  // ── PARALLEL MODE ─────────────────────────────────────────────────────────
  if (isParallel) {
    // In parallel mode: any assigned approver can act on any step
    const applicableStep = expense.resolvedSteps.find((step) => {
      const isDirectApprover = step.approverId?.toString() === approverId.toString();
      const isRoleApprover = !step.approverId && step.role === approver.role;
      // ADMIN can act on any step
      const isAdminBypass = approver.role === ROLES.ADMIN;
      return isDirectApprover || isRoleApprover || isAdminBypass;
    });

    if (!applicableStep) {
      throw new ApiError(403, 'You are not an assigned approver for this expense');
    }

    // Check if this approver already acted
    const existingLog = await ApprovalLog.findOne({
      expenseId,
      approverId,
    });
    if (existingLog) {
      throw new ApiError(400, 'You have already acted on this expense');
    }

    // Create log
    const log = await ApprovalLog.create({
      expenseId,
      approverId,
      stepOrder: applicableStep.stepOrder,
      action,
      comment,
      actedAt: new Date(),
    });

    // REJECTION handling in PARALLEL mode
    if (action === APPROVAL_ACTIONS.REJECTED) {
      if (applicableStep.isRequired) {
        // Required approver rejects → immediate rejection
        expense.status = EXPENSE_STATUS.REJECTED;
        await expense.save();
        return { expense, log };
      } else {
        // Non-required approver rejects → flag as "Needs Review" (FLAGGED)
        // so admin is alerted and can override or acknowledge.
        // We do NOT silently ignore it — that would confuse the rejecting approver.
        expense.status = EXPENSE_STATUS.FLAGGED;
        await expense.save();
        return { expense, log };
      }
    }

    // Check all logs to see if we should auto-approve
    const allLogs = await ApprovalLog.find({ expenseId });

    // Check conditional rule
    if (flow) {
      const autoApprove = await evaluateConditionalRule(flow, expense, allLogs);
      if (autoApprove) {
        expense.status = EXPENSE_STATUS.APPROVED;
        await expense.save();
        return { expense, log };
      }
    }

    // Check if ALL steps have been approved
    const approvedStepOrders = allLogs
      .filter((l) => l.action === APPROVAL_ACTIONS.APPROVED)
      .map((l) => l.stepOrder);
    const allStepsApproved = expense.resolvedSteps.every((s) =>
      approvedStepOrders.includes(s.stepOrder)
    );

    if (allStepsApproved) {
      expense.status = EXPENSE_STATUS.APPROVED;
    }

    await expense.save();
    return { expense, log };
  }

  // ── SEQUENTIAL MODE ────────────────────────────────────────────────────────
  // NOTE: In sequential mode, ADMIN bypass is intentionally DISABLED.
  // Admins must use the /override endpoint to force-approve/reject.
  // This ensures the sequential chain is always respected.
  const currentStepDef = expense.resolvedSteps[expense.currentStep];
  if (!currentStepDef) {
    throw new ApiError(400, 'Invalid approval step — flow may be complete');
  }

  // Validate that this approver is allowed at the current step
  const approverIdStr = approverId.toString();
  const isCorrectApprover = currentStepDef.approverId?.toString() === approverIdStr;
  const isCorrectRole = !currentStepDef.approverId && currentStepDef.role === approver?.role;

  // SEQUENTIAL: No admin bypass — admins must use the override endpoint
  if (!isCorrectApprover && !isCorrectRole) {
    throw new ApiError(
      403,
      `You are not the designated approver for step ${expense.currentStep + 1}. ` +
      `Waiting for: ${currentStepDef.label || currentStepDef.role || 'assigned approver'}. ` +
      `Admins: use the Override action to bypass the sequential flow.`
    );
  }

  // Create approval log entry
  const log = await ApprovalLog.create({
    expenseId,
    approverId,
    stepOrder: expense.currentStep,
    action,
    comment,
    actedAt: new Date(),
  });

  // REJECTION handling
  if (action === APPROVAL_ACTIONS.REJECTED) {
    expense.status = EXPENSE_STATUS.REJECTED;
    await expense.save();
    return { expense, log };
  }

  // APPROVED: fetch all logs and check conditional rules
  const allLogs = await ApprovalLog.find({ expenseId });

  if (flow) {
    const autoApprove = await evaluateConditionalRule(flow, expense, allLogs);
    if (autoApprove) {
      expense.status = EXPENSE_STATUS.APPROVED;
      await expense.save();
      return { expense, log };
    }
  }

  // Advance to next step
  const nextStep = expense.currentStep + 1;
  if (nextStep >= expense.resolvedSteps.length) {
    // All steps completed → fully approved
    expense.status = EXPENSE_STATUS.APPROVED;
  } else {
    expense.currentStep = nextStep;
  }

  await expense.save();
  return { expense, log };
}

/**
 * Returns expenses pending for a specific approver.
 * SEQUENTIAL: only expenses where resolvedSteps[currentStep] matches this approver.
 * PARALLEL: expenses where ANY step matches this approver and they haven't acted yet.
 */
async function getExpensesPendingForApprover(approverId) {
  const approver = await User.findById(approverId);
  if (!approver) throw new ApiError(404, 'Approver not found');

  const expenses = await Expense.find({
    companyId: approver.companyId,
    status: { $in: [EXPENSE_STATUS.PENDING, EXPENSE_STATUS.FLAGGED] },
  })
    .populate('userId', 'name email managerId')
    .populate('companyId', 'defaultCurrency name')
    .populate('approvalFlowId')
    .sort({ submittedAt: -1 });

  const results = [];

  for (const exp of expenses) {
    const isParallel = exp.approvalFlowId && !exp.approvalFlowId.isSequential;

    if (isParallel) {
      // Parallel: check if this approver has a matching step AND hasn't acted yet
      const hasMatchingStep = exp.resolvedSteps.some((step) => {
        const isDirectApprover = step.approverId?.toString() === approverId.toString();
        const isRoleApprover = !step.approverId && step.role === approver.role;
        return isDirectApprover || isRoleApprover;
      });

      if (hasMatchingStep || approver.role === ROLES.ADMIN) {
        // Check if already acted
        const acted = await ApprovalLog.findOne({ expenseId: exp._id, approverId });
        if (!acted) results.push(exp);
      }
    } else {
      // Sequential: only current step matters
      const step = exp.resolvedSteps?.[exp.currentStep];
      if (!step) continue;

      const isDirectApprover = step.approverId?.toString() === approverId.toString();
      const isRoleApprover = !step.approverId && step.role === approver.role;
      const isAdminOverride = approver.role === ROLES.ADMIN;

      if (isDirectApprover || isRoleApprover || isAdminOverride) {
        results.push(exp);
      }
    }
  }

  // Enrich with approval logs for the timeline display
  const enriched = await Promise.all(
    results.map(async (exp) => {
      const logs = await ApprovalLog.find({ expenseId: exp._id })
        .populate('approverId', 'name email role')
        .sort({ stepOrder: 1, actedAt: 1 });
      return { ...exp.toObject(), approvalLogs: logs };
    })
  );

  return enriched;
}

/**
 * Admin override — force approve or reject any expense, bypassing the normal flow.
 */
async function adminOverride(expenseId, adminId, action, comment = '') {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw new ApiError(404, 'Expense not found');

  expense.status =
    action === 'APPROVE' ? EXPENSE_STATUS.APPROVED : EXPENSE_STATUS.REJECTED;
  await expense.save();

  await ApprovalLog.create({
    expenseId,
    approverId: adminId,
    stepOrder: expense.currentStep,
    action: APPROVAL_ACTIONS.ADMIN_OVERRIDE,
    comment: comment || `Admin override: ${action}`,
    actedAt: new Date(),
  });

  return expense;
}

export default {
  initiateApprovalFlow,
  processApproval,
  getExpensesPendingForApprover,
  adminOverride,
};
