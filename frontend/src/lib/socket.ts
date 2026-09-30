import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './api.ts';

let socket: Socket | null = null;
let currentUserId: string | null = null;
const activeProjectRooms = new Set<string>();
const recentLogs: Array<{ time: string; level: 'info' | 'warn' | 'error'; message: string; details?: any }> = [];

const MAX_LOGS = 100;
function logSocket(level: 'info' | 'warn' | 'error', message: string, details?: any) {
  const time = new Date().toISOString();
  const entry = { time, level, message, details };
  recentLogs.push(entry);
  if (recentLogs.length > MAX_LOGS) recentLogs.shift();

  const formattedMsg = `[Socket.IO][${time}] ${message}`;
  if (level === 'error') {
    console.error(formattedMsg, details !== undefined ? details : '');
  } else if (level === 'warn') {
    console.warn(formattedMsg, details !== undefined ? details : '');
  } else {
    console.log(formattedMsg, details !== undefined ? details : '');
  }
}

const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname === '0.0.0.0');

/**
 * Returns the singleton Socket.IO client instance.
 * Automatically authenticates and reconnects across route/view transitions.
 * - In Production: Uses VITE_API_URL or same-origin deployment
 * - In Development: Uses local proxy / relative origin
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
    logSocket('info', `Initializing Socket.IO client`, {
      targetUrl: socketUrl || '(same origin / local proxy)',
      isLocalhost,
      envViteApiUrl: envUrl || '(not set)',
      apiBaseUrl: API_BASE_URL || '(empty)',
      windowOrigin: typeof window !== 'undefined' ? window.location.origin : '(SSR)',
      userId: currentUserId || '(none)',
    });

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

    // Connection lifecycle events
    socket.on('connect', () => {
      const activeTransport = socket?.io?.engine?.transport?.name || 'unknown';
      logSocket('info', `Connected successfully! Socket ID: ${socket?.id}`, {
        id: socket?.id,
        transport: activeTransport,
        targetUrl: socketUrl || window.location.origin,
      });

      // Track transport upgrades (e.g., polling -> websocket)
      socket?.io?.engine?.on('upgrade', (transport) => {
        logSocket('info', `Transport upgraded to: ${transport.name}`);
      });

      if (currentUserId) {
        logSocket('info', `Emitting 'authenticate' for user: ${currentUserId}`);
        socket?.emit('authenticate', { userId: currentUserId }, (res: any) => {
          logSocket(res?.success ? 'info' : 'warn', `'authenticate' response on connect:`, res);
        });
      }

      // Re-join all active project rooms upon initial connect or reconnection
      activeProjectRooms.forEach((projectId) => {
        logSocket('info', `Re-joining active project room on connect: ${projectId}`);
        socket?.emit('join:project', { projectId, userId: currentUserId }, (res: any) => {
          logSocket(res?.success ? 'info' : 'warn', `Room join response for "${projectId}":`, res);
        });
      });
    });

    socket.on('disconnect', (reason, description) => {
      logSocket('warn', `Disconnected from server. Reason: "${reason}"`, { reason, description });
    });

    socket.on('connect_error', (error) => {
      const activeTransport = socket?.io?.engine?.transport?.name || 'unknown';
      logSocket('error', `Connection error: ${error.message}`, {
        errorMessage: error.message,
        errorObject: error,
        activeTransport,
        targetUrl: socketUrl || '(same origin)',
        diagnostic: !socketUrl && !isLocalhost
          ? 'Running on same-origin. Verify backend WebSocket/polling server is active.'
          : `Connecting to ${socketUrl}. Verify CORS and WebSocket proxy configuration.`,
      });
    });

    socket.io.on('reconnect_attempt', (attempt) => {
      logSocket('info', `Reconnection attempt #${attempt}`);
    });

    socket.io.on('reconnect', (attempt) => {
      logSocket('info', `Reconnected successfully after ${attempt} attempts`);
    });

    socket.io.on('reconnect_failed', () => {
      logSocket('error', `Reconnection failed after maximum attempts`);
    });

    // Expose browser debug tool
    if (typeof window !== 'undefined') {
      (window as any).__FF_SOCKET_DEBUG__ = {
        getSocket: () => socket,
        getStatus: () => ({
          connected: socket?.connected || false,
          id: socket?.id || null,
          transport: socket?.io?.engine?.transport?.name || 'none',
          activeRooms: Array.from(activeProjectRooms),
          currentUserId,
          socketUrl: socketUrl || window.location.origin,
        }),
        getLogs: () => recentLogs,
        reconnect: () => {
          logSocket('info', 'Manual reconnect triggered via debug tool');
          socket?.disconnect();
          socket?.connect();
        },
        joinRoom: (pid: string) => joinProjectRoom(pid, currentUserId || undefined),
      };
    }
  } else if (userId && (socket.auth as any)?.userId !== userId) {
    currentUserId = userId;
    socket.auth = { userId };
    logSocket('info', `Active user changed to "${userId}". Updating socket auth...`);
    if (socket.connected) {
      socket.emit('authenticate', { userId }, (res: any) => {
        logSocket(res?.success ? 'info' : 'warn', `Dynamic auth response for "${userId}":`, res);
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
  logSocket('info', `Emitting 'join:project' for room: "${projectId}", user: "${userId || currentUserId || '(none)'}"`);
  s.emit('join:project', { projectId, userId: userId || currentUserId }, (res: any) => {
    logSocket(res?.success ? 'info' : 'warn', `'join:project' response for "${projectId}":`, res);
    if (callback) callback(res);
  });
}

/**
 * Leaves a project room and untracks it.
 */
export function leaveProjectRoom(projectId: string) {
  if (!projectId) return;
  activeProjectRooms.delete(projectId);
  logSocket('info', `Leaving room "project:${projectId}"`);
  if (socket) {
    socket.emit('leave:project', { projectId });
  }
}


