import mongoose from 'mongoose';
import { RULE_TYPES, APPROVER_ROLES } from '../config/constants.js';

const approvalFlowSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      unique: true, // One flow per company
    },
    name: {
      type: String,
      default: 'Default Approval Flow',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    isManagerApproverFirst: {
      type: Boolean,
      default: false,
    },
    isSequential: {
      type: Boolean,
      default: true, // true = sequential (one by one), false = parallel (all at once)
    },
    steps: [
      {
        stepOrder: { type: Number, required: true },
        approverRole: {
          type: String,
          enum: [...APPROVER_ROLES, null],
          default: null,
        },
        approverId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },
        label: { type: String, default: '' },
        isRequired: { type: Boolean, default: false }, // If true, this approver's decision is binding
      },
    ],
    rule: {
      type: {
        type: String,
        enum: Object.values(RULE_TYPES),
        default: RULE_TYPES.NONE,
      },
      percentageThreshold: { type: Number, default: 60 },
      specificApproverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
    },
  },
  { timestamps: true }
);

const ApprovalFlow = mongoose.model('ApprovalFlow', approvalFlowSchema);

export default ApprovalFlow;
