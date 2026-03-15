'use client';

import { useState, useRef } from 'react';
import styles from './BookmarkButton.module.css';

interface BookmarkButtonProps {
  onBookmark: (label?: string) => void;
}

export function BookmarkButton({ onBookmark }: BookmarkButtonProps) {
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleMouseDown = () => {
    longPressTimer.current = setTimeout(() => {
      setIsInputOpen(true);
    }, 500);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;

      // Quick press - instant bookmark
      if (!isInputOpen) {
        onBookmark();
      }
    }
  };

  const handleSubmit = () => {
    onBookmark(inputValue || undefined);
    setIsInputOpen(false);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'Escape') {
      setIsInputOpen(false);
      setInputValue('');
    }
  };

  return (
    <div className={styles.container}>
      <button
        className={styles.button}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        title="Click to bookmark, hold to add label"
        aria-label="Bookmark current moment"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      {isInputOpen && (
        <div className={styles.inputContainer}>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add label (optional)"
            className={styles.input}
            autoFocus
          />
            <button
            onClick={handleSubmit}
            className={styles.submitBtn}
            aria-label="Save bookmark"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
