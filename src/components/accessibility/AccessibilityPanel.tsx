/* eslint-disable react-hooks/set-state-in-effect, react/no-unescaped-entities, prefer-const, react-hooks/refs */
'use client';

import { useEffect, useState } from 'react';
import { useAccessibilityStore } from '@/stores/accessibilityStore';
import { FocusTrap } from '@/components/ui/FocusTrap';

interface AccessibilityPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AccessibilityPanel({
  isOpen,
  onClose,
}: AccessibilityPanelProps) {
  const [mounted, setMounted] = useState(false);
  const {
    captionsEnabled,
    highContrastEnabled,
    colorPalette,
    reducedMotionEnabled,
    fontSize,
    screenReaderEnabled,
    toggleCaptions,
    toggleHighContrast,
    setColorPalette,
    toggleReducedMotion,
    setFontSize,
    toggleScreenReader,
    hydrate,
  } = useAccessibilityStore();

  useEffect(() => {
    setMounted(true);
    hydrate();
  }, [hydrate]);

  if (!mounted || !isOpen) {
    return null;
  }

  const fontSizeClass = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
  }[fontSize];

  return (
    <FocusTrap isActive={isOpen} onEscape={onClose}>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur z-50 transition-opacity"
        onClick={onClose}
        role="presentation"
      />

      <div
        className={`fixed right-0 top-0 bottom-0 w-96 bg-gray-950 border-l border-white/10 overflow-y-auto z-50 shadow-2xl transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } ${fontSizeClass}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Accessibility settings"
        aria-modal="true"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">
              Accessibility Settings
            </h2>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white text-2xl leading-none"
              aria-label="Close accessibility panel"
            >
              ×
            </button>
          </div>

          {/* Settings */}
          <div className="space-y-6">
            {/* Live Captions */}
            <div className="border-b border-white/10 pb-6">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="captions-toggle" className="font-medium text-white">
                  Live Captions
                </label>
                <button
                  id="captions-toggle"
                  onClick={toggleCaptions}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    captionsEnabled ? 'bg-blue-600' : 'bg-gray-700'
                  }`}
                  role="switch"
                  aria-checked={captionsEnabled}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      captionsEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-sm text-white/60">
                Enable real-time speech-to-text captions
              </p>
            </div>

            {/* High Contrast */}
            <div className="border-b border-white/10 pb-6">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="contrast-toggle" className="font-medium text-white">
                  High Contrast Mode
                </label>
                <button
                  id="contrast-toggle"
                  onClick={toggleHighContrast}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    highContrastEnabled ? 'bg-blue-600' : 'bg-gray-700'
                  }`}
                  role="switch"
                  aria-checked={highContrastEnabled}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      highContrastEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-sm text-white/60">
                Increase contrast and visibility of UI elements
              </p>
            </div>

            {/* Color Palette */}
            <div className="border-b border-white/10 pb-6">
              <label htmlFor="palette-select" className="block font-medium text-white mb-3">
                Color Palette
              </label>
              <select
                id="palette-select"
                value={colorPalette}
                onChange={(e) =>
                  setColorPalette(
                    e.target.value as
                      | 'default'
                      | 'deuteranope'
                      | 'protanope'
                      | 'tritanope'
                      | 'universal'
                  )
                }
                className="w-full bg-gray-800 text-white border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="default">Default</option>
                <option value="deuteranope">Deuteranope</option>
                <option value="protanope">Protanope</option>
                <option value="tritanope">Tritanope</option>
                <option value="universal">Universal</option>
              </select>
              <p className="text-sm text-white/60 mt-2">
                Choose a palette optimized for different types of color blindness
              </p>
            </div>

            {/* Reduced Motion */}
            <div className="border-b border-white/10 pb-6">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="motion-toggle" className="font-medium text-white">
                  Reduce Motion
                </label>
                <button
                  id="motion-toggle"
                  onClick={toggleReducedMotion}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    reducedMotionEnabled ? 'bg-blue-600' : 'bg-gray-700'
                  }`}
                  role="switch"
                  aria-checked={reducedMotionEnabled}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      reducedMotionEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-sm text-white/60">
                Minimize animations and transitions
              </p>
            </div>

            {/* Font Size */}
            <div className="border-b border-white/10 pb-6">
              <label className="block font-medium text-white mb-3">
                Font Size
              </label>
              <div className="flex gap-3">
                {(['small', 'medium', 'large'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                      fontSize === size
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-white/70 hover:bg-gray-700'
                    }`}
                  >
                    {size.charAt(0).toUpperCase() + size.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Screen Reader */}
            <div className="pb-6">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="sr-toggle" className="font-medium text-white">
                  Screen Reader Announcements
                </label>
                <button
                  id="sr-toggle"
                  onClick={toggleScreenReader}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    screenReaderEnabled ? 'bg-blue-600' : 'bg-gray-700'
                  }`}
                  role="switch"
                  aria-checked={screenReaderEnabled}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      screenReaderEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-sm text-white/60">
                Enable announcements for important events
              </p>
            </div>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}
