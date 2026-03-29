import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';

// Layout
import AppLayout from './components/AppLayout.jsx';

// Pages
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SubmitExpensePage from './pages/SubmitExpensePage.jsx';
import ExpenseHistoryPage from './pages/ExpenseHistoryPage.jsx';
import AllExpensesPage from './pages/AllExpensesPage.jsx';
import ApprovalsPage from './pages/ApprovalsPage.jsx';
import AdminPage from './pages/AdminPage.jsx';

// Protected route wrapper
function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// Public route — redirects authenticated users to dashboard
function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontFamily: 'Inter, sans-serif', fontSize: '13px', borderRadius: '12px' },
          success: { iconTheme: { primary: '#4f46e5', secondary: '#fff' } },
        }}
      />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

        {/* Protected app routes */}
        <Route
          element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route
            path="/expenses/submit"
            element={
              <PrivateRoute roles={['EMPLOYEE', 'MANAGER', 'FINANCE', 'DIRECTOR', 'ADMIN']}>
                <SubmitExpensePage />
              </PrivateRoute>
            }
          />
          <Route path="/expenses/history" element={<ExpenseHistoryPage />} />
          <Route
            path="/expenses/all"
            element={
              <PrivateRoute roles={['ADMIN', 'MANAGER', 'FINANCE', 'DIRECTOR']}>
                <AllExpensesPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/approvals"
            element={
              <PrivateRoute roles={['MANAGER', 'FINANCE', 'DIRECTOR', 'ADMIN']}>
                <ApprovalsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <PrivateRoute roles={['ADMIN']}>
                <AdminPage />
              </PrivateRoute>
            }
          />
        </Route>

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}