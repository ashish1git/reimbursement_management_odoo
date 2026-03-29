import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { authApi } from '../api/index.js';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Wallet, ArrowRight, Mail, KeyRound, ArrowLeft } from 'lucide-react';

function ForgotPasswordModal({ onClose }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) { toast.error('Enter your email'); return; }
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      setSent(true);
      // In dev mode, Ethereal preview URL is returned
      if (res.data?.data?.previewUrl) {
        setPreviewUrl(res.data.data.previewUrl);
      }
    } catch {
      toast.error('Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl p-7 w-full max-w-sm shadow-2xl">
        <button onClick={onClose} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-5 transition">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to login
        </button>

        {sent ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-2">Email Sent!</h3>
            <p className="text-sm text-slate-500 mb-4">
              A temporary password has been sent to <strong>{email}</strong>. Check your inbox and change it after login.
            </p>
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:underline font-medium bg-indigo-50 px-3 py-2 rounded-lg"
              >
                <Mail className="w-3.5 h-3.5" />
                📬 View email preview (dev mode)
              </a>
            )}
            <button onClick={onClose} className="btn-primary w-full mt-5">Done</button>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
                <KeyRound className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-base font-bold text-slate-800">Forgot Password?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Enter your email and we'll send you a temporary password instantly.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email address</label>
                <input
                  className="input-base"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  id="forgot-email"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><Mail className="w-4 h-4" /> Send Temporary Password</>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error('Please enter your email and password');
      return;
    }
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));

  return (
    <>
      <div className="min-h-screen flex">
        {/* Left - branding */}
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
              Manage expenses<br />with confidence.
            </h2>
            <p className="text-white/75 text-lg leading-relaxed">
              Intelligent approval workflows, real-time insights, and fraud detection built for modern finance teams.
            </p>
          </div>
          <div className="relative grid grid-cols-3 gap-3">
            {[
              { num: '99%', label: 'Faster approvals' },
              { num: '0', label: 'Duplicate expense leakage' },
              { num: '24h', label: 'Average processing time' },
            ].map((s) => (
              <div key={s.label} className="bg-white/10 rounded-xl p-4 border border-white/20 text-center">
                <p className="text-white text-2xl font-bold">{s.num}</p>
                <p className="text-white/65 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right - Form */}
        <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-6 lg:hidden">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-white" />
                </div>
                <span className="text-slate-800 font-bold">ReimburseIQ</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-800 mb-1">Welcome back</h1>
              <p className="text-slate-500 text-sm">Sign in to your account to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
                <input
                  className="input-base"
                  type="email"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={set('email')}
                  autoComplete="email"
                  id="login-email"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-600">Password</label>
                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="text-xs text-indigo-600 hover:underline font-medium"
                    id="forgot-password-btn"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    className="input-base pr-10"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Your password"
                    value={form.password}
                    onChange={set('password')}
                    autoComplete="current-password"
                    id="login-password"
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

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2"
                id="login-submit-btn"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>Sign In <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              No account yet?{' '}
              <Link to="/register" className="text-indigo-600 font-semibold hover:underline">
                Create company
              </Link>
            </p>
          </div>
        </div>
      </div>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </>
  );
}
