import Expense from '../models/Expense.js';
import User from '../models/User.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { EXPENSE_STATUS } from '../config/constants.js';

// GET /api/analytics/summary — Dashboard analytics
export const getSummary = asyncHandler(async (req, res) => {
  const companyId = req.user.companyId._id;
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Build base filter based on user role
  let baseFilter = { companyId };
  if (req.user.role === 'EMPLOYEE') {
    baseFilter.userId = req.user._id;
  } else if (req.user.role === 'MANAGER') {
    // Find all employees under this manager
    const team = await User.find({ managerId: req.user._id }).select('_id');
    const teamIds = team.map((u) => u._id);
    baseFilter.userId = { $in: [...teamIds, req.user._id] };
  }

  // Total by status
  const statusCounts = await Expense.aggregate([
    { $match: baseFilter },
    { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$convertedAmount' } } },
  ]);

  // This month total
  const thisMonthData = await Expense.aggregate([
    { $match: { ...baseFilter, date: { $gte: thisMonthStart } } },
    { $group: { _id: null, total: { $sum: '$convertedAmount' }, count: { $sum: 1 } } },
  ]);

  // Last month total
  const lastMonthData = await Expense.aggregate([
    {
      $match: {
        ...baseFilter,
        date: { $gte: lastMonthStart, $lte: lastMonthEnd },
      },
    },
    { $group: { _id: null, total: { $sum: '$convertedAmount' }, count: { $sum: 1 } } },
  ]);

  // Category breakdown (this month)
  const categoryBreakdown = await Expense.aggregate([
    { $match: { ...baseFilter, date: { $gte: thisMonthStart } } },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$convertedAmount' },
        count: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
  ]);

  // Flagged expenses count
  const flaggedCount = await Expense.countDocuments({
    ...baseFilter,
    fraudFlags: { $exists: true, $not: { $size: 0 } },
  });

  // Pending count
  const pendingCount = await Expense.countDocuments({
    ...baseFilter,
    status: { $in: [EXPENSE_STATUS.PENDING, EXPENSE_STATUS.FLAGGED] },
  });

  // Per-user breakdown (admin only)
  let perUserBreakdown = [];
  if (req.user.role === 'ADMIN') {
    perUserBreakdown = await Expense.aggregate([
      { $match: { companyId, date: { $gte: thisMonthStart } } },
      {
        $group: {
          _id: '$userId',
          total: { $sum: '$convertedAmount' },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          name: '$user.name',
          email: '$user.email',
          total: 1,
          count: 1,
        },
      },
      { $sort: { total: -1 } },
    ]);
  }

  const thisMonthTotal = thisMonthData[0]?.total || 0;
  const lastMonthTotal = lastMonthData[0]?.total || 0;
  const monthOverMonthChange =
    lastMonthTotal > 0
      ? parseFloat((((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100).toFixed(1))
      : null;

  res.json(
    new ApiResponse(
      200,
      {
        statusCounts,
        thisMonth: { total: thisMonthTotal, count: thisMonthData[0]?.count || 0 },
        lastMonth: { total: lastMonthTotal, count: lastMonthData[0]?.count || 0 },
        monthOverMonthChange,
        categoryBreakdown,
        flaggedCount,
        pendingCount,
        perUserBreakdown,
        currency: req.user.companyId.defaultCurrency,
      },
      'Analytics summary fetched'
    )
  );
});
