# Known Limitations

## Eye Contact / Gaze Estimation

- **Camera angle sensitivity**: Accuracy drops when camera is not at eye level. Side-mounted or low-angle cameras produce higher false-negative rates for "looking at camera."
- **Multi-monitor setups**: Looking at a second monitor registers as "not looking at camera" even if the student is engaged with shared content.
- **Glasses/reflections**: Strong reflections on glasses can occlude iris landmarks, reducing gaze accuracy.
- **Lighting**: Low light or strong backlighting degrades MediaPipe face detection reliability.
- **Threshold**: The 0.18 iris offset threshold was empirically chosen. Individual face geometry varies; a calibration step would improve per-user accuracy.

## Speaking Time & Voice Activity

- **Single microphone**: When both participants share a room (rare in video tutoring but possible), the VAD cannot distinguish speakers. Accuracy requires separate audio streams.
- **Background noise**: Persistent background noise (fans, traffic) can trigger false positives. The adaptive threshold handles intermittent noise but not sustained noise floors.
- **Demo video audio**: When using a pre-recorded student video, the audio must have a clear speech track. Silent videos produce no student speaking data.

## Interruption Detection

- **500ms overlap threshold**: Brief conversational overlaps (<500ms) like "mm-hmm" or "right" are not counted as interruptions. This is intentional but means very short interruptions are missed.
- **No speaker diarization**: The system relies on separate audio streams per participant. It cannot separate speakers from a mixed audio source.

## Energy Level

- **Proxy metric**: Energy is estimated from audio volume variance + facial expression valence. It is not validated against ground-truth engagement measures (e.g., self-reported attention, learning outcomes).
- **Cultural bias**: Facial expression norms vary across cultures. The smile detection baseline may not generalize.

## Attention Drift

- **Composite heuristic**: Attention drift is declared when eye contact declines AND student silence exceeds 60 seconds. This may miss engaged-but-quiet students (e.g., reading shared content) and false-alarm on naturally quiet students.

## Architecture

- **Browser-only persistence**: Session data is stored in IndexedDB in the tutor's browser. Clearing browser data loses all sessions. No cross-device sync.
- **No WebRTC infrastructure**: The live camera mode uses a second getUserMedia call, not a real peer-to-peer connection. True remote sessions would require WebRTC signaling infrastructure.
- **Single face per tile**: The system assumes one face per video tile. Group sessions (multiple students) are not supported.

## Performance

- **Client hardware**: MediaPipe GPU acceleration requires WebGL support. Older machines or those without dedicated GPUs may experience higher latency.
- **Memory**: Long sessions (>60 minutes) accumulate metric snapshots in memory. At 2Hz, a 60-minute session stores ~7,200 snapshots (~2MB). Sessions beyond 2-3 hours may need periodic persistence and memory cleanup.
