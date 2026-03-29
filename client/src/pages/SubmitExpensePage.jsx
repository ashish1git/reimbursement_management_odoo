import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { expenseApi, ocrApi } from '../api/index.js';
import { CURRENCIES, CATEGORIES, PAID_BY_OPTIONS, formatCurrency } from '../utils/helpers.js';
import toast from 'react-hot-toast';
import {
  Upload, X, Loader2, AlertTriangle, ArrowRight, Camera,
  DollarSign, CalendarDays, Tag, FileText, RefreshCw,
  Save, Send, CreditCard, MessageSquare, ArrowUpRight,
  Clock, CheckCircle2, ChevronRight, Pencil,
} from 'lucide-react';

const DRAFT_KEY = 'reimburseiq_expense_draft';

const INITIAL_FORM = {
  amount: '',
  currency: '',
  category: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  paidBy: 'Employee',
  remarks: '',
  receiptUrl: '',
  ocrRawData: {},
};

// ─── Status Pipeline ────────────────────────────────────────
function StatusPipeline({ draftTotal, pendingTotal, approvedTotal, currency }) {
  const steps = [
    { label: 'To Submit', value: draftTotal, color: 'text-slate-600', bg: 'bg-slate-100', icon: Pencil },
    { label: 'Waiting Approval', value: pendingTotal, color: 'text-amber-700', bg: 'bg-amber-100', icon: Clock },
    { label: 'Approved', value: approvedTotal, color: 'text-emerald-700', bg: 'bg-emerald-100', icon: CheckCircle2 },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 mb-5">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">My Expense Pipeline</p>
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center flex-1 min-w-0">
            <div className={`flex-1 rounded-xl p-3 ${step.bg}`}>
              <div className="flex items-center gap-2 mb-1">
                <step.icon className={`w-3.5 h-3.5 ${step.color}`} />
                <p className={`text-xs font-semibold ${step.color}`}>{step.label}</p>
              </div>
              <p className={`text-sm font-bold ${step.color}`}>
                {formatCurrency(step.value, currency, true)}
              </p>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 mx-1" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SubmitExpensePage() {
  const { user, companyCurrency } = useAuth();
  const navigate = useNavigate();

  // ── Load draft from localStorage (persist across navigation) ──
  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...INITIAL_FORM, currency: companyCurrency || 'USD', ...parsed };
      }
    } catch { /* ignore */ }
    return { ...INITIAL_FORM, currency: companyCurrency || 'USD' };
  });

  const [receipt, setReceipt] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [conversionPreview, setConversionPreview] = useState(null);
  const [conversionLoading, setConversionLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [pipelineData, setPipelineData] = useState({ draft: 0, pending: 0, approved: 0 });
  const [hasSavedDraft, setHasSavedDraft] = useState(false);

  const fileInputRef = useRef();
  const conversionTimer = useRef();

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  // ── Persist form to localStorage whenever it changes ──────────
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch { /* ignore */ }
  }, [form]);

  // ── Detect if there's an un-submitted draft in localStorage ─────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Consider it a "real" saved draft if amount or description was filled
        setHasSavedDraft(!!(parsed.amount || parsed.description));
      }
    } catch { /* ignore */ }
  }, []);

  // ── Set companyCurrency as default if not yet stored ──────────
  useEffect(() => {
    if (companyCurrency && !form.currency) {
      setForm((p) => ({ ...p, currency: companyCurrency }));
    }
  }, [companyCurrency]);

  const clearLocalDraft = () => {
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  };

  // Load pipeline stats
  useEffect(() => {
    expenseApi.getMy().then((res) => {
      const expenses = res.data.data || [];
      const draft = expenses.filter((e) => e.status === 'DRAFT').reduce((s, e) => s + (e.convertedAmount || 0), 0);
      const pending = expenses.filter((e) => ['PENDING', 'FLAGGED'].includes(e.status)).reduce((s, e) => s + (e.convertedAmount || 0), 0);
      const approved = expenses.filter((e) => e.status === 'APPROVED').reduce((s, e) => s + (e.convertedAmount || 0), 0);
      setPipelineData({ draft, pending, approved });
    }).catch(() => {});
  }, []);

  // Live currency preview
  useEffect(() => {
    clearTimeout(conversionTimer.current);
    if (!form.amount || !form.currency || !companyCurrency) return;
    if (isNaN(parseFloat(form.amount))) return;
    if (form.currency === companyCurrency) {
      setConversionPreview({ convertedAmount: parseFloat(form.amount), rate: 1 });
      return;
    }
    conversionTimer.current = setTimeout(async () => {
      setConversionLoading(true);
      try {
        const res = await ocrApi.getRatePreview(form.amount, form.currency, companyCurrency);
        setConversionPreview(res.data.data);
      } catch {
        setConversionPreview(null);
      } finally {
        setConversionLoading(false);
      }
    }, 600);
  }, [form.amount, form.currency, companyCurrency]);

  // Handle receipt file selection + OCR
  const handleReceiptChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setReceipt(file);
    setReceiptPreview(URL.createObjectURL(file));

    setOcrLoading(true);
    try {
      const fd = new FormData();
      fd.append('receipt', file);
      const res = await ocrApi.parseReceipt(fd);
      const data = res.data.data;
      toast.success('Receipt scanned! Fields auto-filled.');
      setForm((prev) => ({
        ...prev,
        amount: data.amount ? String(data.amount) : prev.amount,
        description: data.description || prev.description,
        date: data.date || prev.date,
        category: data.category || prev.category,
        receiptUrl: data.receiptUrl || prev.receiptUrl,
        ocrRawData: data,
      }));
    } catch {
      toast.error('OCR scan failed. Please fill in manually.');
    } finally {
      setOcrLoading(false);
    }
  };

  const validateForm = () => {
    if (!form.amount || !form.category || !form.description || !form.date) {
      toast.error('Please fill in all required fields');
      return false;
    }
    if (parseFloat(form.amount) <= 0) {
      toast.error('Amount must be greater than zero');
      return false;
    }
    return true;
  };

  const resetForm = () => {
    setForm({ ...INITIAL_FORM, currency: companyCurrency || 'USD' });
    setReceipt(null);
    setReceiptPreview(null);
    setConversionPreview(null);
    clearLocalDraft();
  };

  // Save as DRAFT
  const handleSaveDraft = async () => {
    if (!validateForm()) return;
    setSavingDraft(true);
    try {
      await expenseApi.submit({ ...form, amount: parseFloat(form.amount), saveAsDraft: true });
      toast.success('Saved as draft — submit when ready');
      resetForm();
      navigate('/expenses/history');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSavingDraft(false);
    }
  };

  // Submit directly
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const res = await expenseApi.submit({
        ...form,
        amount: parseFloat(form.amount),
        saveAsDraft: false,
      });

      const newExpense = res.data.data;

      // ── Show fraud flags as inline warning toast, but ALWAYS navigate ──
      if (newExpense.fraudFlags?.length > 0) {
        const flagMessages = newExpense.fraudFlags.map((f) =>
          f === 'DUPLICATE'
            ? '🔁 Duplicate — similar expense detected for this date'
            : '💰 High amount — exceeds company threshold'
        );
        toast(
          (t) => (
            <div>
              <p className="font-bold text-orange-800 text-sm mb-1">⚠️ Submitted with flags</p>
              {flagMessages.map((msg, i) => (
                <p key={i} className="text-xs text-orange-700">{msg}</p>
              ))}
              <p className="text-xs text-slate-500 mt-1">Your expense is submitted and pending review.</p>
              <button onClick={() => toast.dismiss(t.id)} className="text-xs underline text-orange-600 mt-1">Dismiss</button>
            </div>
          ),
          { duration: 8000, icon: '⚠️' }
        );
      } else {
        toast.success('Expense submitted for approval!');
      }

      // Always clear local draft and navigate to history
      resetForm();
      navigate('/expenses/history');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">New Expense</h1>
        <p className="text-sm text-slate-500 mt-0.5">Upload a receipt or fill in the details</p>
      </div>

      {/* Saved-locally banner */}
      {hasSavedDraft && (
        <div className="mb-4 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-700 flex items-center justify-between">
          <span>📝 <strong>Draft restored</strong> from your last session.</span>
          <button onClick={resetForm} className="text-indigo-500 hover:text-indigo-700 underline ml-4">Clear form</button>
        </div>
      )}

      {/* Pipeline */}
      <StatusPipeline
        draftTotal={pipelineData.draft}
        pendingTotal={pipelineData.pending}
        approvedTotal={pipelineData.approved}
        currency={companyCurrency}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Receipt Upload */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Attach Receipt (optional — OCR auto-fills)
            </label>
            {receiptPreview && (
              <button type="button" onClick={() => { setReceipt(null); setReceiptPreview(null); }}
                className="text-xs text-red-500 hover:underline flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Remove
              </button>
            )}
          </div>
          {receiptPreview ? (
            <div className="relative">
              <img src={receiptPreview} alt="Receipt preview"
                className="w-full max-h-48 object-contain rounded-xl border border-slate-200 bg-slate-50" />
              {ocrLoading && (
                <div className="absolute inset-0 bg-white/80 rounded-xl flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                  <span className="text-sm font-medium text-indigo-600">Scanning receipt with OCR...</span>
                </div>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-200 rounded-xl p-7 flex flex-col items-center gap-2 hover:border-indigo-300 hover:bg-indigo-50 transition-all group">
              <div className="w-10 h-10 bg-indigo-50 group-hover:bg-indigo-100 rounded-xl flex items-center justify-center transition">
                <Camera className="w-5 h-5 text-indigo-500" />
              </div>
              <span className="text-sm font-medium text-slate-600 group-hover:text-indigo-700">Upload Receipt</span>
              <span className="text-xs text-slate-400">JPG, PNG, PDF · OCR will auto-fill the form</span>
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleReceiptChange} />
        </div>

        {/* Expense Details */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Expense Details</h2>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="px-2 py-0.5 bg-slate-100 rounded-full font-semibold text-slate-500">Draft</span>
              <ChevronRight className="w-3 h-3" />
              <span className="px-2 py-0.5 bg-amber-100 rounded-full font-semibold text-amber-600">Waiting</span>
              <ChevronRight className="w-3 h-3" />
              <span className="px-2 py-0.5 bg-emerald-100 rounded-full font-semibold text-emerald-600">Approved</span>
            </div>
          </div>

          {/* Amount + Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                <DollarSign className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />Amount *
              </label>
              <input className="input-base" type="number" step="0.01" min="0.01" placeholder="0.00"
                value={form.amount} onChange={set('amount')} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Currency *</label>
              <select className="input-base" value={form.currency} onChange={set('currency')}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Live conversion preview */}
          {form.amount && form.currency && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${conversionPreview ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-400'}`}>
              {conversionLoading ? (
                <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Fetching live rate...</>
              ) : conversionPreview ? (
                <>
                  <ArrowUpRight className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="font-bold">≈ {formatCurrency(conversionPreview.convertedAmount, companyCurrency)}</span>
                  <span className="text-indigo-400">in company currency (rate: {conversionPreview.rate?.toFixed(4)})</span>
                </>
              ) : null}
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              <Tag className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />Category *
            </label>
            <div className="grid grid-cols-5 gap-2">
              {CATEGORIES.map((cat) => (
                <button key={cat} type="button" onClick={() => setForm((p) => ({ ...p, category: cat }))}
                  className={`py-2 px-1 rounded-xl border text-xs font-medium transition-all ${
                    form.category === cat
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100'
                      : 'border-slate-200 text-slate-500 hover:border-indigo-300 hover:bg-slate-50'
                  }`}>
                  {cat === 'Travel' ? '✈️' : cat === 'Food' ? '🍽️' : cat === 'Accommodation' ? '🏨' : cat === 'Equipment' ? '💻' : '📦'}
                  <br />
                  <span className="text-[10px]">{cat}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              <FileText className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />Description *
            </label>
            <input className="input-base" type="text" placeholder="e.g. Client dinner at Restaurant XYZ"
              value={form.description} onChange={set('description')} />
          </div>

          {/* Date + Paid By */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                <CalendarDays className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />Expense Date *
              </label>
              <input className="input-base" type="date" value={form.date} onChange={set('date')}
                max={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                <CreditCard className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />Paid By
              </label>
              <select className="input-base" value={form.paidBy} onChange={set('paidBy')}>
                {PAID_BY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              <MessageSquare className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />Remarks (optional)
            </label>
            <input className="input-base" type="text" placeholder="Any additional notes..."
              value={form.remarks} onChange={set('remarks')} />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft || loading}
            className="btn-secondary flex items-center justify-center gap-2 py-3"
            id="save-draft-btn"
          >
            {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save as Draft
          </button>
          <button
            type="submit"
            disabled={loading || savingDraft}
            className="btn-primary flex items-center justify-center gap-2 py-3"
            id="submit-expense-btn"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit for Approval
          </button>
        </div>

        <p className="text-xs text-center text-slate-400">
          Save as Draft to review later · Submit to start the approval process
        </p>
      </form>
    </div>
  );
}
