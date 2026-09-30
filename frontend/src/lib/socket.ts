import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './api.ts';

let socket: Socket | null = null;
let currentUserId: string | null = null;
const activeProjectRooms = new Set<string>();

const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname === '0.0.0.0');

/**
 * Returns the singleton Socket.IO client instance.
 * Automatically authenticates and reconnects across route/view transitions.
 * - In Production: Uses import.meta.env.VITE_API_URL (e.g. https://project-management-1zps.vercel.app)
 * - In Development: Uses VITE_API_URL if set, or local proxy / relative origin
 */
export function getSocket(userId?: string): Socket {
  const envUrl = (((import.meta as any).env?.VITE_API_URL || '') as string).trim().replace(/\/$/, '');
  const socketUrl = isLocalhost
    ? ''
    : (envUrl || API_BASE_URL || (typeof window !== 'undefined' && window.location?.origin) || '');

  if (userId) {
    currentUserId = userId;
  }

  if (!socket) {
    console.log('[Socket] Initializing Socket.IO client pointing to:', socketUrl || '(same origin / local proxy)');
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
      console.log('[Socket] Connected to server, id:', socket?.id);
      if (currentUserId) {
        socket?.emit('authenticate', { userId: currentUserId }, (res: any) => {
          console.log('[Socket] Auth on connect response:', res);
        });
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
    currentUserId = userId;
    socket.auth = { userId };
    if (socket.connected) {
      socket.emit('authenticate', { userId }, (res: any) => {
        console.log('[Socket] Dynamic auth response:', res);
      });
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


