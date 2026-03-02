import type React from 'react';

export function pillStyle(color: string | null): React.CSSProperties {
  return {
    backgroundColor: color ? `${color}33` : 'rgba(113, 113, 122, 0.2)',
    color: color ?? '#a1a1aa',
  };
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export const ICON_OPTIONS = ['', '📚', '💻', '🎯', '🧠', '📝', '🔬', '🎨', '⚡', '🏆', '📊', '🔧'];
