import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { LoginPage } from './pages/LoginPage';
import { Layout } from './pages/Layout';
import { DashboardPage } from './components/Dashboard/DashboardPage';
import { UsersPage } from './components/Users/UsersPage';
import { StreamsPage } from './components/Streams/StreamsPage';
import { lazy, Suspense } from 'react';

// Lazy load heavier pages
const VodPage = lazy(() => import('./components/VOD/VodPage').then(m => ({ default: m.VodPage })));
const SeriesPage = lazy(() => import('./components/VOD/SeriesPage').then(m => ({ default: m.SeriesPage })));
const EpgPage = lazy(() => import('./components/EPG/EpgPage').then(m => ({ default: m.EpgPage })));
const ReportsPage = lazy(() => import('./components/Reports/ReportsPage').then(m => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('./components/Settings/SettingsPage').then(m => ({ default: m.SettingsPage })));
const BouquetsPage = lazy(() => import('./components/Bouquets/BouquetsPage').then(m => ({ default: m.BouquetsPage })));
const ServersPage = lazy(() => import('./components/Servers/ServersPage').then(m => ({ default: m.ServersPage })));
const IpFilterPage = lazy(() => import('./components/Security/IpFilterPage').then(m => ({ default: m.IpFilterPage })));
const ResellersPage = lazy(() => import('./components/Resellers/ResellersPage'));
const PlansPage = lazy(() => import('./components/Subscriptions/PlansPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
  </div>
);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { background: '#1f2937', color: '#f9fafb', borderRadius: '12px' },
            success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } }
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="streams" element={<StreamsPage />} />
            <Route path="vod" element={<Suspense fallback={<PageLoader />}><VodPage /></Suspense>} />
            <Route path="series" element={<Suspense fallback={<PageLoader />}><SeriesPage /></Suspense>} />
            <Route path="epg" element={<Suspense fallback={<PageLoader />}><EpgPage /></Suspense>} />
            <Route path="reports" element={<Suspense fallback={<PageLoader />}><ReportsPage /></Suspense>} />
            <Route path="servers" element={<AdminRoute><Suspense fallback={<PageLoader />}><ServersPage /></Suspense></AdminRoute>} />
            <Route path="bouquets" element={<AdminRoute><Suspense fallback={<PageLoader />}><BouquetsPage /></Suspense></AdminRoute>} />
            <Route path="ip-filter" element={<AdminRoute><Suspense fallback={<PageLoader />}><IpFilterPage /></Suspense></AdminRoute>} />
            <Route path="resellers" element={<AdminRoute><Suspense fallback={<PageLoader />}><ResellersPage /></Suspense></AdminRoute>} />
            <Route path="plans" element={<AdminRoute><Suspense fallback={<PageLoader />}><PlansPage /></Suspense></AdminRoute>} />
            <Route path="settings" element={<AdminRoute><Suspense fallback={<PageLoader />}><SettingsPage /></Suspense></AdminRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
