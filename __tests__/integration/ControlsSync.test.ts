describe('Controls-to-Media Sync', () => {
  it('should track mic state', () => {
    // Verify the store toggle pattern
    const { useSessionStore } = require('@/stores/sessionStore');
    const store = useSessionStore.getState();

    const initialMic = store.isMicEnabled;
    store.toggleMic();
    expect(useSessionStore.getState().isMicEnabled).toBe(!initialMic);
    store.toggleMic();
    expect(useSessionStore.getState().isMicEnabled).toBe(initialMic);
  });

  it('should track camera state', () => {
    const { useSessionStore } = require('@/stores/sessionStore');
    const store = useSessionStore.getState();

    const initialCam = store.isCameraEnabled;
    store.toggleCamera();
    expect(useSessionStore.getState().isCameraEnabled).toBe(!initialCam);
    store.toggleCamera();
    expect(useSessionStore.getState().isCameraEnabled).toBe(initialCam);
  });

  it('should track call state transitions', () => {
    const { useSessionStore } = require('@/stores/sessionStore');
    const store = useSessionStore.getState();

    // Initial state should be 'waiting'
    expect(store.callState).toBe('waiting');

    store.setCallState('connecting');
    expect(useSessionStore.getState().callState).toBe('connecting');

    store.setCallState('connected');
    expect(useSessionStore.getState().callState).toBe('connected');

    store.setCallState('degraded');
    expect(useSessionStore.getState().callState).toBe('degraded');

    store.setCallState('reconnecting');
    expect(useSessionStore.getState().callState).toBe('reconnecting');

    store.setCallState('ended');
    expect(useSessionStore.getState().callState).toBe('ended');

    // Reset for other tests
    store.setCallState('waiting');
  });

  it('should track analysis visibility toggle', () => {
    const { useSessionStore } = require('@/stores/sessionStore');
    const store = useSessionStore.getState();

    const initial = store.isAnalysisVisible;
    store.toggleAnalysis();
    expect(useSessionStore.getState().isAnalysisVisible).toBe(!initial);
    store.toggleAnalysis();
    expect(useSessionStore.getState().isAnalysisVisible).toBe(initial);
  });

  it('should track recording state', () => {
    const { useSessionStore } = require('@/stores/sessionStore');
    const store = useSessionStore.getState();

    expect(store.isRecording).toBe(false);
    store.setRecording(true);
    expect(useSessionStore.getState().isRecording).toBe(true);
    store.setRecording(false);
    expect(useSessionStore.getState().isRecording).toBe(false);
  });
});
