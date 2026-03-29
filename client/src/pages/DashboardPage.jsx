import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { analyticsApi, expenseApi } from '../api/index.js';
import { formatCurrency, formatDate, STATUS_COLORS, CATEGORY_ICONS, timeAgo } from '../utils/helpers.js';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import {
  TrendingUp, TrendingDown, Receipt, Clock, CheckCircle2,
  XCircle, AlertTriangle, Users, BarChart3, ArrowUpRight,
  Lightbulb, DollarSign,
} from 'lucide-react';

function StatCard({ title, value, subtitle, icon: Icon, color, trend }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 card-hover">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-semibold flex items-center gap-1 ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs font-semibold text-slate-500 mt-0.5">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function InsightCard({ insights, currency }) {
  if (!insights || insights.length === 0) return null;
  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center">
          <Lightbulb className="w-4 h-4 text-indigo-600" />
        </div>
        <h3 className="text-sm font-bold text-indigo-800">Smart Insights</h3>
      </div>
      <div className="space-y-2.5">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="text-base leading-none mt-0.5">{insight.icon}</span>
            <p className="text-xs text-indigo-700 leading-relaxed">{insight.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, isAdmin, isManager, companyCurrency } = useAuth();
  const [summary, setSummary] = useState(null);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [sumRes, expRes] = await Promise.all([
        analyticsApi.getSummary(),
        expenseApi.getMy(),
      ]);
      setSummary(sumRes.data.data);
      setRecentExpenses(expRes.data.data?.slice(0, 5) || []);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Poll every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Build status counts map
  const statusMap = {};
  summary?.statusCounts?.forEach((s) => {
    statusMap[s._id] = s;
  });

  // Build smart insights
  const insights = [];
  if (summary) {
    if (summary.monthOverMonthChange !== null) {
      const change = summary.monthOverMonthChange;
      insights.push({
        icon: change >= 0 ? '📈' : '📉',
        text: `You spent ${Math.abs(change)}% ${change >= 0 ? 'more' : 'less'} than last month.`,
      });
    }
    if (summary.categoryBreakdown?.[0]) {
      insights.push({
        icon: CATEGORY_ICONS[summary.categoryBreakdown[0]._id] || '📊',
        text: `Top expense category this month: ${summary.categoryBreakdown[0]._id} (${formatCurrency(summary.categoryBreakdown[0].total, companyCurrency, true)}).`,
      });
    }
    if (summary.flaggedCount > 0) {
      insights.push({
        icon: '⚠️',
        text: `${summary.flaggedCount} expense${summary.flaggedCount > 1 ? 's' : ''} flagged for review.`,
      });
    }
    if (summary.pendingCount > 0) {
      insights.push({
        icon: '⏳',
        text: `${summary.pendingCount} expense${summary.pendingCount > 1 ? 's' : ''} pending approval.`,
      });
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 h-28 skeleton border border-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">
          {isAdmin ? '📊 Company Dashboard' : isManager ? '👔 Manager Dashboard' : '💼 My Dashboard'}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {isAdmin ? 'Company-wide financial overview' : 'Your expense activity'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="This Month"
          value={formatCurrency(summary?.thisMonth?.total || 0, companyCurrency, true)}
          icon={DollarSign}
          color="bg-indigo-500"
          trend={summary?.monthOverMonthChange}
          subtitle={`${summary?.thisMonth?.count || 0} expenses`}
        />
        <StatCard
          title="Drafts"
          value={statusMap['DRAFT']?.count || 0}
          icon={Receipt}
          color="bg-slate-400"
          subtitle="Saved, not submitted"
        />
        <StatCard
          title="Pending Approval"
          value={statusMap['PENDING']?.count || 0}
          icon={Clock}
          color="bg-amber-400"
          subtitle={formatCurrency(statusMap['PENDING']?.total || 0, companyCurrency, true)}
        />
        <StatCard
          title="Approved"
          value={statusMap['APPROVED']?.count || 0}
          icon={CheckCircle2}
          color="bg-emerald-500"
          subtitle={formatCurrency(statusMap['APPROVED']?.total || 0, companyCurrency, true)}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Expenses */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Recent Expenses</h2>
            <span className="text-xs text-slate-400">{recentExpenses.length} shown</span>
          </div>
          <div className="divide-y divide-slate-50">
            {recentExpenses.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Receipt className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No expenses yet</p>
              </div>
            ) : (
              recentExpenses.map((exp) => (
                <div key={exp._id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-lg flex-shrink-0">
                    {CATEGORY_ICONS[exp.category] || '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{exp.description}</p>
                    <p className="text-xs text-slate-400">{exp.category} · {formatDate(exp.date)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-800">
                      {formatCurrency(exp.convertedAmount, companyCurrency)}
                    </p>
                    <StatusBadge status={exp.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          <InsightCard insights={insights} currency={companyCurrency} />

          {/* Category Breakdown */}
          {summary?.categoryBreakdown?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-4">By Category</h3>
              <div className="space-y-3">
                {summary.categoryBreakdown.slice(0, 5).map((cat) => {
                  const total = summary.thisMonth?.total || 1;
                  const pct = Math.round((cat.total / total) * 100);
                  return (
                    <div key={cat._id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                          {CATEGORY_ICONS[cat._id]} {cat._id}
                        </span>
                        <span className="text-xs font-semibold text-slate-700">
                          {formatCurrency(cat.total, companyCurrency, true)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Admin: Per-user breakdown */}
          {isAdmin && summary?.perUserBreakdown?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Top Spenders</h3>
              <div className="space-y-3">
                {summary.perUserBreakdown.slice(0, 5).map((u) => (
                  <div key={u._id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 flex-shrink-0">
                      {u.name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.count} expenses</p>
                    </div>
                    <span className="text-xs font-bold text-slate-700">
                      {formatCurrency(u.total, companyCurrency, true)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
