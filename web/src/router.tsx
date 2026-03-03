import { createBrowserRouter, Navigate } from 'react-router';
import { Suspense, lazy } from 'react';
import PublicLayout from './layouts/PublicLayout';
import ProtectedLayout from './layouts/ProtectedLayout';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './components/LoginPage';
import DeviceApproval from './components/DeviceApproval';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import Dashboard from './components/Dashboard';
import TaskList from './components/TaskList';
import AddTask from './components/AddTask';
import TopicProgress from './components/TopicProgress';
import Settings from './components/Settings';

const ReviewSession = lazy(() => import('./components/ReviewSession'));
const CalendarView = lazy(() => import('./components/CalendarView'));
const ExportView = lazy(() => import('./components/ExportView'));
const TemplateGallery = lazy(() => import('./components/TemplateGallery'));

function LazyFallback() {
  return (
    <div className="flex justify-center py-12">
      <div className="animate-spin h-6 w-6 border-2 border-zinc-500 border-t-zinc-200 rounded-full" />
    </div>
  );
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LazyFallback />}>{children}</Suspense>;
}

function RouteErrorFallback() {
  return (
    <ErrorBoundary>
      <></>
    </ErrorBoundary>
  );
}

export const router = createBrowserRouter([
  // Standalone public routes (render their own layout)
  { path: '/login', element: <LoginPage /> },
  { path: '/device-approve', element: <DeviceApproval /> },
  // Public routes with back-link layout
  {
    element: <PublicLayout />,
    children: [
      { path: '/privacy', element: <PrivacyPolicy /> },
      { path: '/terms', element: <TermsOfService /> },
    ],
  },
  // Protected routes
  {
    element: <ProtectedLayout />,
    errorElement: <RouteErrorFallback />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: '/tasks', element: <TaskList /> },
      { path: '/add', element: <AddTask /> },
      { path: '/review', element: <Lazy><ReviewSession /></Lazy> },
      { path: '/practice', element: <Lazy><ReviewSession /></Lazy> },
      { path: '/progress', element: <TopicProgress /> },
      { path: '/calendar', element: <Lazy><CalendarView /></Lazy> },
      { path: '/export', element: <Lazy><ExportView /></Lazy> },
      { path: '/settings', element: <Settings /> },
      { path: '/templates', element: <Lazy><TemplateGallery /></Lazy> },
      // Catch-all: redirect unknown paths to dashboard
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
  // Top-level catch-all for unmatched paths outside layouts
  { path: '*', element: <Navigate to="/" replace /> },
]);
