'use client';

import React from 'react';

type SkeletonVariant = 'tile' | 'sidebar' | 'text';

interface SkeletonLoaderProps {
  variant: SkeletonVariant;
  count?: number;
}

const VARIANT_STYLES: Record<SkeletonVariant, string> = {
  tile: 'h-64 w-full rounded-lg',
  sidebar: 'h-48 w-full rounded-lg',
  text: 'h-4 w-full rounded',
};

const VARIANT_GAPS: Record<SkeletonVariant, string> = {
  tile: 'gap-4',
  sidebar: 'gap-3',
  text: 'gap-2',
};

export function SkeletonLoader({
  variant,
  count = 1,
}: SkeletonLoaderProps) {
  const items = Array.from({ length: count });
  const baseStyle = VARIANT_STYLES[variant];
  const gapClass = VARIANT_GAPS[variant];

  return (
    <div className={`flex flex-col ${gapClass}`}>
      {items.map((_, index) => (
        <div
          key={index}
          className={`animate-shimmer ${baseStyle} bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 bg-[length:200%_100%]`}
        >
          {/* Shimmer effect container */}
        </div>
      ))}

      {/* Shimmer animation */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}

/**
 * Variant-specific skeleton components for convenience
 */

export function TileSkeleton({ count = 1 }: { count?: number }) {
  return <SkeletonLoader variant="tile" count={count} />;
}

export function SidebarSkeleton({ count = 1 }: { count?: number }) {
  return <SkeletonLoader variant="sidebar" count={count} />;
}

export function TextSkeleton({ count = 3 }: { count?: number }) {
  return <SkeletonLoader variant="text" count={count} />;
}
