import { useState, useMemo, useCallback, useEffect } from 'react';
import type { User } from '../../types';
import { useAutoSave } from '../../hooks/useAutoSave';
import { testPushNotification } from '../../api';
import {
  subscribeToPush,
  unsubscribeFromPush,
  isPushSubscribed,
  isPushSupported,
  getPushPermission,
} from '../../lib/push';
import SaveIndicator from '../SaveIndicator';
import { SectionHeader, ToggleRow } from './shared';

interface Props {
  user: User;
  onProfileUpdate: (updates: Partial<User>) => Promise<void>;
}

export default function NotificationSettings({ user, onProfileUpdate }: Props) {
  const [notifyDaily, setNotifyDaily] = useState(user.notifyDaily);
  const [notifyWeekly, setNotifyWeekly] = useState(user.notifyWeekly);
  const [notifyReviewDue, setNotifyReviewDue] = useState(user.notifyReviewDue);
  const [notifyStreak, setNotifyStreak] = useState(user.notifyStreak);
  const [notifyAiComplete, setNotifyAiComplete] = useState(user.notifyAiComplete);
  const [notifyTaskAlerts, setNotifyTaskAlerts] = useState(user.notifyTaskAlerts);

  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(
    'default',
  );
  const [pushLoading, setPushLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);

  useEffect(() => {
    setPushPermission(getPushPermission());
    isPushSubscribed().then(setPushEnabled);
  }, []);

  const handlePushToggle = useCallback(async (enabled: boolean) => {
    setPushLoading(true);
    try {
      if (enabled) {
        const success = await subscribeToPush();
        setPushEnabled(success);
        setPushPermission(getPushPermission());
      } else {
        await unsubscribeFromPush();
        setPushEnabled(false);
      }
    } finally {
      setPushLoading(false);
    }
  }, []);

  const handleTestPush = useCallback(async () => {
    setTestSending(true);
    try {
      await testPushNotification();
    } finally {
      setTestSending(false);
    }
  }, []);

  const autoSaveValues = useMemo(
    () => ({
      notifyDaily,
      notifyWeekly,
      notifyReviewDue,
      notifyStreak,
      notifyAiComplete,
      notifyTaskAlerts,
    }),
    [notifyDaily, notifyWeekly, notifyReviewDue, notifyStreak, notifyAiComplete, notifyTaskAlerts],
  );

  const handleAutoSave = useCallback(
    async (values: typeof autoSaveValues) => {
      await onProfileUpdate(values);
    },
    [onProfileUpdate],
  );

  const { status, error } = useAutoSave({
    values: autoSaveValues,
    onSave: handleAutoSave,
    delay: 800,
  });

  const supported = isPushSupported();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionHeader icon="bell" title="Notifications" />
        <SaveIndicator status={status} error={error} />
      </div>

      {/* Browser Push */}
      <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-3">
        <h3 className="text-sm font-medium text-zinc-300">Browser Push</h3>
        {!supported ? (
          <p className="text-sm text-zinc-500">
            Push notifications are not supported in this browser.
          </p>
        ) : pushPermission === 'denied' ? (
          <p className="text-sm text-red-400">
            Notifications blocked. Enable them in your browser settings.
          </p>
        ) : (
          <>
            <ToggleRow
              label="Enable push notifications"
              description="Receive alerts even when this tab is closed"
              checked={pushEnabled}
              onChange={handlePushToggle}
              disabled={pushLoading}
            />
            {pushEnabled && (
              <button
                onClick={handleTestPush}
                disabled={testSending}
                className="text-sm text-blue-400 hover:text-blue-300 disabled:text-zinc-600"
              >
                {testSending ? 'Sending...' : 'Send test notification'}
              </button>
            )}
          </>
        )}
      </div>

      {/* What to notify */}
      <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-3">
        <h3 className="text-sm font-medium text-zinc-300">What to notify</h3>
        <ToggleRow
          label="Daily briefing"
          description="Morning coaching message with your due reviews"
          checked={notifyDaily}
          onChange={setNotifyDaily}
        />
        <div className="border-t border-zinc-800" />
        <ToggleRow
          label="Weekly insight"
          description="Weekly analysis of your weakest topic"
          checked={notifyWeekly}
          onChange={setNotifyWeekly}
        />
        <div className="border-t border-zinc-800" />
        <ToggleRow
          label="Reviews due"
          description="Alert when tasks are due for review"
          checked={notifyReviewDue}
          onChange={setNotifyReviewDue}
        />
        <div className="border-t border-zinc-800" />
        <ToggleRow
          label="Streak milestones"
          description="Celebrate when you hit review streaks"
          checked={notifyStreak}
          onChange={setNotifyStreak}
        />
        <div className="border-t border-zinc-800" />
        <ToggleRow
          label="AI evaluation complete"
          description="Notify when AI finishes scoring your answer"
          checked={notifyAiComplete}
          onChange={setNotifyAiComplete}
        />
        <div className="border-t border-zinc-800" />
        <ToggleRow
          label="Task alerts"
          description="Custom reminders you set on individual tasks"
          checked={notifyTaskAlerts}
          onChange={setNotifyTaskAlerts}
        />
      </div>
    </div>
  );
}
