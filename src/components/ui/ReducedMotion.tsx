/* eslint-disable react-hooks/set-state-in-effect, react/no-unescaped-entities, prefer-const, react-hooks/refs */
'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useAccessibilityStore } from '@/stores/accessibilityStore';

interface ReducedMotionProps {
  children: ReactNode;
  className?: string;
}

export function ReducedMotion({
  children,
  className = '',
}: ReducedMotionProps) {
  const [mounted, setMounted] = useState(false);
  const reducedMotionEnabled = useAccessibilityStore(
    (state) => state.reducedMotionEnabled
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  const shouldReduceMotion = !mounted
    ? false
    : reducedMotionEnabled || prefersReducedMotion;

  return (
    <div
      className={`${className} ${
        shouldReduceMotion ? '[animation:none!important] [transition:none!important]' : ''
      }`}
      style={
        shouldReduceMotion
          ? {
              animation: 'none !important',
              transition: 'none !important',
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
