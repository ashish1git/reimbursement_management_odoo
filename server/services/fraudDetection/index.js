import Expense from '../../models/Expense.js';
import { HIGH_AMOUNT_THRESHOLD } from '../../config/constants.js';

/**
 * Fraud Detection Service
 * Runs automatically on every expense submission
 */

/**
 * Checks submitted expense for fraud signals
 * @param {Object} expenseData - { userId, amount, convertedAmount, date, currency, expenseId }
 * @returns {string[]} Array of fraud flag strings
 */
async function checkFraud(expenseData) {
  const flags = [];
  const { userId, amount, convertedAmount, date, expenseId } = expenseData;

  // Rule 1: Duplicate detection — same user, same amount, within ±1 day
  const expenseDate = new Date(date);
  const dayBefore = new Date(expenseDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const dayAfter = new Date(expenseDate);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const duplicate = await Expense.findOne({
    _id: { $ne: expenseId }, // Exclude the current expense
    userId,
    amount,
    date: { $gte: dayBefore, $lte: dayAfter },
    status: { $ne: 'REJECTED' },
  });

  if (duplicate) {
    flags.push('DUPLICATE');
  }

  // Rule 2: High amount threshold check (in company currency)
  if (convertedAmount > HIGH_AMOUNT_THRESHOLD) {
    flags.push('HIGH_AMOUNT');
  }

  return flags;
}

export default { checkFraud };
