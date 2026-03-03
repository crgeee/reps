import { createBrowserRouter, Navigate, useRouteError, isRouteErrorResponse } from 'react-router';
import { Suspense, lazy } from 'react';
import PublicLayout from './layouts/PublicLayout';
import ProtectedLayout from './layouts/ProtectedLayout';
import LoginPage from './components/LoginPage';
import DeviceApproval from './components/DeviceApproval';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import Dashboard from './components/Dashboard';
import TaskList from './components/TaskList';

const AddTask = lazy(() => import('./components/AddTask'));
const ReviewSession = lazy(() => import('./components/ReviewSession'));
const TopicProgress = lazy(() => import('./components/TopicProgress'));
const CalendarView = lazy(() => import('./components/CalendarView'));
const ExportView = lazy(() => import('./components/ExportView'));
const Settings = lazy(() => import('./components/Settings'));
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
  const error = useRouteError();
  let message = 'Something went wrong.';
  if (isRouteErrorResponse(error)) {
    message = `${error.status} — ${error.statusText}`;
  } else if (error instanceof Error) {
    message = error.message;
  }
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-xl font-bold text-red-400">Error</h1>
        <p className="text-zinc-400">{message}</p>
        <a
          href="/"
          className="inline-block text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Go to dashboard
        </a>
      </div>
    </div>
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
      {
        path: '/add',
        element: (
          <Lazy>
            <AddTask />
          </Lazy>
        ),
      },
      {
        path: '/review',
        element: (
          <Lazy>
            <ReviewSession />
          </Lazy>
        ),
      },
      {
        path: '/practice',
        element: (
          <Lazy>
            <ReviewSession />
          </Lazy>
        ),
      },
      {
        path: '/progress',
        element: (
          <Lazy>
            <TopicProgress />
          </Lazy>
        ),
      },
      {
        path: '/calendar',
        element: (
          <Lazy>
            <CalendarView />
          </Lazy>
        ),
      },
      {
        path: '/export',
        element: (
          <Lazy>
            <ExportView />
          </Lazy>
        ),
      },
      {
        path: '/settings',
        element: (
          <Lazy>
            <Settings />
          </Lazy>
        ),
      },
      {
        path: '/templates',
        element: (
          <Lazy>
            <TemplateGallery />
          </Lazy>
        ),
      },
      // Catch-all: redirect unknown paths to dashboard
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
  // Top-level catch-all for unmatched paths outside layouts
  { path: '*', element: <Navigate to="/" replace /> },
]);
