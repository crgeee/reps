import { useEffect, useRef, useState, useCallback } from 'react';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions<T> {
  values: T;
  onSave: (values: T) => Promise<void>;
  delay?: number;
  enabled?: boolean;
}

interface UseAutoSaveResult {
  status: AutoSaveStatus;
  error: string | null;
}

export function useAutoSave<T>({
  values,
  onSave,
  delay = 600,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveResult {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const initialRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const generationRef = useRef(0);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const serialized = JSON.stringify(values);

  // Capture initial values on mount
  if (initialRef.current === null) {
    initialRef.current = serialized;
  }

  const save = useCallback(
    async (vals: T) => {
      const gen = ++generationRef.current;
      setStatus('saving');
      setError(null);
      try {
        await onSaveRef.current(vals);
        if (gen === generationRef.current) {
          setStatus('saved');
          setTimeout(() => {
            if (gen === generationRef.current) setStatus('idle');
          }, 2000);
        }
      } catch (err) {
        if (gen === generationRef.current) {
          setStatus('error');
          setError(err instanceof Error ? err.message : 'Failed to save');
        }
      }
    },
    [], // onSaveRef is stable
  );

  useEffect(() => {
    if (!enabled) return;
    // Skip if values haven't changed from initial
    if (serialized === initialRef.current) return;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      save(JSON.parse(serialized) as T);
    }, delay);

    return () => clearTimeout(timerRef.current);
  }, [serialized, delay, enabled, save]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return { status, error };
}
