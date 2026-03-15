'use client';

export function SessionSkeleton() {
  return (
    <div className="h-screen bg-gray-950 flex flex-col">
      {/* Video area skeleton */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 p-2">
        <div className="bg-gray-900 rounded-xl animate-pulse flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-gray-800" />
        </div>
        <div className="bg-gray-900 rounded-xl animate-pulse flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-gray-800" />
        </div>
      </div>
      {/* Loading text */}
      <div className="flex items-center justify-center gap-3 py-4">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-400 text-sm">Initializing AI analysis...</span>
      </div>
      {/* Controls skeleton */}
      <div className="h-16 flex items-center justify-center gap-4 px-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="w-12 h-12 rounded-full bg-gray-800 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
