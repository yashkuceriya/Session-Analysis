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
  small: { width: 180, height: 135 },
  medium: { width: 260, height: 195 },
  large: { width: 340, height: 255 },
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
      const margin = 20;
      const bottomOffset = 100;
      const w = currentSize.width;
      const h = currentSize.height;

      switch (corner) {
        case 'bottom-right':
          return { x: window.innerWidth - w - margin, y: window.innerHeight - h - margin - bottomOffset };
        case 'bottom-left':
          return { x: margin, y: window.innerHeight - h - margin - bottomOffset };
        case 'top-right':
          return { x: window.innerWidth - w - margin, y: margin + 60 };
        case 'top-left':
          return { x: margin, y: margin + 60 };
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
      const newCorner = getCornerPosition(position.x, position.y);
      const cornerCoords = getCornerCoordinates(newCorner);
      setCorner(newCorner);

      const startPos = { ...position };
      const startTime = Date.now();
      const duration = 350;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        // Ease-out cubic
        const ease = 1 - Math.pow(1 - t, 3);

        setPosition({
          x: startPos.x + (cornerCoords.x - startPos.x) * ease,
          y: startPos.y + (cornerCoords.y - startPos.y) * ease,
        });

        if (t < 1) requestAnimationFrame(animate);
      };

      animate();
    }, [isDragging, position, getCornerPosition, getCornerCoordinates]);

    const handleTouchEnd = useCallback(() => {
      handleMouseUp();
    }, [handleMouseUp]);

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
      if (eyeContactScore === undefined) return 'bg-gray-400';
      if (eyeContactScore > 0.6) return 'bg-emerald-400';
      if (eyeContactScore > 0.3) return 'bg-amber-400';
      return 'bg-red-400';
    };

    const getGlowColor = () => {
      if (eyeContactScore === undefined) return 'rgba(156, 163, 175, 0.08)';
      if (eyeContactScore > 0.6) return 'rgba(52, 211, 153, 0.12)';
      if (eyeContactScore > 0.3) return 'rgba(251, 191, 36, 0.10)';
      return 'rgba(248, 113, 113, 0.10)';
    };

    useEffect(() => {
      const update = () => {
        const coords = getCornerCoordinates('bottom-right');
        setPosition(coords);
      };
      const raf = requestAnimationFrame(update);
      return () => cancelAnimationFrame(raf);
    }, [getCornerCoordinates]);

    useEffect(() => {
      const el = videoRef.current;
      if (!el || !stream) return;
      if (el.srcObject !== stream) el.srcObject = stream;
      if (el.paused) el.play().catch(() => {});
    }, [stream, videoRef]);

    return (
      <div
        ref={containerRef}
        className={`fixed z-30 overflow-hidden transition-all ${
          isDragging ? 'cursor-grabbing scale-[1.03]' : 'cursor-grab hover:scale-[1.02]'
        }`}
        style={{
          width: `${currentSize.width}px`,
          height: `${currentSize.height}px`,
          left: `${position.x}px`,
          top: `${position.y}px`,
          borderRadius: '24px',
          // Premium shadow: deep shadow + subtle colored glow based on attention
          boxShadow: `
            0 25px 60px -10px rgba(0, 0, 0, 0.6),
            0 10px 30px -5px rgba(0, 0, 0, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.12),
            0 0 40px ${getGlowColor()}
          `,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.5s ease',
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={handleDoubleClick}
      >
        {/* Video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ borderRadius: '24px' }}
        />

        {/* Subtle inner border glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          borderRadius: '24px',
          boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.15), inset 0 0 40px rgba(0, 0, 0, 0.2)',
        }} />

        {/* Bottom gradient for name readability */}
        <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none" style={{
          borderRadius: '0 0 24px 24px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
        }} />

        {/* Name badge — bottom-left, minimal */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 z-10">
          <span className="text-white text-xs font-semibold drop-shadow-lg">{name}</span>
          {isMuted && (
            <div className="w-5 h-5 rounded-full bg-red-500/90 flex items-center justify-center backdrop-blur-sm">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
              </svg>
            </div>
          )}
        </div>

        {/* Attention indicator — top-right, subtle glow dot */}
        <div className="absolute top-3 right-3 z-10">
          <div className={`w-3 h-3 rounded-full ${getAttentionDot()} transition-colors duration-700`}
            style={{
              boxShadow: eyeContactScore !== undefined && eyeContactScore > 0.6
                ? '0 0 8px rgba(52, 211, 153, 0.6)'
                : eyeContactScore !== undefined && eyeContactScore > 0.3
                  ? '0 0 8px rgba(251, 191, 36, 0.5)'
                  : 'none',
            }}
          />
        </div>

        {/* Drag hint */}
        {!isDragging && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-all duration-300 bg-black/40 backdrop-blur-[2px]"
            style={{ borderRadius: '24px' }}
          >
            <div className="text-center">
              <span className="text-white/90 text-xs font-medium block">Drag to move</span>
              <span className="text-white/60 text-[10px] block mt-0.5">Double-click to resize</span>
            </div>
          </div>
        )}
      </div>
    );
  }
);
