'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode, useEffect } from 'react';
import { ScreenReaderAnnouncer } from '@/components/accessibility/ScreenReaderAnnouncer';
import { useAccessibilityStore } from '@/stores/accessibilityStore';

interface ProvidersProps {
  children: ReactNode;
}

function AccessibilityHydrator() {
  const hydrate = useAccessibilityStore((s) => s.hydrate);
  const highContrastEnabled = useAccessibilityStore((s) => s.highContrastEnabled);
  const reducedMotionEnabled = useAccessibilityStore((s) => s.reducedMotionEnabled);
  const fontSize = useAccessibilityStore((s) => s.fontSize);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Apply global accessibility classes to <html>
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('high-contrast', highContrastEnabled);
    html.classList.toggle('reduced-motion', reducedMotionEnabled);
    html.dataset.fontSize = fontSize;
  }, [highContrastEnabled, reducedMotionEnabled, fontSize]);

  return null;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <AccessibilityHydrator />
      <ScreenReaderAnnouncer />
      {children}
    </SessionProvider>
  );
}
