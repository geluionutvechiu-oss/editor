import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import AppShell from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import PlansPage from './pages/PlansPage';
import ServersPage from './pages/ServersPage';
import StreamsPage from './pages/StreamsPage';
import ResellersPage from './pages/ResellersPage';
import InvoicesPage from './pages/InvoicesPage';
import SecurityPage from './pages/SecurityPage';
import NotificationsPage from './pages/NotificationsPage';
import SettingsPage from './pages/SettingsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import MoviesPage from './pages/MoviesPage';
import SeriesPage from './pages/SeriesPage';
import RadioPage from './pages/RadioPage';
import CategoriesPage from './pages/CategoriesPage';
import EpgPage from './pages/EpgPage';
import LiveConnectionsPage from './pages/LiveConnectionsPage';
import TranscodingPage from './pages/TranscodingPage';
import DevicesPage from './pages/DevicesPage';
import TicketsPage from './pages/TicketsPage';
import CreditsPage from './pages/CreditsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <ProtectedRoute><AppShell /></ProtectedRoute>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'connections', element: <LiveConnectionsPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'plans', element: <PlansPage /> },
      { path: 'resellers', element: <ResellersPage /> },
      { path: 'invoices', element: <InvoicesPage /> },
      { path: 'credits', element: <CreditsPage /> },
      { path: 'streams', element: <StreamsPage /> },
      { path: 'movies', element: <MoviesPage /> },
      { path: 'series', element: <SeriesPage /> },
      { path: 'radio', element: <RadioPage /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'epg', element: <EpgPage /> },
      { path: 'servers', element: <ServersPage /> },
      { path: 'transcoding', element: <TranscodingPage /> },
      { path: 'devices/mag', element: <DevicesPage /> },
      { path: 'devices/enigma2', element: <DevicesPage /> },
      { path: 'security', element: <SecurityPage /> },
      { path: 'tickets', element: <TicketsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'audit-logs', element: <AuditLogsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
