import { useState, useMemo, useCallback } from 'react';
import type { User } from '../../types';
import { buildTimezoneOptions } from '../../utils/timezone';
import { useAutoSave } from '../../hooks/useAutoSave';
import SaveIndicator from '../SaveIndicator';
import { SectionHeader, SelectRow } from './shared';

const TIMEZONE_OPTIONS = buildTimezoneOptions();

const LANGUAGE_OPTIONS = [{ value: 'en', label: 'English' }];

const DATE_FORMAT_OPTIONS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
];

const TIME_FORMAT_OPTIONS = [
  { value: '12h', label: '12-hour (1:30 PM)' },
  { value: '24h', label: '24-hour (13:30)' },
];

const START_OF_WEEK_OPTIONS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
];

const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
];

interface Props {
  user: User;
  onProfileUpdate: (updates: Partial<User>) => Promise<void>;
}

export default function GeneralSettings({ user, onProfileUpdate }: Props) {
  const [language, setLanguage] = useState(user.language ?? 'en');
  const [dateFormat, setDateFormat] = useState(user.dateFormat ?? 'MM/DD/YYYY');
  const [timeFormat, setTimeFormat] = useState(user.timeFormat ?? '12h');
  const [startOfWeek, setStartOfWeek] = useState(String(user.startOfWeek ?? 0));
  const [timezone, setTimezone] = useState(user.timezone);
  const [theme, setTheme] = useState(user.theme);
  const [dailyGoal, setDailyGoal] = useState(user.dailyReviewGoal);

  const autoSaveValues = useMemo(
    () => ({ language, dateFormat, timeFormat, startOfWeek, timezone, theme, dailyGoal }),
    [language, dateFormat, timeFormat, startOfWeek, timezone, theme, dailyGoal],
  );

  const handleAutoSave = useCallback(
    async (values: typeof autoSaveValues) => {
      await onProfileUpdate({
        language: values.language,
        dateFormat: values.dateFormat,
        timeFormat: values.timeFormat,
        startOfWeek: parseInt(values.startOfWeek, 10),
        timezone: values.timezone,
        theme: values.theme,
        dailyReviewGoal: values.dailyGoal,
      });
    },
    [onProfileUpdate],
  );

  const { status, error } = useAutoSave({
    values: autoSaveValues,
    onSave: handleAutoSave,
    delay: 800,
  });

  function handleGoalChange(value: string) {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    setDailyGoal(Math.max(1, Math.min(50, num)));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionHeader icon="globe" title="General" />
        <SaveIndicator status={status} error={error} />
      </div>

      <div className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectRow
            label="Language"
            value={language}
            options={LANGUAGE_OPTIONS}
            onChange={setLanguage}
          />
          <SelectRow
            label="Date Format"
            value={dateFormat}
            options={DATE_FORMAT_OPTIONS}
            onChange={setDateFormat}
          />
          <SelectRow
            label="Time Format"
            value={timeFormat}
            options={TIME_FORMAT_OPTIONS}
            onChange={setTimeFormat}
          />
          <SelectRow
            label="Start of Week"
            value={startOfWeek}
            options={START_OF_WEEK_OPTIONS}
            onChange={setStartOfWeek}
          />
          <SelectRow
            label="Timezone"
            value={timezone}
            options={TIMEZONE_OPTIONS}
            onChange={setTimezone}
          />
          <SelectRow label="Theme" value={theme} options={THEME_OPTIONS} onChange={setTheme} />

          <label className="block">
            <span className="text-sm font-medium text-zinc-400">Daily Review Goal</span>
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDailyGoal((g) => Math.max(1, g - 1))}
                className="w-9 h-9 flex items-center justify-center bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 transition-colors"
              >
                -
              </button>
              <input
                type="number"
                value={dailyGoal}
                onChange={(e) => handleGoalChange(e.target.value)}
                min={1}
                max={50}
                className="w-16 px-2 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-100 text-center focus:outline-none focus:border-zinc-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setDailyGoal((g) => Math.min(50, g + 1))}
                className="w-9 h-9 flex items-center justify-center bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 transition-colors"
              >
                +
              </button>
              <span className="text-sm text-zinc-500">reviews / day</span>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
