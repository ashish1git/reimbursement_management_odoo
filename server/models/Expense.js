import mongoose from 'mongoose';
import { EXPENSE_STATUS, EXPENSE_CATEGORIES, PAID_BY_OPTIONS } from '../config/constants.js';

const expenseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be positive'],
    },
    currency: {
      type: String,
      required: [true, 'Currency is required'],
      uppercase: true,
    },
    convertedAmount: {
      type: Number,
      default: 0,
    },
    exchangeRateUsed: {
      type: Number,
      default: 1,
    },
    category: {
      type: String,
      enum: EXPENSE_CATEGORIES,
      required: [true, 'Category is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    paidBy: {
      type: String,
      enum: {
        values: PAID_BY_OPTIONS,
        message: `paidBy must be one of: ${PAID_BY_OPTIONS.join(', ')}`,
      },
      default: 'Employee',
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    receiptUrl: {
      type: String,
      default: null,
    },
    ocrRawData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: Object.values(EXPENSE_STATUS),
      default: EXPENSE_STATUS.DRAFT,
    },
    approvalFlowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovalFlow',
      default: null,
    },
    currentStep: {
      type: Number,
      default: 0,
    },
    resolvedSteps: [
      {
        stepOrder: Number,
        approverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: String,
        label: String,
        isRequired: { type: Boolean, default: false },
      },
    ],
    fraudFlags: {
      type: [String],
      default: [],
    },
    submittedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Index for faster lookups
expenseSchema.index({ userId: 1, status: 1 });
expenseSchema.index({ companyId: 1, status: 1 });
expenseSchema.index({ userId: 1, date: 1, amount: 1 });

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;
