import mongoose from 'mongoose';
import { APPROVAL_ACTIONS } from '../config/constants.js';

const approvalLogSchema = new mongoose.Schema(
  {
    expenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
      required: true,
    },
    approverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    stepOrder: {
      type: Number,
      required: true,
    },
    action: {
      type: String,
      enum: [...Object.values(APPROVAL_ACTIONS)],
      required: true,
    },
    comment: {
      type: String,
      default: '',
      trim: true,
    },
    actedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

approvalLogSchema.index({ expenseId: 1 });

const ApprovalLog = mongoose.model('ApprovalLog', approvalLogSchema);

export default ApprovalLog;
