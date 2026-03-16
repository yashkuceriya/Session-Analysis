'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface ChatMessage {
  id: string;
  sender: string;
  senderRole: 'tutor' | 'student';
  text: string;
  timestamp: number;
  type: 'text' | 'reaction' | 'system';
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface UseChatChannelOptions {
  dataChannelSend?: (msg: any) => void;
  dataChannelMessages?: any[];
  userRole?: 'tutor' | 'student';
  userName?: string;
}

export function useChatChannel({
  dataChannelSend,
  dataChannelMessages = [],
  userRole = 'student',
  userName = 'User',
}: UseChatChannelOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isChatOpenRef = useRef(false);
  const processedCountRef = useRef(0);

  // Process incoming DataChannel messages — only process new ones since last run
  useEffect(() => {
    if (!dataChannelMessages || dataChannelMessages.length === 0) return;

    const newMessages = dataChannelMessages.slice(processedCountRef.current);
    if (newMessages.length === 0) return;
    processedCountRef.current = dataChannelMessages.length;

    newMessages.forEach((rawMsg) => {
      try {
        const msg = typeof rawMsg === 'string' ? JSON.parse(rawMsg) : rawMsg;

        if (msg.type === 'text' || msg.type === 'reaction' || msg.type === 'system') {
          const chatMessage: ChatMessage = {
            id: msg.id || `msg-${Date.now()}-${Math.random()}`,
            sender: msg.sender || 'Unknown',
            senderRole: msg.senderRole || 'student',
            text: msg.text || '',
            timestamp: msg.timestamp || Date.now(),
            type: msg.type || 'text',
          };

          setMessages((prev) => [...prev, chatMessage]);

          // Track unread if chat panel is closed
          if (!isChatOpenRef.current && msg.type !== 'reaction') {
            setUnreadCount((prev) => prev + 1);
          }
        }
      } catch (err) {
        console.error('Failed to parse chat message:', err);
      }
    });
  }, [dataChannelMessages]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      const message: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random()}`,
        sender: userName,
        senderRole: userRole,
        text: text.trim(),
        timestamp: Date.now(),
        type: 'text',
      };

      // Add to local state immediately
      setMessages((prev) => [...prev, message]);

      // Send via DataChannel
      if (dataChannelSend) {
        dataChannelSend(message);
      }
    },
    [dataChannelSend, userRole, userName]
  );

  const sendReaction = useCallback(
    (emoji: string) => {
      const message: ChatMessage = {
        id: `reaction-${Date.now()}-${Math.random()}`,
        sender: userName,
        senderRole: userRole,
        text: emoji,
        timestamp: Date.now(),
        type: 'reaction',
      };

      // Send via DataChannel (don't add to message history)
      if (dataChannelSend) {
        dataChannelSend(message);
      }
    },
    [dataChannelSend, userRole, userName]
  );

  const markAsRead = useCallback(() => {
    setUnreadCount(0);
    isChatOpenRef.current = true;
  }, []);

  const markAsUnread = useCallback(() => {
    isChatOpenRef.current = false;
  }, []);

  return {
    messages,
    sendMessage,
    sendReaction,
    unreadCount,
    markAsRead,
    markAsUnread,
  };
}
