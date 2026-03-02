import { useState, useCallback } from 'react';
import type { User } from '../types';
import { updateProfile } from '../api';
import GeneralSettings from './settings/GeneralSettings';
import NotificationSettings from './settings/NotificationSettings';
import AccountSettings from './settings/AccountSettings';
import AdminSettings from './settings/AdminSettings';

type SettingsTab = 'general' | 'notifications' | 'account' | 'admin';

const TABS: { id: SettingsTab; label: string; icon: JSX.Element; adminOnly?: boolean }[] = [
  {
    id: 'general',
    label: 'General',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A8.966 8.966 0 013 12c0-.778.099-1.533.284-2.253"
        />
      </svg>
    ),
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        />
      </svg>
    ),
  },
  {
    id: 'account',
    label: 'Account',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
        />
      </svg>
    ),
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
        />
      </svg>
    ),
    adminOnly: true,
  },
];

interface Props {
  user: User;
  onUserUpdate: (user: User) => void;
}

export default function Settings({ user, onUserUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [mobileView, setMobileView] = useState<SettingsTab | null>(null);

  const visibleTabs = TABS.filter((t) => !t.adminOnly || user.isAdmin);

  const handleProfileUpdate = useCallback(
    async (updates: Partial<User>) => {
      const updated = await updateProfile(updates);
      onUserUpdate(updated);
    },
    [onUserUpdate],
  );

  const currentTab = mobileView ?? activeTab;

  function renderTab() {
    switch (currentTab) {
      case 'general':
        return <GeneralSettings user={user} onProfileUpdate={handleProfileUpdate} />;
      case 'notifications':
        return <NotificationSettings user={user} onProfileUpdate={handleProfileUpdate} />;
      case 'account':
        return <AccountSettings user={user} onProfileUpdate={handleProfileUpdate} />;
      case 'admin':
        return user.isAdmin ? <AdminSettings user={user} /> : null;
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight mb-8">Settings</h1>

      {/* Desktop layout */}
      <div className="hidden md:flex gap-8">
        {/* Sidebar */}
        <nav className="w-48 flex-shrink-0 space-y-1">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSaveMessage(null);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                activeTab === tab.id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">{renderTab()}</div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden">
        {mobileView === null ? (
          <div className="space-y-1">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setMobileView(tab.id);
                  setSaveMessage(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-zinc-900/50 border border-zinc-800 rounded-xl text-left hover:bg-zinc-800/50 transition-colors"
              >
                {tab.icon}
                <span className="flex-1 text-sm font-medium text-zinc-200">{tab.label}</span>
                <svg
                  className="w-4 h-4 text-zinc-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <button
              onClick={() => setMobileView(null)}
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Settings
            </button>
            {renderTab()}
          </div>
        )}
      </div>
    </div>
  );
}
