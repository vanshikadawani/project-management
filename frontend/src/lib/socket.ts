import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './api.ts';

let socket: Socket | null = null;
let currentUserId: string | null = null;
const activeProjectRooms = new Set<string>();

/**
 * Returns the singleton Socket.IO client instance.
 * Automatically authenticates and reconnects across route/view transitions.
 * - In Production: Connects directly to backend VITE_API_URL (e.g. https://project-management-1zps.vercel.app)
 * - In Development: Uses local proxy or relative origin (e.g. http://localhost:3000 -> http://127.0.0.1:5000)
 */
export function getSocket(userId?: string): Socket {
  const envUrl = ((import.meta as any).env?.VITE_API_URL || '').trim().replace(/\/$/, '');
  const socketUrl =
    envUrl ||
    API_BASE_URL ||
    (typeof window !== 'undefined' && window.location?.origin) ||
    '';

  if (userId && (!currentUserId || currentUserId !== userId)) {
    currentUserId = userId;
  }

  if (!socket) {
    console.log('[Socket] Initializing Socket.IO client pointing to:', socketUrl || '(same origin)');
    socket = io(socketUrl, {
      auth: (cb) => {
        cb({ userId: currentUserId || undefined });
      },
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
      console.log('[Socket] Connected to server, id:', socket?.id);
      if (currentUserId) {
        socket?.emit('authenticate', { userId: currentUserId });
      }
      // Re-join all active project rooms upon initial connect or reconnection
      activeProjectRooms.forEach((projectId) => {
        console.log('[Socket] Re-joining project room on connect:', projectId);
        socket?.emit('join:project', { projectId, userId: currentUserId }, (res: any) => {
          console.log('[Socket] Room join response for', projectId, ':', res);
        });
      });
    });

    socket.on('connect_error', (error) => {
      console.warn('[Socket] Connection error:', error.message);
    });
  } else if (userId && (socket.auth as any)?.userId !== userId) {
    socket.auth = { userId };
    if (socket.connected) {
      socket.emit('authenticate', { userId });
      activeProjectRooms.forEach((projectId) => {
        socket?.emit('join:project', { projectId, userId });
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
export function joinProjectRoom(projectId: string, userId?: string, callback?: (res: any) => void) {
  if (!projectId) return;
  activeProjectRooms.add(projectId);
  if (userId) currentUserId = userId;
  const s = getSocket(userId || currentUserId || undefined);
  console.log('[Socket] Emitting join:project for room:', projectId, 'user:', userId || currentUserId);
  s.emit('join:project', { projectId, userId: userId || currentUserId }, (res: any) => {
    console.log('[Socket] join:project response:', res);
    if (callback) callback(res);
  });
}

/**
 * Leaves a project room and untracks it.
 */
export function leaveProjectRoom(projectId: string) {
  if (!projectId) return;
  activeProjectRooms.delete(projectId);
  if (socket) {
    socket.emit('leave:project', { projectId });
  }
}


