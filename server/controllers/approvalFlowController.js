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

  // Validate steps and rule data
  if (!steps || !Array.isArray(steps)) {
    throw new ApiError(400, 'Steps must be a non-empty array');
  }

  if (!rule || typeof rule !== 'object') {
    throw new ApiError(400, 'Rule must be a valid object');
  }

  const update = {
    name: name || 'Default Approval Flow',
    description: description || '',
    isManagerApproverFirst: isManagerApproverFirst !== undefined ? isManagerApproverFirst : true,
    isSequential: isSequential !== undefined ? isSequential : true,
    steps: steps.map((s, i) => {
      // Validate ObjectId format if approverId is provided
      if (s.approverId && !s.approverId.match(/^[0-9a-fA-F]{24}$/)) {
        throw new ApiError(400, `Invalid approverId format in step ${i + 1}`);
      }
      return {
        stepOrder: i,
        approverRole: s.approverRole || null,
        approverId: s.approverId || null,
        label: s.label || `Step ${i + 1}`,
        isRequired: s.isRequired || false,
      };
    }),
    rule: {
      type: rule?.type || 'NONE',
      percentageThreshold: Number(rule?.percentageThreshold) || 60,
      specificApproverId: rule?.specificApproverId || null,
    },
  };

  // Validate percentage if rule type is PERCENTAGE
  if (update.rule.type === 'PERCENTAGE' && (update.rule.percentageThreshold < 0 || update.rule.percentageThreshold > 100)) {
    throw new ApiError(400, 'Percentage threshold must be between 0 and 100');
  }

  try {
    const flow = await ApprovalFlow.findOneAndUpdate(
      { companyId: req.user.companyId },
      update,
      { upsert: true, new: true, runValidators: true }
    )
      .populate('steps.approverId', 'name email role')
      .populate('rule.specificApproverId', 'name email role');

    res.json(new ApiResponse(200, flow, 'Approval flow saved successfully'));
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      throw new ApiError(400, `Validation failed: ${messages.join(', ')}`);
    }
    throw err;
  }
});
