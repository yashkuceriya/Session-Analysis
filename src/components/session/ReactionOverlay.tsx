'use client';

import { useEffect, useState } from 'react';

interface ReactionOverlayProps {
  reactions: Array<{ id: string; emoji: string; timestamp: number }>;
}

interface AnimatingReaction {
  id: string;
  emoji: string;
  timestamp: number;
  animationId: string;
  offset: number;
}

export function ReactionOverlay({ reactions }: ReactionOverlayProps) {
  const [animatingReactions, setAnimatingReactions] = useState<AnimatingReaction[]>([]);

  useEffect(() => {
    if (reactions.length === 0) return;

    reactions.forEach((reaction) => {
      const offset = Math.random() * 40 - 20; // Random offset between -20px and +20px
      const animatingReaction: AnimatingReaction = {
        ...reaction,
        animationId: `${reaction.id}-${Math.random()}`,
        offset,
      };

      setAnimatingReactions((prev) => [...prev, animatingReaction]);

      // Remove after animation completes (3 seconds)
      const timeoutId = setTimeout(() => {
        setAnimatingReactions((prev) =>
          prev.filter((r) => r.animationId !== animatingReaction.animationId)
        );
      }, 3000);

      return () => clearTimeout(timeoutId);
    });
  }, [reactions]);

  return (
    <div className="fixed inset-0 pointer-events-none z-28 overflow-hidden">
      <style>{`
        @keyframes float-up-fade {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 1;
          }
          100% {
            transform: translateY(-120px) translateX(0);
            opacity: 0;
          }
        }
      `}</style>

      {animatingReactions.map((reaction) => (
        <div
          key={reaction.animationId}
          className="absolute bottom-1/4 left-1/2 text-4xl"
          style={{
            animation: 'float-up-fade 3s ease-out forwards',
            transform: `translateX(calc(-50% + ${reaction.offset}px))`,
          }}
        >
          {reaction.emoji}
        </div>
      ))}
    </div>
  );
}
