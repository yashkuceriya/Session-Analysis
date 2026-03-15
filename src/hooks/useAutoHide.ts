'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface UseAutoHideResult {
  isVisible: boolean;
  onMouseMove: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const HIDE_DELAY_MS = 3000;
const BOTTOM_TRIGGER_PX = 100;

export function useAutoHide(): UseAutoHideResult {
  const [isVisible, setIsVisible] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scheduleHide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(true);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, HIDE_DELAY_MS);
  }, []);

  const onMouseMove = useCallback((e?: MouseEvent) => {
    const isNearBottom = !e || (window.innerHeight - (e.clientY ?? 0)) < BOTTOM_TRIGGER_PX;
    if (isNearBottom) {
      scheduleHide();
    }
  }, [scheduleHide]);

  const onMouseEnter = useCallback(() => {
    scheduleHide();
  }, [scheduleHide]);

  const onMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [onMouseMove]);

  return { isVisible, onMouseMove, onMouseEnter, onMouseLeave };
}
