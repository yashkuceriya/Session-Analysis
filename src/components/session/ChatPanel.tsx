'use client';

import { useRef, useEffect, useState } from 'react';
import type { ChatMessage } from '@/hooks/useChatChannel';

interface ChatPanelProps {
  isOpen: boolean;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onClose: () => void;
  unreadCount: number;
}

export function ChatPanel({ isOpen, messages, onSendMessage, onClose, unreadCount }: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState('');

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (inputText.trim()) {
      onSendMessage(inputText);
      setInputText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getInitial = (name: string) => {
    return name.charAt(0).toUpperCase();
  };

  const textMessages = messages.filter((m) => m.type === 'text' || m.type === 'system');

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={onClose}
        />
      )}

      {/* Chat Panel */}
      <div
        className={`fixed top-0 right-0 h-screen w-80 bg-gray-900 border-l border-gray-800 flex flex-col transition-transform duration-300 z-35 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <h2 className="text-white font-semibold">Chat</h2>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 rounded-full">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Close chat"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
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

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {textMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              No messages yet
            </div>
          ) : (
            textMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.type === 'system' ? 'justify-center' : message.senderRole === 'tutor' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.type === 'system' ? (
                  <div className="text-xs text-gray-500 italic text-center px-2 py-1 bg-gray-800 rounded">
                    {message.text}
                  </div>
                ) : (
                  <div
                    className={`flex gap-2 max-w-xs ${
                      message.senderRole === 'tutor' ? 'flex-row-reverse' : ''
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold ${
                        message.senderRole === 'tutor' ? 'bg-blue-600' : 'bg-purple-600'
                      }`}
                    >
                      {getInitial(message.sender)}
                    </div>

                    {/* Message Bubble */}
                    <div className="flex flex-col">
                      <div className="text-xs text-gray-400 mb-0.5">
                        {message.sender}
                        <span className="ml-2 text-gray-600 text-xs">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                      <div
                        className={`px-3 py-2 rounded-lg ${
                          message.senderRole === 'tutor'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-100'
                        }`}
                      >
                        <p className="text-sm break-words whitespace-pre-wrap">
                          {message.text}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-800 p-4 space-y-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Shift+Enter for new line)"
            className="w-full px-3 py-2 bg-gray-800 text-white rounded-lg text-sm placeholder-gray-500 resize-none border border-gray-700 focus:border-blue-500 focus:outline-none"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </>
  );
}
