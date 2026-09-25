import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './api.ts';

let socket: Socket | null = null;
let currentUserId: string | null = null;
const activeProjectRooms = new Set<string>();

/**
 * Returns the singleton Socket.IO client instance.
 * Automatically authenticates and reconnects across route/view transitions.
 */
export function getSocket(userId?: string): Socket {
  const socketUrl =
    API_BASE_URL ||
    (typeof window !== 'undefined' && window.location?.origin) ||
    '';

  if (!socket) {
    currentUserId = userId || null;
    socket = io(socketUrl, {
      auth: { userId: currentUserId || undefined },
      query: currentUserId ? { userId: currentUserId } : undefined,
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      // Authenticate if we have a userId
      if (currentUserId) {
        socket?.emit('authenticate', { userId: currentUserId });
      }
      // Re-join all active project rooms upon initial connect or reconnection
      activeProjectRooms.forEach((projectId) => {
        socket?.emit('join:project', projectId);
      });
    });

    socket.on('connect_error', (error) => {
      // In production/dev, log connection errors without throwing
      console.warn('Socket connection error:', error.message);
    });
  } else if (userId && currentUserId !== userId) {
    currentUserId = userId;
    socket.auth = { userId };
    if (socket.connected) {
      socket.emit('authenticate', { userId });
      // Re-verify room memberships with new user identity
      activeProjectRooms.forEach((projectId) => {
        socket?.emit('join:project', projectId);
      });
    } else {
      socket.connect();
    }
  }

  return socket;
}

/**
 * Joins a project room and tracks it so it is automatically re-joined on reconnects.
 */
export function joinProjectRoom(projectId: string, callback?: (res: any) => void) {
  if (!projectId) return;
  activeProjectRooms.add(projectId);
  const s = getSocket();
  if (s.connected) {
    s.emit('join:project', projectId, callback);
  }
}

/**
 * Leaves a project room and untracks it.
 */
export function leaveProjectRoom(projectId: string) {
  if (!projectId) return;
  activeProjectRooms.delete(projectId);
  if (socket && socket.connected) {
    socket.emit('leave:project', projectId);
  }
}

