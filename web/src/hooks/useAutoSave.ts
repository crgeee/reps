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

function shallowEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function useAutoSave<T extends Record<string, unknown>>({
  values,
  onSave,
  delay = 600,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveResult {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const initialRef = useRef<T | null>(null);
  const prevRef = useRef<T>(values);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const generationRef = useRef(0);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Capture initial values on mount
  if (initialRef.current === null) {
    initialRef.current = values;
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
          clearTimeout(fadeTimerRef.current);
          fadeTimerRef.current = setTimeout(() => {
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
    if (shallowEqual(values, initialRef.current!)) {
      prevRef.current = values;
      return;
    }
    // Skip if values haven't changed from previous render
    if (shallowEqual(values, prevRef.current)) return;
    prevRef.current = values;

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      save(values);
    }, delay);

    return () => clearTimeout(timerRef.current);
  }, [values, delay, enabled, save]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(fadeTimerRef.current);
    };
  }, []);

  return { status, error };
}
