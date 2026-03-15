'use client';

import React, { useState, useRef, useEffect } from 'react';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

export function InviteModal({ isOpen, onClose, roomId }: InviteModalProps) {
  const [copied, setCopied] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/join/${roomId}` : '';

  // Generate simple QR code using canvas
  useEffect(() => {
    if (!isOpen || !qrCanvasRef.current) return;

    const canvas = qrCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = 200;
    canvas.height = 200;

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 200, 200);

    // Draw a simple text-based QR placeholder
    // In production, use a library like 'qrcode.react' or 'qr-code'
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Room Code:', 100, 60);
    ctx.font = 'bold 24px monospace';
    ctx.fillText(roomId, 100, 100);
    ctx.font = '10px Arial';
    ctx.fillText('Scan or use code', 100, 135);
    ctx.fillText('to join session', 100, 150);
  }, [isOpen, roomId]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: create a temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = joinUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <h2 className="text-xl font-semibold text-white">Invite Student</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Room Code */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
                Room Code
              </label>
              <div className="text-4xl font-mono font-bold text-center text-blue-400 bg-gray-800 rounded-lg p-4 select-all">
                {roomId}
              </div>
              <p className="text-xs text-gray-500 text-center mt-2">
                Share this code verbally for quick access
              </p>
            </div>

            {/* Join URL */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
                Join Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinUrl}
                  readOnly
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-4 py-2 rounded-lg transition-colors font-medium text-sm flex items-center gap-2 ${
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  {copied ? (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* QR Code Placeholder */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider block mb-2">
                QR Code
              </label>
              <div className="flex justify-center">
                <canvas
                  ref={qrCanvasRef}
                  className="border border-gray-700 rounded-lg"
                />
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-gray-800 rounded-lg p-3 text-sm text-gray-300">
              <p className="font-medium text-gray-200 mb-1">How to share:</p>
              <ul className="space-y-1 text-xs text-gray-400">
                <li>1. Copy the link above and send to student</li>
                <li>2. Or share the room code verbally</li>
                <li>3. Student opens /join/[roomId] and enters their name</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-700 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
