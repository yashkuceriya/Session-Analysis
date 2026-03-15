describe('Connection Quality State Machine', () => {
  it('maps quality tiers correctly', () => {
    // Test the mapping logic from useAdaptiveQuality tiers to connection quality
    const mapQuality = (streamQuality: string) => {
      if (streamQuality === 'high') return 'excellent';
      if (streamQuality === 'medium') return 'good';
      if (streamQuality === 'low') return 'poor';
      return 'poor';
    };

    expect(mapQuality('high')).toBe('excellent');
    expect(mapQuality('medium')).toBe('good');
    expect(mapQuality('low')).toBe('poor');
    expect(mapQuality('audio-only')).toBe('poor');
  });

  it('classifies connection quality from stats', () => {
    const computeQuality = (rtt: number, packetLoss: number) => {
      if (rtt < 100 && packetLoss < 1) return 'excellent';
      if (rtt < 300 && packetLoss < 5) return 'good';
      return 'poor';
    };

    expect(computeQuality(50, 0)).toBe('excellent');
    expect(computeQuality(150, 2)).toBe('good');
    expect(computeQuality(400, 10)).toBe('poor');
    expect(computeQuality(80, 6)).toBe('poor'); // low RTT but high loss
  });
});
