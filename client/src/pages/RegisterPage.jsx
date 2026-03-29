import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { authApi } from '../api/index.js';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Wallet, ArrowRight, Building2, Lock } from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [countries, setCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [form, setForm] = useState({
    name: '', email: '', password: '', country: '', companyName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFirstUser, setIsFirstUser] = useState(null); // null = loading

  useEffect(() => {
    authApi.checkFirstUser()
      .then((res) => setIsFirstUser(res.data.data.isFirstUser))
      .catch(() => setIsFirstUser(true));

    // Fetch countries (only needed for first-user form)
    fetch('https://restcountries.com/v3.1/all?fields=name,currencies')
      .then((r) => r.json())
      .then((data) => {
        const sorted = data
          .filter((c) => c.name?.common && c.currencies)
          .map((c) => ({
            name: c.name.common,
            currency: Object.keys(c.currencies)[0],
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setCountries(sorted);
      })
      .catch(() => setCountries([{ name: 'United States', currency: 'USD' }]))
      .finally(() => setLoadingCountries(false));
  }, []);

  const selectedCountryData = countries.find((c) => c.name === form.country);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password || !form.country) {
      toast.error('Please fill in all required fields');
      return;
    }
    setLoading(true);
    try {
      const user = await register(form);
      toast.success(`Welcome, ${user.name}! Company created successfully.`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  return (
    <div className="min-h-screen flex">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 auth-bg flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-20 right-20 w-48 h-48 rounded-full bg-white blur-3xl" />
        </div>
        <div className="relative">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <span className="text-white text-xl font-bold">ReimburseIQ</span>
          </div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Expense Management,<br />Reimagined.
          </h2>
          <p className="text-white/75 text-lg leading-relaxed">
            Multi-level approvals, OCR receipt scanning, fraud detection, and real-time currency conversion — all in one platform.
          </p>
        </div>
        <div className="relative grid grid-cols-2 gap-4">
          {[
            { label: 'Approval Engine', desc: 'Multi-step conditional workflows' },
            { label: 'OCR Scanning', desc: 'Auto-fill from receipts' },
            { label: 'Fraud Detection', desc: 'AI-powered anomaly alerts' },
            { label: 'Multi-currency', desc: 'Live conversion rates' },
          ].map((f) => (
            <div key={f.label} className="bg-white/10 rounded-xl p-4 border border-white/20">
              <p className="text-white font-semibold text-sm">{f.label}</p>
              <p className="text-white/65 text-xs mt-0.5">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-6 lg:hidden">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Wallet className="w-4 h-4 text-white" />
              </div>
              <span className="text-slate-800 font-bold">ReimburseIQ</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-5 h-5 text-indigo-500" />
              <h1 className="text-2xl font-bold text-slate-800">Create your company</h1>
            </div>
            <p className="text-slate-500 text-sm">
              {isFirstUser === false
                ? 'A company already exists. Only the very first setup creates a new company.'
                : "You're the first user — your account will be the Admin."}
            </p>
          </div>

          {/* ── Company already exists: block self-registration ─────────── */}
          {isFirstUser === false ? (
            <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl text-center">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6 text-amber-600" />
              </div>
              <p className="font-bold text-amber-800 mb-2">Self-registration is disabled</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Your company is already set up. New users do <strong>not</strong> register here
                — your Admin creates accounts from the Admin Panel and sends you credentials by email.
              </p>
              <div className="mt-4 p-3 bg-amber-100 rounded-xl text-xs text-amber-800">
                ℹ️ <strong>Country &amp; currency</strong> are only needed for the first-admin setup.
                Admin-created users inherit the company's currency automatically.
              </div>
              <p className="text-xs text-amber-600 mt-4">
                Already received your credentials?{' '}
                <Link to="/login" className="underline font-semibold">Sign in →</Link>
              </p>
            </div>
          ) : (
            /* ── First user: full registration form ───────────────────── */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name *</label>
                <input
                  className="input-base"
                  type="text"
                  placeholder="John Doe"
                  value={form.name}
                  onChange={set('name')}
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Work Email *</label>
                <input
                  className="input-base"
                  type="email"
                  placeholder="john@company.com"
                  value={form.email}
                  onChange={set('email')}
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password *</label>
                <div className="relative">
                  <input
                    className="input-base pr-10"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    value={form.password}
                    onChange={set('password')}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Company Name</label>
                <input
                  className="input-base"
                  type="text"
                  placeholder="Acme Corp (optional)"
                  value={form.companyName}
                  onChange={set('companyName')}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Country * <span className="text-slate-400 font-normal">(sets default currency for the whole company)</span>
                </label>
                <select
                  className="input-base"
                  value={form.country}
                  onChange={set('country')}
                  disabled={loadingCountries}
                >
                  <option value="">{loadingCountries ? 'Loading countries...' : 'Select country'}</option>
                  {countries.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.currency})
                    </option>
                  ))}
                </select>
                {selectedCountryData && (
                  <p className="text-xs text-indigo-600 mt-1.5 font-medium">
                    ✓ Company currency will be set to {selectedCountryData.currency}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
                id="register-submit-btn"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Create Company &amp; Account <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
