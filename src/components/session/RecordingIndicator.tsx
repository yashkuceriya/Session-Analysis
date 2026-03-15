'use client';

interface RecordingIndicatorProps {
  isRecording: boolean;
  duration: number;
  isPaused: boolean;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
}

export function RecordingIndicator({
  isRecording,
  duration,
  isPaused,
  onStop,
  onPause,
  onResume,
}: RecordingIndicatorProps) {
  if (!isRecording) {
    return null;
  }

  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="fixed top-4 left-4 z-35">
      <div className="bg-gray-900/80 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-3">
        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isPaused
                ? 'bg-orange-500 animate-none'
                : 'bg-red-600 animate-pulse'
            }`}
          />
          <span className="text-white font-semibold text-sm tracking-widest">
            {isPaused ? 'PAUSED' : 'REC'}
          </span>
        </div>

        {/* Duration */}
        <span className="text-gray-300 font-mono text-sm">{timeString}</span>

        {/* Controls */}
        <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-700">
          {isPaused ? (
            <button
              onClick={onResume}
              className="p-1 text-gray-300 hover:text-green-400 hover:bg-gray-800 rounded transition-colors"
              title="Resume recording"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          ) : (
            <button
              onClick={onPause}
              className="p-1 text-gray-300 hover:text-yellow-400 hover:bg-gray-800 rounded transition-colors"
              title="Pause recording"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            </button>
          )}

          <button
            onClick={onStop}
            className="p-1 text-gray-300 hover:text-red-400 hover:bg-gray-800 rounded transition-colors"
            title="Stop recording"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
