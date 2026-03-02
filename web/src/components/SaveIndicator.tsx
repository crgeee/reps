import { Check } from 'lucide-react';
import type { AutoSaveStatus } from '../hooks/useAutoSave';

interface SaveIndicatorProps {
  status: AutoSaveStatus;
  error: string | null;
}

export default function SaveIndicator({ status, error }: SaveIndicatorProps) {
  if (status === 'idle') return null;

  if (status === 'saving') {
    return <span className="text-xs text-zinc-500 animate-pulse">Saving...</span>;
  }

  if (status === 'saved') {
    return (
      <span className="text-xs text-green-400 flex items-center gap-1">
        <Check className="w-3 h-3" />
        Saved
      </span>
    );
  }

  if (status === 'error') {
    return <span className="text-xs text-red-400">{error ?? 'Failed to save'}</span>;
  }

  return null;
}
