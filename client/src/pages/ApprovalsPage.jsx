import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { expenseApi } from '../api/index.js';
import { formatCurrency, formatDate, formatDateTime, CATEGORY_ICONS } from '../utils/helpers.js';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import ApprovalStepper from '../components/ui/ApprovalStepper.jsx';
import toast from 'react-hot-toast';
import {
  CheckCircle2, XCircle, ChevronDown, ChevronUp, AlertTriangle,
  MessageSquare, Loader2, Clock, RefreshCw, History, Inbox,
  User, CheckCheck,
} from 'lucide-react';

// ─── Approval Confirmation Modal ────────────────────────────
function ApprovalModal({ expense, action, onClose, onConfirm, loading }) {
  const [comment, setComment] = useState('');
  const companyCurrency = expense.companyId?.defaultCurrency;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-fade-in">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
          {action === 'approve' ? (
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          ) : (
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
          )}
          <div>
            <h3 className={`text-sm font-bold ${action === 'approve' ? 'text-emerald-700' : 'text-red-700'}`}>
              {action === 'approve' ? 'Approve Expense' : 'Reject Expense'}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {expense.description} — {formatCurrency(expense.convertedAmount, companyCurrency)}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            <MessageSquare className="w-3.5 h-3.5 inline mr-1" />
            {action === 'reject' ? 'Rejection reason * (required)' : 'Comment (optional)'}
          </label>
          <textarea
            className="input-base resize-none"
            rows={3}
            placeholder={action === 'reject' ? 'Explain why this is rejected...' : 'Add a note for the employee...'}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => onConfirm(comment)}
            disabled={loading || (action === 'reject' && !comment.trim())}
            className={`flex-1 flex items-center justify-center gap-2 font-semibold text-sm py-2.5 px-4 rounded-lg transition-all disabled:opacity-60 ${
              action === 'approve'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (action === 'approve' ? '✓ Approve' : '✗ Reject')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Expandable Row ─────────────────────────────────
function ExpenseRow({ expense, onAction, actionLoading, isHistory }) {
  const [expanded, setExpanded] = useState(false);
  const companyCurrency = expense.companyId?.defaultCurrency;

  // Find MY action in the logs (for history view)
  const myLog = isHistory
    ? expense.approvalLogs?.find((l) => l.action === 'APPROVED' || l.action === 'REJECTED')
    : null;

  const statusColor = expense.status === 'APPROVED'
    ? 'text-emerald-600'
    : expense.status === 'REJECTED'
    ? 'text-red-600'
    : 'text-amber-600';

  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
        {/* Subject / Description */}
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-base flex-shrink-0">
              {CATEGORY_ICONS[expense.category] || '📦'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate max-w-[180px]">{expense.description}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{expense.category} · {formatDate(expense.date)}</p>
            </div>
          </div>
        </td>

        {/* Request Owner */}
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
              {expense.userId?.name?.charAt(0)}
            </div>
            <span className="text-xs text-slate-600 font-medium">{expense.userId?.name}</span>
          </div>
        </td>

        {/* Category */}
        <td className="px-4 py-3.5">
          <span className="text-xs text-slate-500">{expense.category}</span>
        </td>

        {/* Status + Flags */}
        <td className="px-4 py-3.5">
          <StatusBadge status={expense.status} />
          {expense.fraudFlags?.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <AlertTriangle className="w-3 h-3 text-orange-500" />
              <span className="text-[10px] text-orange-600 font-semibold">{expense.fraudFlags.join(', ')}</span>
            </div>
          )}
        </td>

        {/* Total Amount */}
        <td className="px-4 py-3.5 text-right">
          <p className="text-sm font-bold text-slate-800">{formatCurrency(expense.convertedAmount, companyCurrency)}</p>
          {expense.currency !== companyCurrency && (
            <p className="text-[10px] text-slate-400">{expense.amount} {expense.currency}</p>
          )}
        </td>

        {/* Actions column */}
        <td className="px-4 py-3.5">
          {isHistory ? (
            /* History: show what decision was made and when */
            myLog ? (
              <div className="text-xs">
                <span className={`font-bold ${myLog.action === 'APPROVED' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {myLog.action === 'APPROVED' ? '✓ Approved' : '✗ Rejected'}
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(myLog.actedAt)}</p>
              </div>
            ) : (
              <span className={`text-xs font-semibold ${statusColor}`}>
                {expense.status}
              </span>
            )
          ) : (
            /* Pending: show action buttons */
            <div className="flex items-center gap-2">
              <button
                onClick={() => onAction(expense, 'approve')}
                disabled={actionLoading === expense._id}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg transition-all disabled:opacity-60 flex items-center gap-1"
                id={`approve-btn-${expense._id}`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                onClick={() => onAction(expense, 'reject')}
                disabled={actionLoading === expense._id}
                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-semibold rounded-lg transition-all disabled:opacity-60 flex items-center gap-1"
                id={`reject-btn-${expense._id}`}
              >
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          )}
        </td>

        {/* Expand toggle */}
        <td className="px-3 py-3.5">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </td>
      </tr>

      {/* Expanded row — Approval Timeline */}
      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50">
          <td colSpan={7} className="px-8 py-4">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Approval flow stepper */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Approval Flow</p>
                <ApprovalStepper
                  steps={expense.resolvedSteps || []}
                  currentStep={expense.currentStep || 0}
                  logs={expense.approvalLogs || []}
                  expenseStatus={expense.status}
                />
              </div>
              {/* Decision history timeline */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Decision History</p>
                {expense.approvalLogs?.length > 0 ? (
                  <div className="space-y-2">
                    {expense.approvalLogs.map((log, i) => (
                      <div key={i} className="flex items-start gap-3 bg-white rounded-xl border border-slate-100 p-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          log.action === 'APPROVED' ? 'bg-emerald-100' : log.action === 'REJECTED' ? 'bg-red-100' : 'bg-slate-100'
                        }`}>
                          <span className="text-[10px]">
                            {log.action === 'APPROVED' ? '✓' : log.action === 'REJECTED' ? '✗' : '⚡'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 justify-between">
                            <p className="text-xs font-semibold text-slate-700">{log.approverId?.name || 'Admin'}</p>
                            <p className="text-[10px] text-slate-400">{formatDateTime(log.actedAt || log.createdAt)}</p>
                          </div>
                          <StatusBadge status={log.action} />
                          {log.comment && (
                            <p className="text-xs text-slate-500 mt-1 italic">"{log.comment}"</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No decisions yet</p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Expense Table ─────────────────────────────────────────
function ExpenseTable({ expenses, onAction, actionLoading, isHistory, emptyMessage }) {
  if (expenses.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 py-20 text-center">
        {isHistory
          ? <History className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          : <CheckCheck className="w-12 h-12 text-emerald-200 mx-auto mb-3" />
        }
        <p className="text-base font-semibold text-slate-400">{emptyMessage}</p>
        <p className="text-sm text-slate-300 mt-1">
          {isHistory ? 'Expenses you approve/reject will appear here.' : "You're all caught up 🎉"}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Expense</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Submitted by</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Category</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">
                Amount<br /><span className="font-normal text-slate-400">(company currency)</span>
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">
                {isHistory ? 'My Decision' : 'Actions'}
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp) => (
              <ExpenseRow
                key={exp._id}
                expense={exp}
                onAction={onAction}
                actionLoading={actionLoading}
                isHistory={isHistory}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────
export default function ApprovalsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');

  // Pending state
  const [pending, setPending] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(true);

  // History state
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Action state
  const [modal, setModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const res = await expenseApi.getPending();
      setPending(res.data.data || []);
    } catch {
      // silent
    } finally {
      setPendingLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await expenseApi.getApprovalHistory();
      setHistory(res.data.data || []);
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Load both on mount; auto-refresh pending every 30s
  useEffect(() => {
    loadPending();
    loadHistory();
    const interval = setInterval(loadPending, 30000);
    return () => clearInterval(interval);
  }, [loadPending, loadHistory]);

  const handleAction = (expense, action) => setModal({ expense, action });

  const handleConfirm = async (comment) => {
    const { expense, action } = modal;
    setActionLoading(expense._id);
    try {
      if (action === 'approve') {
        await expenseApi.approve(expense._id, comment);
        toast.success('Expense approved! Employee will be notified.');
      } else {
        await expenseApi.reject(expense._id, comment);
        toast.success('Expense rejected. Employee will be notified.');
      }
      setModal(null);
      // Refresh both lists — the approved item moves from pending to history
      await Promise.all([loadPending(), loadHistory()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([loadPending(), loadHistory()]);
    toast.success('Refreshed');
  };

  const pendingCount = pending.filter((e) => ['PENDING', 'FLAGGED'].includes(e.status)).length;
  const historyCount = history.length;

  const TABS = [
    {
      id: 'pending',
      label: 'Pending Review',
      icon: Clock,
      count: pendingCount,
      badge: pendingCount > 0 ? 'bg-amber-500' : null,
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      count: historyCount,
      badge: null,
    },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Approvals</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {pendingCount > 0 ? (
              <><span className="text-amber-600 font-semibold">{pendingCount}</span> expense{pendingCount > 1 ? 's' : ''} awaiting your action</>
            ) : 'All caught up — no pending approvals'}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={pendingLoading || historyLoading}
          className="btn-secondary !py-1.5 flex items-center gap-1.5 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${(pendingLoading || historyLoading) ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-5 w-fit">
        {TABS.map(({ id, label, icon: Icon, count, badge }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all relative ${
              activeTab === id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                badge ? `${badge} text-white` : 'bg-slate-200 text-slate-600'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── PENDING TAB ─────────────────────────────────────────── */}
      {activeTab === 'pending' && (
        pendingLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl skeleton" />)}
          </div>
        ) : (
          <ExpenseTable
            expenses={pending.filter((e) => ['PENDING', 'FLAGGED'].includes(e.status))}
            onAction={handleAction}
            actionLoading={actionLoading}
            isHistory={false}
            emptyMessage="No pending approvals"
          />
        )
      )}

      {/* ── HISTORY TAB ─────────────────────────────────────────── */}
      {activeTab === 'history' && (
        historyLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl skeleton" />)}
          </div>
        ) : (
          <>
            {history.length > 0 && (
              <p className="text-xs text-slate-400 mb-3">
                Showing all expenses you have approved or rejected. Click a row to see the full decision timeline.
              </p>
            )}
            <ExpenseTable
              expenses={history}
              onAction={null}
              actionLoading={null}
              isHistory={true}
              emptyMessage="No approval history yet"
            />
          </>
        )
      )}

      {/* Confirmation Modal */}
      {modal && (
        <ApprovalModal
          expense={modal.expense}
          action={modal.action}
          onClose={() => setModal(null)}
          onConfirm={handleConfirm}
          loading={actionLoading === modal.expense._id}
        />
      )}
    </div>
  );
}
