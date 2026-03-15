'use client';

import { useEffect } from 'react';
import { FocusTrap } from '@/components/ui/FocusTrap';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Array<{ key: string; description: string }>;
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Session Controls',
    shortcuts: [
      { key: 'M', description: 'Toggle microphone' },
      { key: 'V', description: 'Toggle video' },
      { key: 'A', description: 'Open analysis' },
      { key: 'G', description: 'Toggle gallery/speaker view' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { key: 'H', description: 'Toggle HUD' },
      { key: 'C', description: 'Toggle chat' },
      { key: 'Esc', description: 'Close panels' },
    ],
  },
  {
    title: 'Accessibility',
    shortcuts: [
      { key: '?', description: 'Show keyboard shortcuts' },
      { key: 'Alt + A', description: 'Open accessibility settings' },
    ],
  },
];

export function KeyboardShortcutsHelp({
  isOpen,
  onClose,
}: KeyboardShortcutsHelpProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <FocusTrap isActive={isOpen} onEscape={onClose}>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur z-50 flex items-center justify-center"
        onClick={onClose}
        role="presentation"
      />

      <div
        className="fixed inset-4 md:inset-auto md:max-w-2xl md:max-h-96 bg-gray-950 border border-white/10 rounded-xl shadow-2xl overflow-y-auto z-50"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Keyboard shortcuts"
        aria-modal="true"
      >
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Keyboard Shortcuts</h2>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white text-3xl leading-none"
              aria-label="Close shortcuts help"
            >
              ×
            </button>
          </div>

          {/* Shortcuts Grid */}
          <div className="space-y-8">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-lg font-semibold text-white mb-4">
                  {group.title}
                </h3>
                <div className="grid gap-3">
                  {group.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.key}
                      className="flex items-center gap-4 pb-3 border-b border-white/5 last:border-b-0"
                    >
                      <kbd className="px-3 py-1 bg-gray-800 border border-white/20 rounded-md font-mono text-sm font-semibold text-white min-w-fit">
                        {shortcut.key}
                      </kbd>
                      <span className="text-white/80">{shortcut.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-sm text-white/60">
              Press <kbd className="px-2 py-1 bg-gray-800 border border-white/20 rounded-md font-mono text-xs">Esc</kbd> to close
            </p>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}
