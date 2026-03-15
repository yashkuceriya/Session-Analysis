import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuid } from 'uuid';

interface SignalingMessage {
  type: string;
  from: string;
  roomId: string;
  [key: string]: unknown;
}

interface PeerInfo {
  peerId: string;
  socket: WebSocket;
  lastPong: number;
}

const PORT = parseInt(process.env.WS_PORT || '8081', 10);
const wss = new WebSocketServer({ port: PORT });

// Room -> Set of peer info
const rooms = new Map<string, Map<string, PeerInfo>>();

// Heartbeat configuration
const PING_INTERVAL = 30000; // 30 seconds
const PONG_TIMEOUT = 10000; // 10 seconds

/**
 * Get or create a room
 */
function getRoom(roomId: string): Map<string, PeerInfo> {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  return rooms.get(roomId)!;
}

/**
 * Remove a peer from a room and clean up
 */
function removePeerFromRoom(roomId: string, peerId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;

  room.delete(peerId);

  // Remove empty rooms
  if (room.size === 0) {
    rooms.delete(roomId);
  }
}

/**
 * Broadcast a message to all peers in a room except the sender
 */
function broadcastToRoom(
  roomId: string,
  fromPeerId: string,
  message: SignalingMessage
): void {
  const room = getRoom(roomId);
  room.forEach((peerInfo, peerId) => {
    if (peerId !== fromPeerId && peerInfo.socket.readyState === WebSocket.OPEN) {
      try {
        peerInfo.socket.send(JSON.stringify(message));
      } catch (err) {
        console.error(`Failed to send message to peer ${peerId}:`, err);
      }
    }
  });
}

/**
 * Send a message to a specific peer
 */
function sendToPeer(
  roomId: string,
  toPeerId: string,
  message: SignalingMessage
): boolean {
  const room = getRoom(roomId);
  const peerInfo = room.get(toPeerId);

  if (!peerInfo || peerInfo.socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  try {
    peerInfo.socket.send(JSON.stringify(message));
    return true;
  } catch (err) {
    console.error(`Failed to send message to peer ${toPeerId}:`, err);
    return false;
  }
}

/**
 * Handle incoming messages
 */
function handleMessage(ws: WebSocket, peerId: string, roomId: string, data: string): void {
  try {
    const message: SignalingMessage = JSON.parse(data);
    const { type } = message;

    switch (type) {
      case 'join':
        {
          // Notify existing peers about the new peer
          const room = getRoom(roomId);
          const existingPeerIds = Array.from(room.keys()).filter(id => id !== peerId);

          broadcastToRoom(roomId, peerId, {
            type: 'peer-joined',
            from: peerId,
            roomId,
            peerId,
          });

          // Send list of existing peers to the joining peer
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'existing-peers',
                from: 'server',
                roomId,
                peerIds: existingPeerIds,
              })
            );
          }

          const room_info = getRoom(roomId);
          console.log(
            `[Room ${roomId}] Peer joined: ${peerId}. Total peers: ${room_info.size}`
          );
        }
        break;

      case 'offer':
      case 'answer':
        {
          const { to } = message as SignalingMessage & { to: string };
          if (!to) {
            console.error(`Message type ${type} missing 'to' field`);
            break;
          }
          const success = sendToPeer(roomId, to, message);
          if (!success) {
            console.warn(`Failed to send ${type} to peer ${to} in room ${roomId}`);
          }
        }
        break;

      case 'ice-candidate':
        {
          const { to } = message as SignalingMessage & { to: string };
          if (!to) {
            console.error('ice-candidate message missing "to" field');
            break;
          }
          const success = sendToPeer(roomId, to, message);
          if (!success) {
            console.warn(`Failed to send ice-candidate to peer ${to} in room ${roomId}`);
          }
        }
        break;

      case 'leave':
        {
          broadcastToRoom(roomId, peerId, {
            type: 'peer-left',
            from: peerId,
            roomId,
            peerId,
          });
          const room_info = getRoom(roomId);
          console.log(
            `[Room ${roomId}] Peer left: ${peerId}. Remaining peers: ${room_info.size}`
          );
        }
        break;

      case 'pong':
        {
          const peerInfo = getRoom(roomId).get(peerId);
          if (peerInfo) {
            peerInfo.lastPong = Date.now();
          }
        }
        break;

      default:
        console.warn(`Unknown message type: ${type}`);
    }
  } catch (err) {
    console.error('Failed to parse message:', err);
  }
}

/**
 * Handle client connection
 */
wss.on('connection', (ws: WebSocket) => {
  const peerId = uuid();
  let roomId: string | null = null;
  const peerInfo: PeerInfo = {
    peerId,
    socket: ws,
    lastPong: Date.now(),
  };

  console.log(`[Server] New connection: ${peerId}`);

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const message: SignalingMessage = JSON.parse(data.toString());
      const { roomId: msgRoomId, type } = message;

      if (!msgRoomId) {
        console.error('Message missing roomId');
        return;
      }

      // First message should be a join, which establishes the room
      if (!roomId) {
        roomId = msgRoomId;
        const room = getRoom(roomId);
        room.set(peerId, peerInfo);
        console.log(`[Room ${roomId}] Peer ${peerId} assigned to room`);
      }

      if (roomId !== msgRoomId) {
        console.error(`Peer ${peerId} tried to access different room ${msgRoomId}`);
        return;
      }

      handleMessage(ws, peerId, roomId, data.toString());
    } catch (err) {
      console.error('Failed to process message:', err);
    }
  });

  ws.on('close', () => {
    if (roomId) {
      removePeerFromRoom(roomId, peerId);
      broadcastToRoom(roomId, peerId, {
        type: 'peer-left',
        from: peerId,
        roomId,
        peerId,
      });
      const room_info = getRoom(roomId);
      console.log(
        `[Room ${roomId}] Peer disconnected: ${peerId}. Remaining peers: ${room_info.size}`
      );
    } else {
      console.log(`[Server] Peer ${peerId} disconnected before joining any room`);
    }
  });

  ws.on('error', (err) => {
    console.error(`[Peer ${peerId}] WebSocket error:`, err);
  });
});

/**
 * Heartbeat: ping clients periodically
 */
setInterval(() => {
  rooms.forEach((room, roomId) => {
    room.forEach((peerInfo, peerId) => {
      const timeSinceLastPong = Date.now() - peerInfo.lastPong;

      if (timeSinceLastPong > PONG_TIMEOUT) {
        console.log(`[Room ${roomId}] Peer ${peerId} did not respond to ping. Terminating.`);
        peerInfo.socket.close(4000, 'Heartbeat timeout');
        return;
      }

      if (peerInfo.socket.readyState === WebSocket.OPEN) {
        peerInfo.socket.send(JSON.stringify({ type: 'ping', from: 'server' }));
        console.log(`[Room ${roomId}] Sent ping to peer ${peerId}`);
      }
    });
  });
}, PING_INTERVAL);

console.log(`WebSocket signaling server listening on port ${PORT}`);
