'use client';

import { useState } from 'react';

interface TranscriptSegment {
  speaker: 'tutor' | 'student';
  text: string;
  timestamp: number;
}

interface SessionTranscriptProps {
  segments: TranscriptSegment[];
  sessionStartTime: number;
  tutorName?: string;
  studentName?: string;
}

export function SessionTranscript({ segments, sessionStartTime, tutorName = 'Tutor', studentName = 'Student' }: SessionTranscriptProps) {
  const [filter, setFilter] = useState<'all' | 'tutor' | 'student'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSegments = segments.filter((seg) => {
    if (filter !== 'all' && seg.speaker !== filter) return false;
    if (searchQuery && !seg.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const formatTime = (timestamp: number) => {
    const elapsed = Math.max(0, timestamp - sessionStartTime);
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getName = (speaker: 'tutor' | 'student') => speaker === 'tutor' ? tutorName : studentName;

  // Group consecutive segments by the same speaker
  const groupedSegments: Array<{ speaker: 'tutor' | 'student'; texts: string[]; startTime: number; endTime: number }> = [];
  for (const seg of filteredSegments) {
    const last = groupedSegments[groupedSegments.length - 1];
    if (last && last.speaker === seg.speaker && seg.timestamp - last.endTime < 5000) {
      last.texts.push(seg.text);
      last.endTime = seg.timestamp;
    } else {
      groupedSegments.push({
        speaker: seg.speaker,
        texts: [seg.text],
        startTime: seg.timestamp,
        endTime: seg.timestamp,
      });
    }
  }

  if (segments.length === 0) {
    return (
      <div className="card p-8 shadow-sm">
        <div className="text-center py-8">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-[var(--muted)] text-sm">No transcript available for this session.</p>
          <p className="text-[var(--muted-light)] text-xs mt-1">Transcription requires browser speech recognition support.</p>
        </div>
      </div>
    );
  }

  const tutorWordCount = segments.filter(s => s.speaker === 'tutor').reduce((sum, s) => sum + s.text.split(/\s+/).length, 0);
  const studentWordCount = segments.filter(s => s.speaker === 'student').reduce((sum, s) => sum + s.text.split(/\s+/).length, 0);

  return (
    <div className="card p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          {/* Speaker filter */}
          <div className="flex items-center gap-1 bg-[var(--card-hover)] rounded-lg p-0.5">
            {(['all', 'tutor', 'student'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  filter === f
                    ? 'bg-white text-[var(--foreground)] shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--foreground)]'
                }`}
              >
                {f === 'all' ? 'All' : getName(f)}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs text-[var(--muted-light)]">{segments.length} segments</span>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search transcript..."
          className="w-full bg-[var(--card-hover)] border border-[var(--card-border)] rounded-lg px-3 py-2 text-xs text-[var(--foreground)] placeholder-[var(--muted-light)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      {/* Transcript body */}
      <div className="max-h-[500px] overflow-y-auto space-y-3 pr-1">
        {groupedSegments.map((group, i) => (
          <div key={i} className={`flex gap-3 p-3 rounded-lg ${
            group.speaker === 'tutor' ? 'bg-blue-50/60' : 'bg-emerald-50/60'
          }`}>
            {/* Timestamp */}
            <div className="w-12 flex-shrink-0 pt-0.5">
              <span className="text-[10px] text-[var(--muted-light)] font-mono">{formatTime(group.startTime)}</span>
            </div>

            {/* Speaker badge + text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-semibold ${
                  group.speaker === 'tutor' ? 'text-blue-600' : 'text-emerald-600'
                }`}>
                  {getName(group.speaker)}
                </span>
              </div>
              <p className="text-sm text-[var(--foreground)] leading-relaxed">
                {group.texts.join(' ')}
              </p>
            </div>
          </div>
        ))}

        {filteredSegments.length === 0 && (
          <div className="text-center py-6">
            <p className="text-[var(--muted)] text-sm">No matching segments found.</p>
          </div>
        )}
      </div>

      {/* Word count summary */}
      <div className="mt-4 pt-3 border-t border-[var(--card-border)] flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs text-[var(--muted)]">
            {tutorName}: {tutorWordCount} words
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs text-[var(--muted)]">
            {studentName}: {studentWordCount} words
          </span>
        </div>
        <div className="ml-auto text-xs text-[var(--muted-light)]">
          {tutorWordCount + studentWordCount} total words
        </div>
      </div>
    </div>
  );
}
