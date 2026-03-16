'use client';

import { useEffect } from 'react';

interface KeyboardShortcutsMap {
  [key: string]: () => void;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
}

export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcutsMap,
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const getHandler = (key: string) => {
      const normalizedKey = key.length === 1 ? key.toLowerCase() : key;
      return shortcuts[key] ?? shortcuts[normalizedKey];
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts while the user is typing into an editable control.
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
      ) {
        return;
      }

      const handler = getHandler(e.key);

      if (handler) {
        e.preventDefault();
        handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts, enabled]);
}
