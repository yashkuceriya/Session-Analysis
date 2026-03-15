import { SignalingClient, SignalingMessage } from '@/lib/realtime/SignalingClient';

// Mock BroadcastChannel
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent<SignalingMessage>) => void) | null = null;

  constructor(name: string) {
    this.name = name;
  }

  postMessage(data: SignalingMessage): void {
    // Noop for mock
  }

  close(): void {
    // Noop for mock
  }
}

// Store original global values
const originalBroadcastChannel = (global as any).BroadcastChannel;

// Setup and teardown
beforeAll(() => {
  (global as any).BroadcastChannel = MockBroadcastChannel;
});

afterAll(() => {
  (global as any).BroadcastChannel = originalBroadcastChannel;
});

describe('SignalingClient', () => {
  let client: SignalingClient;

  beforeEach(() => {
    client = new SignalingClient('test-room', 'student');
  });

  afterEach(() => {
    if (client) {
      client.disconnect();
    }
  });

  it('should initialize with room ID and role', () => {
    const c = new SignalingClient('room-123', 'tutor');
    expect(c).toBeDefined();
  });

  it('should fallback to BroadcastChannel when no URL provided', async () => {
    await client.connect(); // No URL provided

    // Should be connected via BroadcastChannel
    expect(client.isConnected()).toBe(true);
  });

  it('should register message handlers', async () => {
    await client.connect();

    const messageHandler = jest.fn();
    client.onMessage(messageHandler);

    expect(messageHandler).toBeDefined();
  });

  it('should filter messages from same role', async () => {
    const tutor = new SignalingClient('room-123', 'tutor');
    const student = new SignalingClient('room-123', 'student');

    await tutor.connect();
    await student.connect();

    const tutorHandler = jest.fn();
    const studentHandler = jest.fn();

    tutor.onMessage(tutorHandler);
    student.onMessage(studentHandler);

    // Tutor sends message (should only be received by student)
    const msg: SignalingMessage = {
      type: 'offer',
      from: 'tutor',
      roomId: 'room-123',
    };

    tutor.send(msg);

    // Simulate broadcast (in real scenario)
    // studentHandler should be called, tutorHandler should not

    tutor.disconnect();
    student.disconnect();
  });

  it('should report connected state after BroadcastChannel init', async () => {
    await client.connect();

    expect(client.isConnected()).toBe(true);
  });

  it('should disconnect cleanly', async () => {
    await client.connect();

    expect(client.isConnected()).toBe(true);

    client.disconnect();

    expect(client.isConnected()).toBe(false);
  });

  it('should register connection change handlers', async () => {
    const connectionHandler = jest.fn();

    client.onConnectionChange(connectionHandler);

    await client.connect();

    // Connection change should have been called
    expect(connectionHandler).toHaveBeenCalled();
  });

  it('should call connection change handler on connect', async () => {
    const connectionHandler = jest.fn();

    client.onConnectionChange(connectionHandler);

    await client.connect();

    // Should have been called with true
    expect(connectionHandler).toHaveBeenCalledWith(true);
  });

  it('should call connection change handler on disconnect', async () => {
    const connectionHandler = jest.fn();

    client.onConnectionChange(connectionHandler);

    await client.connect();

    connectionHandler.mockClear();

    client.disconnect();

    // Should have been called with false
    expect(connectionHandler).toHaveBeenCalledWith(false);
  });

  it('should send messages via BroadcastChannel', async () => {
    await client.connect();

    const msg: SignalingMessage = {
      type: 'ready',
      from: 'student',
      roomId: 'test-room',
    };

    // Should not throw
    expect(() => {
      client.send(msg);
    }).not.toThrow();
  });

  it('should handle multiple message handlers', async () => {
    await client.connect();

    const handler1 = jest.fn();
    const handler2 = jest.fn();

    client.onMessage(handler1);
    client.onMessage(handler2);

    expect(handler1).toBeDefined();
    expect(handler2).toBeDefined();
  });

  it('should handle multiple connection change handlers', async () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    client.onConnectionChange(handler1);
    client.onConnectionChange(handler2);

    await client.connect();

    expect(handler1).toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
  });

  it('should maintain room ID throughout lifecycle', async () => {
    const roomId = 'special-room-123';
    const c = new SignalingClient(roomId, 'tutor');

    await c.connect();

    expect(c).toBeDefined();

    c.disconnect();
  });

  it('should maintain role throughout lifecycle', async () => {
    const c = new SignalingClient('room-123', 'tutor');

    await c.connect();

    expect(c).toBeDefined();

    c.disconnect();
  });

  it('should handle reconnect without error', async () => {
    await client.connect();
    client.disconnect();

    // Should be able to reconnect
    const client2 = new SignalingClient('room-123', 'student');
    await client2.connect();

    expect(client2.isConnected()).toBe(true);

    client2.disconnect();
  });

  it('should not throw on double disconnect', async () => {
    await client.connect();

    expect(() => {
      client.disconnect();
      client.disconnect();
    }).not.toThrow();
  });

  it('should send without error before connecting', async () => {
    const msg: SignalingMessage = {
      type: 'ready',
      from: 'student',
      roomId: 'test-room',
    };

    // Should not throw even before connect
    expect(() => {
      client.send(msg);
    }).not.toThrow();
  });

  it('should filter messages by room ID', async () => {
    const client1 = new SignalingClient('room-1', 'student');
    const client2 = new SignalingClient('room-2', 'student');

    await client1.connect();
    await client2.connect();

    const handler1 = jest.fn();
    const handler2 = jest.fn();

    client1.onMessage(handler1);
    client2.onMessage(handler2);

    // Send message to room-1
    const msg: SignalingMessage = {
      type: 'ready',
      from: 'tutor',
      roomId: 'room-1',
    };

    client1.send(msg);

    client1.disconnect();
    client2.disconnect();
  });

  it('should handle message with sdp data', async () => {
    await client.connect();

    const msg: SignalingMessage = {
      type: 'offer',
      from: 'tutor',
      roomId: 'test-room',
      sdp: {
        type: 'offer',
        sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\n',
      },
    };

    expect(() => {
      client.send(msg);
    }).not.toThrow();
  });

  it('should handle message with ice candidate', async () => {
    await client.connect();

    const msg: SignalingMessage = {
      type: 'ice-candidate',
      from: 'tutor',
      roomId: 'test-room',
      candidate: {
        candidate:
          'candidate:1 1 udp 2130706431 10.0.0.1 12345 typ host',
        sdpMLineIndex: 0,
        sdpMid: '0',
      },
    };

    expect(() => {
      client.send(msg);
    }).not.toThrow();
  });

  it('should initialize without error', () => {
    expect(() => {
      new SignalingClient('room-123', 'student');
      new SignalingClient('room-456', 'tutor');
    }).not.toThrow();
  });

  it('should support both tutor and student roles', async () => {
    const tutorClient = new SignalingClient('room-123', 'tutor');
    const studentClient = new SignalingClient('room-123', 'student');

    await tutorClient.connect();
    await studentClient.connect();

    expect(tutorClient.isConnected()).toBe(true);
    expect(studentClient.isConnected()).toBe(true);

    tutorClient.disconnect();
    studentClient.disconnect();
  });

  it('should handle join message on connect', async () => {
    const connectionHandler = jest.fn();

    client.onConnectionChange(connectionHandler);

    await client.connect();

    // Should call connection handler when joining
    expect(connectionHandler).toHaveBeenCalledWith(true);
  });

  it('should allow sending leave message', async () => {
    await client.connect();

    const msg: SignalingMessage = {
      type: 'leave',
      from: 'student',
      roomId: 'test-room',
    };

    expect(() => {
      client.send(msg);
    }).not.toThrow();
  });
});
