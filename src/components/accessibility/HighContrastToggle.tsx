/* eslint-disable react-hooks/set-state-in-effect, react/no-unescaped-entities, prefer-const, react-hooks/refs */
'use client';

import { useEffect, useState } from 'react';

interface HighContrastToggleProps {
  className?: string;
}

export function HighContrastToggle({
  className = '',
}: HighContrastToggleProps) {
  const [isEnabled, setIsEnabled] = useState(false);

  // Apply high contrast styles to document body
  const applyHighContrast = (enabled: boolean) => {
    if (typeof document === 'undefined') return;

    if (enabled) {
      document.body.classList.add('high-contrast');

      // Add global styles
      let styleEl = document.getElementById('high-contrast-styles');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'high-contrast-styles';
        styleEl.textContent = `
          .high-contrast,
          .high-contrast * {
            color: #ffffff !important;
            background-color: #000000 !important;
            border-color: #ffffff !important;
          }

          .high-contrast a {
            color: #ffffff !important;
            text-decoration: underline !important;
          }

          .high-contrast button,
          .high-contrast input,
          .high-contrast select,
          .high-contrast textarea {
            border: 2px solid #ffffff !important;
            color: #ffffff !important;
            background-color: #000000 !important;
          }

          .high-contrast button:hover {
            background-color: #ffffff !important;
            color: #000000 !important;
          }

          .high-contrast *:focus {
            outline: 3px solid #ffffff !important;
            outline-offset: 2px !important;
          }

          .high-contrast img {
            border: 2px solid #ffffff !important;
          }

          .high-contrast code,
          .high-contrast pre {
            background-color: #1a1a1a !important;
            border: 1px solid #ffffff !important;
          }
        `;
        document.head.appendChild(styleEl);
      }
    } else {
      document.body.classList.remove('high-contrast');
      const styleEl = document.getElementById('high-contrast-styles');
      if (styleEl) {
        styleEl.remove();
      }
    }
  };

  // Load preference from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('highContrast');
    const enabled = stored === 'true';
    setIsEnabled(enabled);
    applyHighContrast(enabled);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    localStorage.setItem('highContrast', String(newState));
    applyHighContrast(newState);
  };

  return (
    <button
      onClick={toggle}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
        isEnabled
          ? 'bg-white text-black hover:bg-gray-200'
          : 'bg-gray-200 text-black hover:bg-gray-300'
      } ${className}`}
      aria-pressed={isEnabled}
      title={isEnabled ? 'High contrast enabled' : 'Enable high contrast'}
    >
      {isEnabled ? 'High Contrast: ON' : 'High Contrast: OFF'}
    </button>
  );
}
