'use client';

import React, { useState, useCallback } from 'react';

interface BackgroundOption {
  id: string;
  label: string;
  type: 'none' | 'blur' | 'image';
  imageUrl?: string;
  color?: string;
}

const PRESET_BACKGROUNDS: BackgroundOption[] = [
  {
    id: 'none',
    label: 'None',
    type: 'none',
    color: 'bg-gray-700',
  },
  {
    id: 'blur',
    label: 'Blur',
    type: 'blur',
    color: 'bg-blue-600',
  },
  {
    id: 'gradient-1',
    label: 'Gradient 1',
    type: 'image',
    imageUrl: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'bg-gradient-to-br from-indigo-600 to-purple-600',
  },
  {
    id: 'gradient-2',
    label: 'Gradient 2',
    type: 'image',
    imageUrl: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    color: 'bg-gradient-to-br from-pink-500 to-red-600',
  },
  {
    id: 'gradient-3',
    label: 'Gradient 3',
    type: 'image',
    imageUrl: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    color: 'bg-gradient-to-br from-blue-500 to-cyan-400',
  },
  {
    id: 'gradient-4',
    label: 'Gradient 4',
    type: 'image',
    imageUrl: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    color: 'bg-gradient-to-br from-green-500 to-teal-400',
  },
  {
    id: 'gradient-5',
    label: 'Gradient 5',
    type: 'image',
    imageUrl: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    color: 'bg-gradient-to-br from-pink-500 to-yellow-300',
  },
];

interface BackgroundPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mode: 'none' | 'blur' | 'image', background?: string) => void;
  currentMode: 'none' | 'blur' | 'image';
  blurStrength?: number;
  onBlurStrengthChange?: (strength: number) => void;
}

export function BackgroundPicker({
  isOpen,
  onClose,
  onSelect,
  currentMode,
  blurStrength = 10,
  onBlurStrengthChange,
}: BackgroundPickerProps) {
  const [selectedBlurStrength, setSelectedBlurStrength] = useState(blurStrength);

  const handleSelect = useCallback(
    (option: BackgroundOption) => {
      if (option.type === 'blur') {
        onSelect('blur');
        onBlurStrengthChange?.(selectedBlurStrength);
      } else if (option.type === 'image') {
        onSelect('image', option.imageUrl);
      } else {
        onSelect('none');
      }
    },
    [onSelect, selectedBlurStrength, onBlurStrengthChange],
  );

  const handleBlurStrengthChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      setSelectedBlurStrength(value);
      onBlurStrengthChange?.(value);
    },
    [onBlurStrengthChange],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md rounded-lg bg-gray-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            Background Effects
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Options Grid */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {PRESET_BACKGROUNDS.map((option) => (
            <button
              key={option.id}
              onClick={() => handleSelect(option)}
              className={`group relative flex flex-col items-center gap-2 rounded-lg p-3 transition-all ${
                currentMode === option.type &&
                (option.type === 'none' ||
                  (option.type === 'blur' && option.id === 'blur') ||
                  option.id.startsWith('gradient'))
                  ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900'
                  : 'hover:ring-2 hover:ring-gray-600 hover:ring-offset-2 hover:ring-offset-gray-900'
              }`}
            >
              {/* Preview */}
              <div
                className={`h-12 w-full rounded-md border-2 border-gray-700 transition-all ${option.color}`}
              />

              {/* Label */}
              <span className="text-xs font-medium text-gray-300">
                {option.label}
              </span>
            </button>
          ))}
        </div>

        {/* Blur Strength Slider */}
        {currentMode === 'blur' && (
          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Blur Strength
              </label>
              <span className="text-sm text-gray-400">{selectedBlurStrength}</span>
            </div>
            <input
              type="range"
              min="0"
              max="20"
              value={selectedBlurStrength}
              onChange={handleBlurStrengthChange}
              className="h-2 w-full cursor-pointer rounded-lg bg-gray-700 appearance-none accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Light</span>
              <span>Heavy</span>
            </div>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
        >
          Done
        </button>
      </div>
    </div>
  );
}
