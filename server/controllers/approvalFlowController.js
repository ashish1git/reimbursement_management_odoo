import ApprovalFlow from '../models/ApprovalFlow.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

// GET /api/approval-flow — Get company's flow
export const getApprovalFlow = asyncHandler(async (req, res) => {
  const flow = await ApprovalFlow.findOne({ companyId: req.user.companyId })
    .populate('steps.approverId', 'name email role')
    .populate('rule.specificApproverId', 'name email role');

  // Return null gracefully if no flow configured yet
  if (!flow) {
    return res.json(new ApiResponse(200, null, 'No approval flow configured'));
  }

  res.json(new ApiResponse(200, flow, 'Approval flow fetched'));
});

// POST /api/approval-flow — Create or update company's flow
export const upsertApprovalFlow = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    isManagerApproverFirst,
    isSequential,
    steps,
    rule,
  } = req.body;

  const update = {
    name: name || 'Default Approval Flow',
    description: description || '',
    isManagerApproverFirst: isManagerApproverFirst !== undefined ? isManagerApproverFirst : true,
    isSequential: isSequential !== undefined ? isSequential : true,
    steps: (steps || []).map((s, i) => ({
      stepOrder: i,
      approverRole: s.approverRole || null,
      approverId: s.approverId || null,
      label: s.label || `Step ${i + 1}`,
      isRequired: s.isRequired || false,
    })),
    rule: {
      type: rule?.type || 'NONE',
      percentageThreshold: Number(rule?.percentageThreshold) || 60,
      specificApproverId: rule?.specificApproverId || null,
    },
  };

  const flow = await ApprovalFlow.findOneAndUpdate(
    { companyId: req.user.companyId },
    update,
    { upsert: true, new: true }
  )
    .populate('steps.approverId', 'name email role')
    .populate('rule.specificApproverId', 'name email role');

  res.json(new ApiResponse(200, flow, 'Approval flow saved'));
});
