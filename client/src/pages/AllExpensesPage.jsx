import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { expenseApi } from '../api/index.js';
import { formatCurrency, formatDate, CATEGORY_ICONS } from '../utils/helpers.js';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import { Download, Filter, AlertTriangle, Users } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AllExpensesPage() {
  const { companyCurrency, isAdmin, isManager } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', category: '' });

  // FLAW #1: MANAGER sees only their direct reports' expenses
  // ADMIN sees all company expenses
  const load = useCallback(async () => {
    try {
      let res;
      if (isManager) {
        res = await expenseApi.getTeam(filters);
      } else {
        res = await expenseApi.getAll(filters);
      }
      setExpenses(res.data.data || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [filters, isAdmin, isManager]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    try {
      const res = await expenseApi.exportCsv(filters);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'expenses.csv';
      a.click();
      toast.success('CSV downloaded!');
    } catch {
      toast.error('Export failed');
    }
  };

  if (loading) {
    return <div className="h-64 rounded-2xl skeleton" />;
  }

  const pageTitle = isManager ? 'My Team Expenses' : 'All Expenses';
  const pageSubtitle = isManager
    ? `Showing expenses from your direct reports (${expenses.length} records)`
    : `${expenses.length} records across the company`;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            {isManager && <Users className="w-5 h-5 text-indigo-500" />}
            <h1 className="text-xl font-bold text-slate-800">{pageTitle}</h1>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{pageSubtitle}</p>
          {isManager && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-2 inline-flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Scoped to your direct reports only. Contact Admin to view all company expenses.
            </p>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          <select
            className="input-base !py-2 !text-xs w-auto"
            value={filters.status}
            onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
          >
            <option value="">All Statuses</option>
            {['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            className="input-base !py-2 !text-xs w-auto"
            value={filters.category}
            onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}
          >
            <option value="">All Categories</option>
            {['Travel', 'Food', 'Accommodation', 'Equipment', 'Other'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-xs !py-2">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Employee</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Description</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">Amount</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 text-sm">No expenses found</td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                          {exp.userId?.name?.charAt(0) || '?'}
                        </div>
                        <span className="text-xs font-medium text-slate-700 truncate max-w-[100px]">
                          {exp.userId?.name || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 max-w-[150px] truncate" title={exp.description}>
                      {exp.description}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                      {CATEGORY_ICONS[exp.category]} {exp.category}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(exp.date)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-xs text-slate-800 whitespace-nowrap">
                      {formatCurrency(exp.convertedAmount, companyCurrency)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={exp.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {exp.fraudFlags?.length > 0 ? (
                        <span title={exp.fraudFlags.join(', ')}>
                          <AlertTriangle className="w-4 h-4 text-orange-500 mx-auto" />
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
