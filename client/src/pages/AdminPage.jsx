import { useState, useEffect, useCallback } from 'react';
import { userApi, approvalFlowApi, expenseApi } from '../api/index.js';
import { formatCurrency, formatDate } from '../utils/helpers.js';
import StatusBadge from '../components/ui/StatusBadge.jsx';
import toast from 'react-hot-toast';
import {
  Users, Settings, AlertTriangle, Plus, Trash2,
  Save, X, Loader2, Mail, Send, Shield,
  CheckCircle, Zap, Percent, ToggleLeft, ToggleRight,
  UserCheck, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

// ─────────────────────────────
// TAB: USERS
// ─────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'EMPLOYEE', managerId: '' });
  const [creating, setCreating] = useState(false);
  const [sendingCreds, setSendingCreds] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await userApi.getAll();
      setUsers(res.data.data || []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await userApi.create(createForm);
      toast.success('User created!');
      setShowCreate(false);
      setCreateForm({ name: '', email: '', password: '', role: 'EMPLOYEE', managerId: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Create failed');
    } finally { setCreating(false); }
  };

  const handleRoleChange = async (id, role) => {
    try {
      await userApi.changeRole(id, role);
      toast.success('Role updated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleManagerChange = async (id, managerId) => {
    try {
      await userApi.assignManager(id, managerId || null);
      toast.success('Manager assigned');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const handleSendCredentials = async (id, email) => {
    const reset = confirm(`Send login credentials to ${email}?\n\nClick OK to also RESET their password (recommended for new users).`);
    setSendingCreds(id);
    try {
      const res = await userApi.sendCredentials(id, reset);
      const previewUrl = res.data?.data?.previewUrl;
      const emailSent = res.data?.data?.sent;
      
      if (emailSent) {
        toast.success(`Credentials sent to ${email}!`);
      } else {
        // Email failed but user exists
        toast.error('Email failed to send. User created but credentials not delivered.');
      }
      
      if (previewUrl) {
        // Dev mode — open Ethereal preview
        window.open(previewUrl, '_blank');
        toast(`📬 Email preview opened in new tab (dev mode)`, { duration: 5000 });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send email');
    } finally { setSendingCreds(null); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    try {
      await userApi.delete(id);
      toast.success('User deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const managers = users.filter((u) => ['MANAGER', 'FINANCE', 'DIRECTOR', 'ADMIN'].includes(u.role));

  if (loading) return <div className="h-48 rounded-2xl skeleton" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{users.length} users in company</p>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2 text-xs !py-2">
          {showCreate ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showCreate ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-3 animate-fade-in">
          <h3 className="text-sm font-bold text-indigo-800 flex items-center gap-2">
            <UserCheck className="w-4 h-4" /> Create New User
          </h3>
          <p className="text-xs text-indigo-600">The user's credentials will be sent to their email automatically.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <input className="input-base" placeholder="Full name *" required value={createForm.name}
              onChange={(e) => setCreateForm(p => ({ ...p, name: e.target.value }))} />
            <input className="input-base" type="email" placeholder="Email *" required value={createForm.email}
              onChange={(e) => setCreateForm(p => ({ ...p, email: e.target.value }))} />
            <input className="input-base" type="password" placeholder="Password *" required value={createForm.password}
              onChange={(e) => setCreateForm(p => ({ ...p, password: e.target.value }))} />
            <select className="input-base" value={createForm.role}
              onChange={(e) => setCreateForm(p => ({ ...p, role: e.target.value }))}>
              <option value="EMPLOYEE">Employee</option>
              <option value="MANAGER">Manager</option>
              <option value="FINANCE">Finance</option>
              <option value="DIRECTOR">Director</option>
              <option value="ADMIN">Admin</option>
            </select>
            <select className="input-base sm:col-span-2" value={createForm.managerId}
              onChange={(e) => setCreateForm(p => ({ ...p, managerId: e.target.value }))}>
              <option value="">No manager assigned</option>
              {managers.map((m) => <option key={m._id} value={m._id}>{m.name} ({m.role})</option>)}
            </select>
          </div>
          <button type="submit" disabled={creating} className="btn-primary flex items-center gap-2 text-xs !py-2">
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Create &amp; Send Credentials
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Manager</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Credentials</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((u) => (
                <tr key={u._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600">
                        {u.name?.charAt(0)}
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white focus:border-indigo-400 focus:outline-none"
                      value={u.role}
                      onChange={(e) => handleRoleChange(u._id, e.target.value)}
                    >
                      <option value="EMPLOYEE">EMPLOYEE</option>
                      <option value="MANAGER">MANAGER</option>
                      <option value="FINANCE">FINANCE</option>
                      <option value="DIRECTOR">DIRECTOR</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white max-w-[140px] focus:border-indigo-400 focus:outline-none"
                      value={u.managerId?._id || u.managerId || ''}
                      onChange={(e) => handleManagerChange(u._id, e.target.value)}
                    >
                      <option value="">No manager</option>
                      {managers.filter((m) => m._id !== u._id).map((m) => (
                        <option key={m._id} value={m._id}>{m.name}</option>
                      ))}
                    </select>
                  </td>
                  {/* Send Credentials button — key wireframe feature */}
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleSendCredentials(u._id, u.email)}
                      disabled={sendingCreds === u._id}
                      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-lg font-semibold transition mx-auto disabled:opacity-60"
                      title="Send login credentials to user's email"
                    >
                      {sendingCreds === u._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Send
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDelete(u._id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────
// TAB: APPROVAL FLOW BUILDER
// ─────────────────────────────
const RULE_INFO = {
  NONE: { icon: CheckCircle, label: 'No Rule', desc: 'All approvers must complete in order' },
  PERCENTAGE: { icon: Percent, label: 'Percentage', desc: 'Auto-approve when X% of approvers approve' },
  SPECIFIC: { icon: Shield, label: 'Specific Approver', desc: 'Auto-approve when a specific person approves' },
  HYBRID: { icon: Zap, label: 'Hybrid', desc: 'Either percentage OR specific person triggers approval' },
};

function ApprovalFlowTab() {
  const [flow, setFlow] = useState({
    name: 'Default Approval Flow',
    description: '',
    isManagerApproverFirst: true,
    isSequential: true,
    steps: [],
    rule: { type: 'NONE', percentageThreshold: 60, specificApproverId: '' },
  });
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([approvalFlowApi.get().catch(() => null), userApi.getAll()]).then(([flowRes, usersRes]) => {
      if (flowRes?.data?.data) {
        const f = flowRes.data.data;
        setFlow({
          name: f.name,
          description: f.description || '',
          isManagerApproverFirst: f.isManagerApproverFirst,
          isSequential: f.isSequential !== undefined ? f.isSequential : true,
          steps: (f.steps || []).map((s) => ({
            stepOrder: s.stepOrder,
            approverRole: s.approverRole || null,
            approverId: s.approverId?._id || s.approverId || '', // Extract _id if populated object
            label: s.label || '',
            isRequired: s.isRequired || false,
          })),
          rule: {
            type: f.rule?.type || 'NONE',
            percentageThreshold: f.rule?.percentageThreshold || 60,
            specificApproverId: f.rule?.specificApproverId?._id || f.rule?.specificApproverId || '',
          },
        });
      }
      setUsers(usersRes.data.data || []);
    });
  }, []);

  const addStep = () => {
    setFlow((p) => ({
      ...p,
      steps: [
        ...p.steps,
        { stepOrder: p.steps.length, approverRole: 'MANAGER', approverId: '', label: '', isRequired: false },
      ],
    }));
  };

  const removeStep = (idx) => {
    setFlow((p) => ({
      ...p,
      steps: p.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, stepOrder: i })),
    }));
  };

  const updateStep = (idx, field, value) => {
    setFlow((p) => ({
      ...p,
      steps: p.steps.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await approvalFlowApi.save({
        ...flow,
        steps: flow.steps.map((s, i) => ({
          stepOrder: i,
          approverRole: s.approverRole || null,
          approverId: s.approverId || null,
          label: s.label || s.approverRole || `Step ${i + 1}`,
          isRequired: s.isRequired || false,
        })),
        rule: {
          type: flow.rule.type,
          percentageThreshold: Number(flow.rule.percentageThreshold),
          specificApproverId: flow.rule.specificApproverId || null,
        },
      });
      toast.success('Approval flow saved!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ value, onToggle, label, desc }) => (
    <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4 border border-slate-200">
      <button
        type="button"
        onClick={onToggle}
        className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${value ? 'bg-indigo-600' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : ''}`} />
      </button>
      <div>
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-xs text-slate-400">{desc}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Flow name + description */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Flow Name</label>
          <input className="input-base" value={flow.name}
            onChange={(e) => setFlow((p) => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description (optional)</label>
          <input className="input-base" placeholder="e.g. Approval rule for miscellaneous expenses"
            value={flow.description}
            onChange={(e) => setFlow((p) => ({ ...p, description: e.target.value }))} />
        </div>
      </div>

      {/* Toggles */}
      <div className="grid sm:grid-cols-2 gap-3">
        <Toggle
          value={flow.isManagerApproverFirst}
          onToggle={() => setFlow((p) => ({ ...p, isManagerApproverFirst: !p.isManagerApproverFirst }))}
          label="Manager approves first"
          desc="Employee's direct manager is auto-inserted as step 0 before other approvers"
        />
        <Toggle
          value={flow.isSequential}
          onToggle={() => setFlow((p) => ({ ...p, isSequential: !p.isSequential }))}
          label={flow.isSequential ? 'Sequential (one by one)' : 'Parallel (all at once)'}
          desc={flow.isSequential
            ? 'Requests go to John first, then Mitchell, then Andreas in order'
            : 'Request goes to all approvers simultaneously'}
        />
      </div>

      {/* Steps */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-700">Approvers</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {flow.isSequential ? 'Sequential order — Required approver rejection auto-rejects the expense' : 'Parallel — all approvers notified at once'}
            </p>
          </div>
          <button onClick={addStep} className="btn-secondary flex items-center gap-1.5 text-xs !py-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Approver
          </button>
        </div>

        {flow.steps.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-xl py-8 text-center text-slate-400 text-xs">
            No approvers yet. {flow.isManagerApproverFirst ? 'Manager is auto-added as Step 0.' : 'Add an approver above.'}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Table-style header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-1">
              <span className="col-span-1 text-[10px] font-semibold text-slate-400 uppercase">#</span>
              <span className="col-span-3 text-[10px] font-semibold text-slate-400 uppercase">User / Role</span>
              <span className="col-span-3 text-[10px] font-semibold text-slate-400 uppercase">Specific Person</span>
              <span className="col-span-3 text-[10px] font-semibold text-slate-400 uppercase">Label</span>
              <span className="col-span-1 text-[10px] font-semibold text-slate-400 uppercase text-center">Required</span>
              <span className="col-span-1" />
            </div>
            {flow.steps.map((step, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 grid grid-cols-12 gap-2 items-center">
                <div className="col-span-1">
                  <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                    {idx + 1}
                  </div>
                </div>
                <div className="col-span-3">
                  <select className="input-base !py-1.5 !text-xs" value={step.approverRole || ''}
                    onChange={(e) => updateStep(idx, 'approverRole', e.target.value)}>
                    <option value="">By Role</option>
                    {['MANAGER', 'FINANCE', 'DIRECTOR', 'ADMIN'].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <select className="input-base !py-1.5 !text-xs" value={step.approverId || ''}
                    onChange={(e) => updateStep(idx, 'approverId', e.target.value)}>
                    <option value="">Any matching person</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <input className="input-base !py-1.5 !text-xs" placeholder="Label (optional)"
                    value={step.label || ''} onChange={(e) => updateStep(idx, 'label', e.target.value)} />
                </div>
                {/* Required checkbox — binding approver from wireframe */}
                <div className="col-span-1 flex justify-center">
                  <button
                    type="button"
                    onClick={() => updateStep(idx, 'isRequired', !step.isRequired)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      step.isRequired ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white hover:border-indigo-400'
                    }`}
                    title="If required, this approver's rejection auto-rejects the expense"
                  >
                    {step.isRequired && <span className="text-white text-[10px] font-bold">✓</span>}
                  </button>
                </div>
                <div className="col-span-1 flex justify-end">
                  <button onClick={() => removeStep(idx)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-400 px-1">
              ✓ = Required approver. If Required is ticked and they reject → expense is auto-rejected.
            </p>
          </div>
        )}
      </div>

      {/* Minimum Approval % */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">Conditional Rule</h3>
        <div className="grid sm:grid-cols-2 gap-2 mb-4">
          {Object.entries(RULE_INFO).map(([type, { icon: Icon, label, desc }]) => (
            <button key={type} type="button"
              onClick={() => setFlow((p) => ({ ...p, rule: { ...p.rule, type } }))}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                flow.rule.type === type ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-300'
              }`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${flow.rule.type === type ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className={`text-xs font-bold ${flow.rule.type === type ? 'text-indigo-700' : 'text-slate-600'}`}>{label}</span>
              </div>
              <p className={`text-xs ${flow.rule.type === type ? 'text-indigo-500' : 'text-slate-400'}`}>{desc}</p>
            </button>
          ))}
        </div>

        {(flow.rule.type === 'PERCENTAGE' || flow.rule.type === 'HYBRID') && (
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-3">
            <label className="block text-xs font-semibold text-slate-600 mb-2">
              Minimum Approval Percentage: <span className="text-indigo-600">{flow.rule.percentageThreshold}%</span>
            </label>
            <input type="range" min={10} max={100} step={5}
              value={flow.rule.percentageThreshold}
              onChange={(e) => setFlow((p) => ({ ...p, rule: { ...p.rule, percentageThreshold: Number(e.target.value) } }))}
              className="w-full accent-indigo-600" />
            <p className="text-xs text-slate-400 mt-1">
              Specify the minimum percentage of approvers required to approve the request.
            </p>
          </div>
        )}

        {(flow.rule.type === 'SPECIFIC' || flow.rule.type === 'HYBRID') && (
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Specific Approver</label>
            <select className="input-base" value={flow.rule.specificApproverId || ''}
              onChange={(e) => setFlow((p) => ({ ...p, rule: { ...p.rule, specificApproverId: e.target.value } }))}>
              <option value="">Select approver</option>
              {users.map((u) => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
            </select>
          </div>
        )}
      </div>

      <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save Approval Flow
      </button>
    </div>
  );
}

// ─────────────────────────────
// TAB: FLAGGED EXPENSES
// ─────────────────────────────
function FlaggedTab({ companyCurrency }) {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overriding, setOverriding] = useState(null);

  const load = () => {
    expenseApi.getAll({ status: '' }).then((res) => {
      const flagged = (res.data.data || []).filter((e) => e.fraudFlags?.length > 0);
      setExpenses(flagged);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleOverride = async (id, action) => {
    const comment = prompt(`Add a comment for this ${action.toLowerCase()} override:`);
    if (comment === null) return;
    setOverriding(id);
    try {
      await expenseApi.override(id, action, comment);
      toast.success(`Expense ${action === 'APPROVE' ? 'approved' : 'rejected'} via admin override`);
      setExpenses((p) => p.filter((e) => e._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Override failed');
    } finally { setOverriding(null); }
  };

  if (loading) return <div className="h-48 rounded-2xl skeleton" />;

  return (
    <div className="space-y-3">
      {expenses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium">No flagged expenses</p>
          <p className="text-xs text-slate-300 mt-1">All clear — no suspicious expenses detected</p>
        </div>
      ) : (
        expenses.map((exp) => (
          <div key={exp._id} className="bg-white rounded-2xl border border-orange-200 p-5">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{exp.description}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {exp.userId?.name} · {exp.category} · {formatDate(exp.date)}
                    </p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {exp.fraudFlags.map((flag) => (
                        <span key={flag} className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-semibold">
                          {flag === 'DUPLICATE' ? '🔁 DUPLICATE' : '💰 HIGH_AMOUNT'}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-slate-800">{formatCurrency(exp.convertedAmount, companyCurrency)}</p>
                    <StatusBadge status={exp.status} />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button onClick={() => handleOverride(exp._id, 'APPROVE')} disabled={overriding === exp._id}
                    className="text-xs px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg font-semibold transition flex items-center gap-1.5">
                    ✓ Override Approve
                  </button>
                  <button onClick={() => handleOverride(exp._id, 'REJECT')} disabled={overriding === exp._id}
                    className="text-xs px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-semibold transition flex items-center gap-1.5">
                    ✗ Override Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─────────────────────────────
// MAIN ADMIN PAGE
// ─────────────────────────────
export default function AdminPage() {
  const { companyCurrency } = useAuth();
  const [tab, setTab] = useState('users');

  const TABS = [
    { id: 'users', label: 'Users & Credentials', icon: Users },
    { id: 'flow', label: 'Approval Rules', icon: Settings },
    { id: 'flagged', label: 'Flagged', icon: AlertTriangle },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">Admin Panel</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage users, approval rules, and flagged expenses</p>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab />}
      {tab === 'flow' && <ApprovalFlowTab />}
      {tab === 'flagged' && <FlaggedTab companyCurrency={companyCurrency} />}
    </div>
  );
}
