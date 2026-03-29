import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import {
  LayoutDashboard, FileText, CheckSquare, Settings, LogOut,
  Receipt, Users, TrendingUp, AlertTriangle, ChevronRight, Wallet,
} from 'lucide-react';

const NAV_ITEMS = {
  EMPLOYEE: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/expenses/submit', icon: Receipt, label: 'Submit Expense' },
    { to: '/expenses/history', icon: FileText, label: 'My Expenses' },
  ],
  MANAGER: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/approvals', icon: CheckSquare, label: 'Approvals' },
    { to: '/expenses/history', icon: FileText, label: 'My Expenses' },
    { to: '/expenses/submit', icon: Receipt, label: 'Submit Expense' },
  ],
  FINANCE: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/approvals', icon: CheckSquare, label: 'Approvals' },
    { to: '/expenses/history', icon: FileText, label: 'My Expenses' },
  ],
  DIRECTOR: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/approvals', icon: CheckSquare, label: 'Approvals' },
    { to: '/expenses/history', icon: FileText, label: 'My Expenses' },
  ],
  ADMIN: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/approvals', icon: CheckSquare, label: 'Approvals' },
    { to: '/expenses/all', icon: TrendingUp, label: 'All Expenses' },
    { to: '/expenses/submit', icon: Receipt, label: 'Submit Expense' },
    { to: '/admin', icon: Settings, label: 'Admin Panel' },
  ],
};

const ROLE_BADGES = {
  ADMIN: 'bg-purple-100 text-purple-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  FINANCE: 'bg-teal-100 text-teal-700',
  DIRECTOR: 'bg-orange-100 text-orange-700',
  EMPLOYEE: 'bg-green-100 text-green-700',
};

export default function Sidebar({ mobile = false, onClose }) {
  const { user, logout, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();

  const navItems = NAV_ITEMS[user?.role] || NAV_ITEMS.EMPLOYEE;

  const handleLogout = async () => {
    onClose?.();
    await logout();
    navigate('/login');
  };

  return (
    <aside className={`flex flex-col h-full bg-white border-r border-slate-100 ${mobile ? 'w-full' : 'w-64'}`}>
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-200">
            <Wallet className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-800 leading-none">ReimburseIQ</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">{user?.companyId?.name || 'Company'}</p>
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ROLE_BADGES[user?.role]}`}>
              {user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest px-3 mb-2">Menu</p>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group
               ${isActive
                 ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                 : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
               }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`w-4.5 h-4.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600'}`} />
                {label}
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-slate-100">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all duration-150"
        >
          <LogOut className="w-4.5 h-4.5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
