import { useState, useMemo, useCallback } from 'react';
import type { User } from '../../types';
import { useAutoSave } from '../../hooks/useAutoSave';
import SaveIndicator from '../SaveIndicator';
import { SectionHeader, ToggleRow } from './shared';

interface Props {
  user: User;
  onProfileUpdate: (updates: Partial<User>) => Promise<void>;
}

export default function NotificationSettings({ user, onProfileUpdate }: Props) {
  const [notifyDaily, setNotifyDaily] = useState(user.notifyDaily);
  const [notifyWeekly, setNotifyWeekly] = useState(user.notifyWeekly);

  const autoSaveValues = useMemo(
    () => ({ notifyDaily, notifyWeekly }),
    [notifyDaily, notifyWeekly],
  );

  const handleAutoSave = useCallback(
    async (values: typeof autoSaveValues) => {
      await onProfileUpdate({ notifyDaily: values.notifyDaily, notifyWeekly: values.notifyWeekly });
    },
    [onProfileUpdate],
  );

  const { status, error } = useAutoSave({
    values: autoSaveValues,
    onSave: handleAutoSave,
    delay: 800,
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionHeader icon="bell" title="Notifications" />
        <SaveIndicator status={status} error={error} />
      </div>

      <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-3">
        <ToggleRow
          label="Daily briefing"
          description="Get a morning coaching message with your due reviews"
          checked={notifyDaily}
          onChange={setNotifyDaily}
        />
        <div className="border-t border-zinc-800" />
        <ToggleRow
          label="Weekly insight"
          description="Weekly analysis of your weakest topic with focus suggestions"
          checked={notifyWeekly}
          onChange={setNotifyWeekly}
        />
      </div>
    </div>
  );
}
