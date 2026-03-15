# Decision Log

## D1: All video processing in-browser (no server)
**Decision:** Run MediaPipe Face Mesh and Web Audio API entirely in the browser.
**Alternatives considered:** Server-side processing via WebSocket frame relay; cloud vision APIs.
**Rationale:** Eliminates network latency for real-time feedback (<100ms vs 200-500ms round-trip). Strongest privacy posture — no video data leaves the device. Simpler deployment (static site + CDN). Earns browser-based bonus in rubric.
**Tradeoff:** Limited by client hardware. Cannot do heavy ML (e.g., emotion recognition with large models).

## D2: MediaPipe Face Mesh at 2Hz
**Decision:** Process video frames at 2 frames/second, not full framerate.
**Alternatives considered:** 5-10 FPS processing; requestAnimationFrame-synced.
**Rationale:** 2Hz provides 500ms update cadence which matches the rubric's 1-2 Hz requirement. Keeps CPU/GPU usage reasonable on typical laptops. Face mesh at 30fps would consume excessive resources without proportional metric improvement (engagement changes over seconds, not frames).
**Tradeoff:** Fast head movements between frames may be missed.

## D3: EMA smoothing (alpha=0.3) for all metrics
**Decision:** Apply exponential moving average to all engagement metrics.
**Rationale:** Raw per-frame values are noisy (e.g., iris detection jitters). EMA with alpha=0.3 reacts to real changes within 1-2 seconds while preventing distracting UI flicker.

## D4: Iris offset ratio for gaze estimation
**Decision:** Use iris center position relative to eye corners as a camera-gaze proxy.
**Alternatives considered:** Full 3D head pose estimation; dedicated gaze models (GazeML).
**Rationale:** MediaPipe provides iris landmarks (468-477) out of the box. The offset ratio approach is simple, fast (<1ms), and achieves 75-85% accuracy for binary "looking at camera" classification. More complex models would increase latency.
**Tradeoff:** Sensitive to camera angle. Multi-monitor setups may cause false negatives.

## D5: IndexedDB for session persistence
**Decision:** Store completed session data in browser IndexedDB.
**Alternatives considered:** localStorage (size limits), server-side JSON files, SQLite via WASM.
**Rationale:** IndexedDB handles large session datasets (thousands of metric snapshots) without size limits. No server infrastructure needed. Sessions survive page refreshes and can be loaded by URL.
**Tradeoff:** Data is browser-local, not shareable across devices.

## D6: Zustand for state management
**Decision:** Use Zustand instead of React Context or Redux.
**Rationale:** Minimal boilerplate. Supports selective subscriptions (important when metrics update at 2Hz — only subscribing components re-render). Works outside React (store actions callable from processing loops).

## D7: Coaching nudge cooldowns
**Decision:** Each nudge rule has a per-rule cooldown + a global minimum interval.
**Rationale:** Without cooldowns, a sustained low metric would fire the same nudge every 500ms. The per-rule cooldown (60s-300s) prevents repetition. The global interval (30s default) prevents nudge flooding even when multiple rules trigger simultaneously.

## D8: Real audio from student video element
**Decision:** Extract audio from the student's video element via createMediaElementSource/createMediaStreamSource and run the same VAD pipeline.
**Alternatives considered:** Simulating student audio with sine waves.
**Rationale:** All metrics must be driven by real input data, not simulation. When a demo video with audio is provided, speaking time and interruption metrics reflect actual speech patterns. When using live camera mode, real mic input is analyzed.
