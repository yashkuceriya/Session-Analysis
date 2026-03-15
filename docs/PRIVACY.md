# Privacy Analysis

## Data Flow

### What stays in the browser
- All video frames (never transmitted)
- All audio data (never recorded or transmitted)
- Raw face landmarks from MediaPipe
- Iris position calculations

### What is stored locally (IndexedDB)
- Session configuration (subject, names, session type)
- Aggregated numeric metrics (engagement scores, talk time ratios, eye contact percentages)
- Coaching nudge history (text messages + timestamps)
- No biometric templates, facial images, or audio recordings

### What leaves the browser
- MediaPipe model files are loaded from Google's CDN on first use (one-time download, cached)
- No other network requests during a session

## Privacy Controls

### Consent
In production, tutors and students should consent to analysis before session start. The system should display a clear notice: "This session will analyze engagement metrics including eye contact, speaking time, and attention patterns."

### Data Minimization
- Only numeric engagement scores are persisted, not raw video/audio
- Face landmarks are processed in real-time and discarded (not stored)
- No facial recognition or identity matching is performed

### Access Control
- Session data is stored in the tutor's browser only
- The student does not see coaching nudges (tutor-only overlay)
- No server-side data means no admin access to session data

### Data Retention
- Sessions persist in IndexedDB until manually deleted
- In production, implement automatic retention policies (e.g., 90-day expiry)

### Anonymization
- Post-session analytics show aggregate metrics, not frame-by-frame facial data
- Metrics cannot be reverse-engineered to reconstruct video

## Regulatory Considerations

### FERPA (US Education)
Session engagement metrics may constitute "education records" if linked to a student. In production:
- Obtain appropriate consent
- Limit data sharing to legitimate educational purposes
- Provide data deletion capability

### GDPR (EU)
If used with EU students:
- Lawful basis: legitimate interest (improving education quality) or consent
- Data minimization: only engagement scores, no biometric data stored
- Right to erasure: implement session deletion

### COPPA (US Children)
If students are under 13:
- Parental consent required for data collection
- Current architecture (browser-only, no server storage) minimizes compliance burden
