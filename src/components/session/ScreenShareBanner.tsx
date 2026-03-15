'use client';

interface ScreenShareBannerProps {
  isSharing: boolean;
  onStopSharing: () => void;
}

export function ScreenShareBanner({ isSharing, onStopSharing }: ScreenShareBannerProps) {
  if (!isSharing) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 bg-red-900/80 backdrop-blur-sm py-3 px-4 flex items-center justify-center gap-4 z-40 transition-transform duration-300"
      style={{
        transform: isSharing ? 'translateY(0)' : 'translateY(-100%)',
      }}
    >
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
        <span className="text-white font-medium text-sm">
          You are sharing your screen
        </span>
      </div>

      <button
        onClick={onStopSharing}
        className="px-4 py-1 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        Stop Sharing
      </button>
    </div>
  );
}
