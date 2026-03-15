'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface UseAutoHideResult {
  isVisible: boolean;
  onMouseMove: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const HIDE_DELAY_MS = 4000;
const BOTTOM_TRIGGER_PX = 120;
const THROTTLE_MS = 200; // Don't process more than 5 mouse events/sec

export function useAutoHide(): UseAutoHideResult {
  const [isVisible, setIsVisible] = useState(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMoveRef = useRef<number>(0);
  const isHoveringRef = useRef(false);

  const scheduleHide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(true);
    timeoutRef.current = setTimeout(() => {
      // Don't hide if mouse is directly over the controls
      if (!isHoveringRef.current) {
        setIsVisible(false);
      }
    }, HIDE_DELAY_MS);
  }, []);

  const onMouseMove = useCallback((e?: MouseEvent) => {
    // Throttle mouse move events to reduce state updates
    const now = Date.now();
    if (now - lastMoveRef.current < THROTTLE_MS) return;
    lastMoveRef.current = now;

    const isNearBottom = !e || (window.innerHeight - (e.clientY ?? 0)) < BOTTOM_TRIGGER_PX;
    if (isNearBottom) {
      scheduleHide();
    }
  }, [scheduleHide]);

  const onMouseEnter = useCallback(() => {
    isHoveringRef.current = true;
    // Always show when hovering directly over controls
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsVisible(true);
  }, []);

  const onMouseLeave = useCallback(() => {
    isHoveringRef.current = false;
    // Start the hide timer when mouse leaves
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove as EventListener, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMouseMove as EventListener);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [onMouseMove]);

  return { isVisible, onMouseMove, onMouseEnter, onMouseLeave };
}
