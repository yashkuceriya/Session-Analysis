'use client';

import { useAccessibilityStore } from '@/stores/accessibilityStore';

export function ScreenReaderAnnouncer() {
  const announcements = useAccessibilityStore((state) => state.announcements);

  return (
    <>
      {announcements.map((announcement) => (
        <div
          key={announcement.id}
          aria-live={announcement.urgency}
          aria-atomic="true"
          className="sr-only"
        >
          {announcement.message}
        </div>
      ))}
    </>
  );
}
