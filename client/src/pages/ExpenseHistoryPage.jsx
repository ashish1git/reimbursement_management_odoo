import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { expenseApi } from '../api/index.js';
import { formatCurrency, formatDate, formatDateTime, CATEGORY_ICONS } from '../utils/helpers.js';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import ApprovalStepper from '../components/ui/ApprovalStepper.jsx';
import toast from 'react-hot-toast';
import {
  Receipt, ChevronDown, ChevronUp, AlertTriangle, RefreshCw,
  Send, Pencil, ExternalLink, Clock, CheckCircle2, XCircle,
  ChevronRight, Download, RotateCcw, Info,
} from 'lucide-react';

// ─── Summary pipeline banner ─────────────────────────────
function PipelineBanner({ expenses, currency }) {
  const draft = expenses.filter((e) => e.status === 'DRAFT');
  const pending = expenses.filter((e) => ['PENDING', 'FLAGGED'].includes(e.status));
  const approved = expenses.filter((e) => e.status === 'APPROVED');

  const draftTotal = draft.reduce((s, e) => s + (e.convertedAmount || 0), 0);
  const pendingTotal = pending.reduce((s, e) => s + (e.convertedAmount || 0), 0);
  const approvedTotal = approved.reduce((s, e) => s + (e.convertedAmount || 0), 0);

  const stages = [
    { label: 'To Submit', count: draft.length, total: draftTotal, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', icon: Pencil },
    { label: 'Waiting Approval', count: pending.length, total: pendingTotal, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Clock },
    { label: 'Approved', count: approved.length, total: approvedTotal, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: CheckCircle2 },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-5">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">My Expense Pipeline</p>
      <div className="flex items-stretch gap-1">
        {stages.map((stage, i) => (
          <div key={stage.label} className="flex items-center flex-1 min-w-0">
            <div className={`flex-1 rounded-xl border p-3 ${stage.bg} ${stage.border}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <stage.icon className={`w-3.5 h-3.5 ${stage.color}`} />
                <p className={`text-xs font-bold ${stage.color}`}>{stage.label}</p>
              </div>
              <p className={`text-base font-bold ${stage.color}`}>{formatCurrency(stage.total, currency, true)}</p>
              <p className={`text-[10px] ${stage.color} opacity-70 mt-0.5`}>{stage.count} expense{stage.count !== 1 ? 's' : ''}</p>
            </div>
            {i < stages.length - 1 && (
              <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 mx-0.5" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Single Expense Row ───────────────────────────────────
function ExpenseRow({ expense, companyCurrency, onSubmitDraft, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const isDraft = expense.status === 'DRAFT';
  const isRejected = expense.status === 'REJECTED';
  const isFlagged = expense.status === 'FLAGGED';

  const handleSubmitDraft = async () => {
    if (!confirm('Submit this draft for approval?')) return;
    setSubmitting(true);
    try {
      await expenseApi.submitDraft(expense._id, {});
      toast.success('Expense submitted for approval!');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  // FLAW #4: Resubmit after rejection
  const handleResubmit = async () => {
    if (!confirm('Resubmit this rejected expense for a fresh approval cycle?')) return;
    setResubmitting(true);
    try {
      await expenseApi.resubmit(expense._id, {});
      toast.success('Expense resubmitted! A new approval cycle has started.');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resubmit');
    } finally {
      setResubmitting(false);
    }
  };

  return (
    <div className={`border rounded-2xl overflow-hidden bg-white mb-3 transition-all ${
      isDraft ? 'border-slate-200 border-dashed' : 'border-slate-100'
    }`}>
      <button
        className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${isDraft ? 'bg-slate-100' : 'bg-slate-100'}`}>
          {CATEGORY_ICONS[expense.category] || '📦'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-800 truncate">{expense.description}</p>
            {isDraft && (
              <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-semibold flex-shrink-0">DRAFT</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {expense.category} · {formatDate(expense.date)}
            {expense.paidBy && expense.paidBy !== 'Employee' && ` · Paid by ${expense.paidBy}`}
          </p>
          {expense.fraudFlags?.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <AlertTriangle className="w-3 h-3 text-orange-500" />
              <span className="text-xs text-orange-600 font-medium">{expense.fraudFlags.join(' · ')}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-slate-800">{formatCurrency(expense.convertedAmount, companyCurrency)}</p>
            {expense.currency !== companyCurrency && (
              <p className="text-xs text-slate-400">{expense.amount} {expense.currency}</p>
            )}
          </div>
          <StatusBadge status={expense.status} />
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100 pt-4 animate-fade-in">
          {/* Details grid */}
          <div className="grid sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Amount</span>
              <p className="text-xs font-bold text-slate-700 mt-0.5">
                {expense.amount} {expense.currency}
                {expense.currency !== companyCurrency && (
                  <span className="text-slate-400 font-normal ml-1">(≈{formatCurrency(expense.convertedAmount, companyCurrency)})</span>
                )}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Paid By</span>
              <p className="text-xs font-bold text-slate-700 mt-0.5">{expense.paidBy || 'Employee'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Exchange Rate</span>
              <p className="text-xs font-bold text-slate-700 mt-0.5">{expense.exchangeRateUsed?.toFixed(4) || '1.0000'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">
                {isDraft ? 'Created' : 'Submitted'}
              </span>
              <p className="text-xs font-bold text-slate-700 mt-0.5">
                {formatDate(expense.submittedAt || expense.createdAt)}
              </p>
            </div>
          </div>

          {expense.remarks && (
            <div className="bg-slate-50 rounded-xl p-3 mb-4">
              <span className="text-[10px] text-slate-400 font-semibold uppercase">Remarks</span>
              <p className="text-xs text-slate-600 mt-0.5">{expense.remarks}</p>
            </div>
          )}

          {/* Approval Progress — only for submitted */}
          {!isDraft && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">Approval Progress</p>
              <ApprovalStepper
                steps={expense.resolvedSteps || expense.approvalFlowId?.steps || []}
                currentStep={expense.currentStep || 0}
                logs={expense.approvalLogs || []}
                expenseStatus={expense.status}
              />
            </div>
          )}

          {/* Approval log timeline */}
          {expense.approvalLogs?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Approval History</p>
              <div className="space-y-2">
                {expense.approvalLogs.map((log, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                    <span className={`font-bold ${log.action === 'APPROVED' ? 'text-emerald-600' : log.action === 'REJECTED' ? 'text-red-600' : 'text-slate-600'}`}>
                      {log.approverId?.name || 'Admin'}
                    </span>
                    <StatusBadge status={log.action} />
                    <span className="text-slate-400 ml-auto">{formatDateTime(log.createdAt)}</span>
                    {log.comment && <span className="text-slate-500 italic">"{log.comment}"</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Receipt */}
          {expense.receiptUrl && (
            <a href={`http://localhost:5000${expense.receiptUrl}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:underline font-medium mb-3">
              <ExternalLink className="w-3.5 h-3.5" /> View Receipt
            </a>
          )}

          {/* FLAW #5: Visual explanation for FLAGGED (non-required rejection) */}
          {isFlagged && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4 flex items-start gap-2">
              <Info className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-orange-700">Needs Admin Review</p>
                <p className="text-xs text-orange-600 mt-0.5">
                  A non-required approver flagged this expense. An admin will review and make the final decision.
                  You will be notified when a decision is made.
                </p>
              </div>
            </div>
          )}

          {/* Draft submit button */}
          {isDraft && (
            <button
              onClick={handleSubmitDraft}
              disabled={submitting}
              className="btn-primary flex items-center gap-2 text-xs !py-2"
            >
              {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Submit for Approval
            </button>
          )}

          {/* FLAW #4: Resubmit button for rejected expenses */}
          {isRejected && (
            <div className="mt-2">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 flex items-start gap-2">
                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-red-700">This expense was rejected</p>
                  <p className="text-xs text-red-600 mt-0.5">
                    You can correct any issues and resubmit for a fresh approval cycle.
                    The previous approval history will be cleared.
                  </p>
                </div>
              </div>
              <button
                onClick={handleResubmit}
                disabled={resubmitting}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-60"
                id={`resubmit-btn-${expense._id}`}
              >
                {resubmitting
                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  : <RotateCcw className="w-3.5 h-3.5" />}
                Resubmit for Approval
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────
export default function ExpenseHistoryPage() {
  const { companyCurrency, isApprover } = useAuth();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [exporting, setExporting] = useState(false);

  const loadExpenses = useCallback(async () => {
    try {
      const res = await expenseApi.getMy();
      setExpenses(res.data.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExpenses();
    const interval = setInterval(loadExpenses, 30000);
    return () => clearInterval(interval);
  }, [loadExpenses]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await expenseApi.exportCsv({ status: filter !== 'ALL' ? filter : '' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exported!');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const FILTERS = [
    { id: 'ALL', label: 'All' },
    { id: 'DRAFT', label: 'Draft' },
    { id: 'PENDING', label: 'Pending' },
    { id: 'FLAGGED', label: 'Flagged' },
    { id: 'APPROVED', label: 'Approved' },
    { id: 'REJECTED', label: 'Rejected' },
  ];

  const filtered = filter === 'ALL' ? expenses : expenses.filter((e) => e.status === filter);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl skeleton" />)}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Pipeline Banner */}
      <PipelineBanner expenses={expenses} currency={companyCurrency} />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">My Expenses</h1>
          <p className="text-sm text-slate-500 mt-0.5">{expenses.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          {isApprover && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn-secondary flex items-center gap-1.5 text-xs !py-2"
            >
              {exporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export CSV
            </button>
          )}
          <button onClick={loadExpenses} className="btn-secondary flex items-center gap-1.5 text-xs !py-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map((f) => {
          const cnt = f.id === 'ALL' ? expenses.length : expenses.filter((e) => e.status === f.id).length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                filter === f.id
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
            >
              {f.label}
              <span className="ml-1.5 opacity-75">({cnt})</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
          <Receipt className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-400">No expenses found</p>
          <p className="text-xs text-slate-300 mt-1">
            {filter === 'ALL' ? 'Submit your first expense' : `No ${filter.toLowerCase()} expenses`}
          </p>
          <button onClick={() => navigate('/expenses/submit')} className="btn-primary mt-4 text-xs !py-2">
            + New Expense
          </button>
        </div>
      ) : (
        filtered.map((exp) => (
          <ExpenseRow
            key={exp._id}
            expense={exp}
            companyCurrency={companyCurrency}
            onRefresh={loadExpenses}
          />
        ))
      )}
    </div>
  );
}
