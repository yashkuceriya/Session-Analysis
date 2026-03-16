'use client';

import { forwardRef, useRef, useState, useCallback, RefObject, useEffect } from 'react';

interface FloatingSelfViewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  stream?: MediaStream | null;
  name: string;
  isMuted?: boolean;
  eyeContactScore?: number;
}

type SizePreset = 'small' | 'medium' | 'large';
type CornerPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

const SIZE_PRESETS = {
  small: { width: 160, height: 120 },
  medium: { width: 240, height: 180 },
  large: { width: 320, height: 240 },
};

export const FloatingSelfView = forwardRef<HTMLDivElement, FloatingSelfViewProps>(
  function FloatingSelfView({ videoRef, stream, name, isMuted = false, eyeContactScore }, ref) {
    const [sizePreset, setSizePreset] = useState<SizePreset>('small');
    const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [corner, setCorner] = useState<CornerPosition>('bottom-right');
    const [isDragging, setIsDragging] = useState(false);
    const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const currentSize = SIZE_PRESETS[sizePreset];

    const getCornerPosition = useCallback((x: number, y: number): CornerPosition => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      if (x > centerX && y > centerY) return 'bottom-right';
      if (x < centerX && y > centerY) return 'bottom-left';
      if (x > centerX && y < centerY) return 'top-right';
      return 'top-left';
    }, []);

    const getCornerCoordinates = useCallback((corner: CornerPosition): { x: number; y: number } => {
      const margin = 16;
      const bottomOffset = 80; // 80px for controls bar
      const w = currentSize.width;
      const h = currentSize.height;

      switch (corner) {
        case 'bottom-right':
          return { x: window.innerWidth - w - margin, y: window.innerHeight - h - margin - bottomOffset };
        case 'bottom-left':
          return { x: margin, y: window.innerHeight - h - margin - bottomOffset };
        case 'top-right':
          return { x: window.innerWidth - w - margin, y: margin };
        case 'top-left':
          return { x: margin, y: margin };
      }
    }, [currentSize]);

    const handleMouseDown = (e: React.MouseEvent) => {
      setIsDragging(true);
      dragOffsetRef.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    };

    const handleTouchStart = (e: React.TouchEvent) => {
      const touch = e.touches[0];
      setIsDragging(true);
      dragOffsetRef.current = {
        x: touch.clientX - position.x,
        y: touch.clientY - position.y,
      };
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragOffsetRef.current.x,
        y: e.clientY - dragOffsetRef.current.y,
      });
    }, [isDragging]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - dragOffsetRef.current.x,
        y: touch.clientY - dragOffsetRef.current.y,
      });
    }, [isDragging]);

    const handleMouseUp = useCallback(() => {
      if (!isDragging) return;
      setIsDragging(false);

      // Snap to nearest corner
      const newCorner = getCornerPosition(position.x, position.y);
      const cornerCoords = getCornerCoordinates(newCorner);
      setCorner(newCorner);

      // Smooth animation to corner
      const startPos = { ...position };
      const startTime = Date.now();
      const duration = 300;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        setPosition({
          x: startPos.x + (cornerCoords.x - startPos.x) * progress,
          y: startPos.y + (cornerCoords.y - startPos.y) * progress,
        });

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      animate();
    }, [isDragging, position, getCornerPosition, getCornerCoordinates]);

    const handleTouchEnd = useCallback(() => {
      handleMouseUp();
    }, [handleMouseUp]);

    // Attach global mouse and touch move/up listeners for dragging
    useEffect(() => {
      if (!isDragging) return;

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      };
    }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

    const handleDoubleClick = () => {
      const nextSize: SizePreset = sizePreset === 'small' ? 'medium' : sizePreset === 'medium' ? 'large' : 'small';
      setSizePreset(nextSize);
    };

    const getAttentionDot = () => {
      if (eyeContactScore === undefined) return 'bg-gray-500';
      if (eyeContactScore > 0.6) return 'bg-green-500';
      if (eyeContactScore > 0.3) return 'bg-yellow-500';
      return 'bg-red-500';
    };

    // Initialize position to bottom-right on mount
    useEffect(() => {
      const update = () => {
        const coords = getCornerCoordinates('bottom-right');
        setPosition(coords);
      };
      // Use requestAnimationFrame to avoid synchronous setState in effect
      const raf = requestAnimationFrame(update);
      return () => cancelAnimationFrame(raf);
    }, [getCornerCoordinates]);

    // Attach stream directly for reliable playback
    useEffect(() => {
      const el = videoRef.current;
      if (!el || !stream) return;
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
      if (el.paused) {
        el.play().catch(() => {});
      }
    }, [stream, videoRef]);

    return (
      <div
        ref={containerRef}
        className={`fixed z-30 rounded-3xl overflow-hidden bg-gray-900 ring-1 ring-white/20 shadow-2xl transition-all duration-200 ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        } ${stream ? 'ring-white/30' : 'ring-white/10'}`}
        style={{
          width: `${currentSize.width}px`,
          height: `${currentSize.height}px`,
          left: `${position.x}px`,
          top: `${position.y}px`,
          boxShadow: stream
            ? '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(255, 255, 255, 0.1)'
            : '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={handleDoubleClick}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Name badge with enhanced styling */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1">
          <div className="bg-gradient-to-r from-black/80 to-black/60 backdrop-blur-lg px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 border border-white/15 shadow-lg">
            <span className="text-white font-semibold">{name}</span>
            {isMuted && (
              <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </div>
        </div>

        {/* Attention indicator with enhanced styling */}
        <div className="absolute top-3 right-3">
          <div className={`w-3.5 h-3.5 rounded-full ${getAttentionDot()} shadow-xl shadow-green-500/50 transition-colors duration-500 ring-2 ring-white/30`} />
        </div>

        {/* Drag hint with smooth animation */}
        {!isDragging && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-all duration-300 bg-gradient-to-br from-black/50 via-black/40 to-black/50 backdrop-blur">
            <div className="text-center">
              <span className="text-white text-xs font-semibold block">Drag to move</span>
              <span className="text-white/70 text-[10px] block mt-1">Double-click to resize</span>
            </div>
          </div>
        )}
      </div>
    );
  }
);
