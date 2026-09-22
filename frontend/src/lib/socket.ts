import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(userId?: string): Socket {
  if (!socket) {
    socket = io(window.location.origin, {
      auth: { userId },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  } else if (userId && socket.auth && (socket.auth as any).userId !== userId) {
    (socket.auth as any).userId = userId;
    socket.disconnect().connect();
  }
  return socket;
}
