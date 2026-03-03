import { createBrowserRouter } from 'react-router';
import { Suspense, lazy } from 'react';
import PublicLayout from './layouts/PublicLayout';
import ProtectedLayout from './layouts/ProtectedLayout';
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

function ReviewSessionWrapper({ mode }: { mode: 'review' | 'practice' }) {
  return (
    <Suspense fallback={<LazyFallback />}>
      <ReviewSession dueTasks={[]} onComplete={() => {}} mode={mode} />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  // Public routes
  {
    element: <PublicLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/device-approve', element: <DeviceApproval /> },
      { path: '/privacy', element: <PrivacyPolicy /> },
      { path: '/terms', element: <TermsOfService /> },
    ],
  },
  // Protected routes
  {
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: '/tasks', element: <TaskList /> },
      { path: '/add', element: <AddTask /> },
      {
        path: '/review',
        element: <ReviewSessionWrapper mode="review" />,
      },
      {
        path: '/practice',
        element: <ReviewSessionWrapper mode="practice" />,
      },
      { path: '/progress', element: <TopicProgress /> },
      {
        path: '/calendar',
        element: (
          <Suspense fallback={<LazyFallback />}>
            <div className="space-y-4">
              <h1 className="text-lg font-bold tracking-tight">Calendar</h1>
              <CalendarView />
            </div>
          </Suspense>
        ),
      },
      {
        path: '/export',
        element: (
          <Suspense fallback={<LazyFallback />}>
            <ExportView />
          </Suspense>
        ),
      },
      {
        path: '/settings',
        element: <Settings />,
      },
      {
        path: '/templates',
        element: (
          <Suspense fallback={<LazyFallback />}>
            <TemplateGallery />
          </Suspense>
        ),
      },
    ],
  },
]);
