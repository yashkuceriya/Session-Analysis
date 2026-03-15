import { create } from 'zustand';

export interface AccessibilityState {
  // State
  captionsEnabled: boolean;
  highContrastEnabled: boolean;
  colorPalette: 'default' | 'deuteranope' | 'protanope' | 'tritanope' | 'universal';
  reducedMotionEnabled: boolean;
  fontSize: 'small' | 'medium' | 'large';
  screenReaderEnabled: boolean;
  announcements: Array<{
    message: string;
    urgency: 'polite' | 'assertive';
    id: string;
  }>;

  // Actions
  toggleCaptions: () => void;
  toggleHighContrast: () => void;
  setColorPalette: (palette: 'default' | 'deuteranope' | 'protanope' | 'tritanope' | 'universal') => void;
  toggleReducedMotion: () => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  toggleScreenReader: () => void;
  announce: (message: string, urgency?: 'polite' | 'assertive') => void;
  clearAnnouncement: (id: string) => void;

  // Hydration
  hydrate: () => void;
}

const STORAGE_KEY = 'accessibilityPreferences';

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getInitialState() {
  return {
    captionsEnabled: false,
    highContrastEnabled: false,
    colorPalette: 'default' as const,
    reducedMotionEnabled: false,
    fontSize: 'medium' as const,
    screenReaderEnabled: false,
    announcements: [] as Array<{
      message: string;
      urgency: 'polite' | 'assertive';
      id: string;
    }>,
  };
}

export const useAccessibilityStore = create<AccessibilityState>((set, get) => ({
  ...getInitialState(),

  toggleCaptions: () => {
    set((state) => {
      const newState = { captionsEnabled: !state.captionsEnabled };
      syncToStorage(get() as AccessibilityState);
      return newState;
    });
  },

  toggleHighContrast: () => {
    set((state) => {
      const newState = { highContrastEnabled: !state.highContrastEnabled };
      syncToStorage(get() as AccessibilityState);
      return newState;
    });
  },

  setColorPalette: (palette: 'default' | 'deuteranope' | 'protanope' | 'tritanope' | 'universal') => {
    set({ colorPalette: palette });
    syncToStorage(get() as AccessibilityState);
  },

  toggleReducedMotion: () => {
    set((state) => {
      const newState = { reducedMotionEnabled: !state.reducedMotionEnabled };
      syncToStorage(get() as AccessibilityState);
      return newState;
    });
  },

  setFontSize: (size: 'small' | 'medium' | 'large') => {
    set({ fontSize: size });
    syncToStorage(get() as AccessibilityState);
  },

  toggleScreenReader: () => {
    set((state) => {
      const newState = { screenReaderEnabled: !state.screenReaderEnabled };
      syncToStorage(get() as AccessibilityState);
      return newState;
    });
  },

  announce: (message: string, urgency: 'polite' | 'assertive' = 'polite') => {
    const id = generateId();
    set((state) => ({
      announcements: [...state.announcements, { message, urgency, id }],
    }));

    // Auto-remove after 5 seconds
    setTimeout(() => {
      get().clearAnnouncement(id);
    }, 5000);
  },

  clearAnnouncement: (id: string) => {
    set((state) => ({
      announcements: state.announcements.filter((a) => a.id !== id),
    }));
  },

  hydrate: () => {
    if (typeof localStorage === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        set({
          captionsEnabled: parsed.captionsEnabled ?? false,
          highContrastEnabled: parsed.highContrastEnabled ?? false,
          colorPalette: parsed.colorPalette ?? 'default',
          reducedMotionEnabled: parsed.reducedMotionEnabled ?? false,
          fontSize: parsed.fontSize ?? 'medium',
          screenReaderEnabled: parsed.screenReaderEnabled ?? false,
        });
      }
    } catch (error) {
      console.warn('Failed to hydrate accessibility preferences', error);
    }
  },
}));

function syncToStorage(state: AccessibilityState) {
  if (typeof localStorage === 'undefined') return;

  try {
    const toStore = {
      captionsEnabled: state.captionsEnabled,
      highContrastEnabled: state.highContrastEnabled,
      colorPalette: state.colorPalette,
      reducedMotionEnabled: state.reducedMotionEnabled,
      fontSize: state.fontSize,
      screenReaderEnabled: state.screenReaderEnabled,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch (error) {
    console.warn('Failed to sync accessibility preferences to storage', error);
  }
}
