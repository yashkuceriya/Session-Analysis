'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorType: 'mediapipe' | 'audio' | 'general';
}

export class SessionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorType: 'general' };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    let errorType: State['errorType'] = 'general';
    const msg = error.message.toLowerCase();
    if (msg.includes('mediapipe') || msg.includes('face') || msg.includes('wasm') || msg.includes('gpu')) {
      errorType = 'mediapipe';
    } else if (msg.includes('audio') || msg.includes('microphone') || msg.includes('audiocontext')) {
      errorType = 'audio';
    }
    return { hasError: true, error, errorType };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[SessionErrorBoundary]', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorType: 'general' });
  };

  render() {
    if (this.state.hasError) {
      const { errorType, error } = this.state;

      return (
        <div className="h-screen bg-gray-950 flex items-center justify-center session-dark">
          <div className="text-center max-w-lg p-8">
            <div className="text-5xl mb-4">
              {errorType === 'mediapipe' ? '🧠' : errorType === 'audio' ? '🎤' : '⚠️'}
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">
              {errorType === 'mediapipe'
                ? 'Face Detection Unavailable'
                : errorType === 'audio'
                ? 'Audio Analysis Error'
                : 'Session Error'}
            </h2>
            <p className="text-gray-400 mb-4">
              {errorType === 'mediapipe'
                ? 'The face detection model failed to load. This may be due to GPU unavailability or network issues. The session can continue with audio-only metrics.'
                : errorType === 'audio'
                ? 'Audio analysis encountered an error. Please check your microphone permissions and try again.'
                : 'An unexpected error occurred during the session.'}
            </p>
            {error && (
              <p className="text-gray-600 text-xs mb-4 font-mono bg-gray-900 p-2 rounded">
                {error.message}
              </p>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
