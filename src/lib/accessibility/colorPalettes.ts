export interface ColorPalette {
  high: string;
  medium: string;
  low: string;
  critical: string;
  neutral: string;
}

// Standard green/yellow/red palette
export const defaultPalette: ColorPalette = {
  high: '#22c55e', // green-500
  medium: '#eab308', // yellow-500
  low: '#ef4444', // red-500
  critical: '#dc2626', // red-600
  neutral: '#6b7280', // gray-500
};

// Deuteranope (red-green colorblindness) - Blue/Orange/Purple safe
export const deuteranopePalette: ColorPalette = {
  high: '#3b82f6', // blue-500
  medium: '#f97316', // orange-500
  low: '#8b5cf6', // violet-500
  critical: '#6d28d9', // violet-700
  neutral: '#6b7280', // gray-500
};

// Protanope (red-green colorblindness) - Blue/Yellow/Magenta safe
export const protanopePalette: ColorPalette = {
  high: '#0ea5e9', // cyan-500
  medium: '#fbbf24', // amber-400
  low: '#ec4899', // pink-500
  critical: '#be185d', // pink-800
  neutral: '#6b7280', // gray-500
};

// Tritanope (blue-yellow colorblindness) - Red/Cyan/Grey safe
export const tritanopePalette: ColorPalette = {
  high: '#ef4444', // red-500
  medium: '#06b6d4', // cyan-500
  low: '#9ca3af', // gray-400
  critical: '#7f1d1d', // red-900
  neutral: '#d1d5db', // gray-300
};

// Universal palette that works for all types - Blue/Orange/Black with patterns
export const universalPalette: ColorPalette = {
  high: '#0ea5e9', // cyan-500
  medium: '#f97316', // orange-500
  low: '#1f2937', // gray-800
  critical: '#7f1d1d', // red-900
  neutral: '#9ca3af', // gray-400
};

const palettes: Record<string, ColorPalette> = {
  default: defaultPalette,
  deuteranope: deuteranopePalette,
  protanope: protanopePalette,
  tritanope: tritanopePalette,
  universal: universalPalette,
};

export function getCurrentPalette(): ColorPalette {
  if (typeof localStorage === 'undefined') {
    return defaultPalette;
  }

  const preference = localStorage.getItem('colorPalette') as
    | keyof typeof palettes
    | null;
  return preference && palettes[preference] ? palettes[preference] : defaultPalette;
}

export function getEngagementColor(
  score: number,
  palette: ColorPalette = getCurrentPalette()
): string {
  // Normalize score to 0-1
  const normalized = Math.max(0, Math.min(1, score));

  if (normalized >= 0.7) {
    return palette.high;
  } else if (normalized >= 0.5) {
    return palette.medium;
  } else if (normalized >= 0.3) {
    return palette.low;
  } else {
    return palette.critical;
  }
}

export function getStateColor(
  state: string,
  palette: ColorPalette = getCurrentPalette()
): string {
  const stateMap: Record<string, keyof ColorPalette> = {
    active: 'high',
    inactive: 'low',
    error: 'critical',
    warning: 'medium',
    success: 'high',
    neutral: 'neutral',
    critical: 'critical',
  };

  const key = (stateMap[state.toLowerCase()] || 'neutral') as keyof ColorPalette;
  return palette[key];
}
