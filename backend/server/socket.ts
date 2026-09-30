import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { prisma } from '../lib/prisma';
import { canAccessProjectChat } from './routes/chat';

let io: SocketIOServer | null = null;

const isVercel = !!process.env.VERCEL;

// Helper to authenticate a socket with a given userId
export async function authenticateSocket(socket: Socket, userId: string): Promise<boolean> {
  const timestamp = new Date().toISOString();
  try {
    console.log(`[Socket][${timestamp}] Authenticating socket ${socket.id} with userId: "${userId}"`);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (user) {
      socket.data.user = user;
      socket.join(`user:${user.id}`);
      console.log(`[Socket][${timestamp}] Socket ${socket.id} successfully authenticated as "${user.name}" (${user.role}, ID: ${user.id}). Joined room: "user:${user.id}"`);
      return true;
    } else {
      console.warn(`[Socket][${timestamp}] Socket ${socket.id} authentication failed: User ID "${userId}" not found in database`);
    }
  } catch (err: any) {
    console.error(`[Socket][${timestamp}] Socket ${socket.id} database lookup error for user "${userId}":`, err?.message || err);
  }
  return false;
}

export function initSocket(httpServer: HTTPServer): SocketIOServer {
  const envType = isVercel ? 'Vercel Serverless' : 'Node.js Server';
  console.log(`[Socket] Initializing Socket.IO server in [${envType}] environment`);

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow dynamic origin reflection for credentials compatibility across domains
        callback(null, true);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  // Socket Authentication Middleware
  io.use(async (socket: Socket, next) => {
    const timestamp = new Date().toISOString();
    const transport = socket.conn.transport?.name || 'unknown';
    const origin = socket.handshake.headers.origin || socket.handshake.headers.referer || '(none)';
    const clientIp = socket.handshake.address || socket.handshake.headers['x-forwarded-for'] || 'unknown';

    console.log(`[Socket][${timestamp}] Incoming connection attempt: socket=${socket.id}, transport=${transport}, origin=${origin}, IP=${clientIp}`);

    try {
      const authUserId = socket.handshake.auth?.userId;
      const queryUserId = socket.handshake.query?.userId as string | undefined;
      const headerUserId = socket.handshake.headers['x-user-id'] as string | undefined;
      const cookieHeader = socket.handshake.headers.cookie;
      let userId: string | null = authUserId || queryUserId || headerUserId || null;

      if (!userId && cookieHeader) {
        const match = cookieHeader.match(/ff_user_id=([^;]+)/);
        if (match && match[1]) {
          userId = decodeURIComponent(match[1]);
        }
      }

      console.log(`[Socket][${timestamp}] Handshake credentials: authUserId=${authUserId || '(none)'}, queryUserId=${queryUserId || '(none)'}, resolvedUserId=${userId || '(none)'}`);

      if (userId) {
        await authenticateSocket(socket, userId);
      } else {
        console.log(`[Socket][${timestamp}] Socket ${socket.id} connected without initial userId (will wait for 'authenticate' event)`);
      }
      next();
    } catch (err: any) {
      console.error(`[Socket][${timestamp}] Authentication middleware error on socket ${socket.id}:`, err?.message || err);
      next();
    }
  });

  io.on('connection', (socket: Socket) => {
    const timestamp = new Date().toISOString();
    const transport = socket.conn.transport?.name || 'unknown';
    console.log(`[Socket][${timestamp}] Socket connected: ${socket.id} (Initial transport: ${transport}, Authenticated user: ${socket.data?.user?.name || 'Unauthenticated'})`);

    // Listen for transport upgrades (e.g. polling -> websocket)
    socket.conn.on('upgrade', (newTransport) => {
      console.log(`[Socket][${new Date().toISOString()}] Socket ${socket.id} transport upgraded to: ${newTransport.name}`);
    });

    // If authenticated during handshake, join user's private room for direct notifications
    if (socket.data?.user?.id) {
      socket.join(`user:${socket.data.user.id}`);
      console.log(`[Socket][${timestamp}] Auto-joined room "user:${socket.data.user.id}" for socket ${socket.id}`);
    }

    // Dynamic authentication event for post-handshake user identification
    socket.on('authenticate', async ({ userId }: { userId: string }, callback?: (res: any) => void) => {
      const authTime = new Date().toISOString();
      console.log(`[Socket][${authTime}] Received 'authenticate' event on socket ${socket.id} for userId: "${userId}"`);
      if (userId) {
        const success = await authenticateSocket(socket, userId);
        if (success) {
          if (callback) callback({ success: true, user: socket.data.user });
          return;
        }
      }
      console.warn(`[Socket][${authTime}] 'authenticate' event failed for socket ${socket.id} (userId: "${userId}")`);
      if (callback) callback({ error: 'Authentication failed' });
    });

    // Join Project Room with membership check
    socket.on('join:project', async (data: string | { projectId: string; userId?: string }, callback?: (res: any) => void) => {
      const joinTime = new Date().toISOString();
      try {
        const projectId = typeof data === 'string' ? data : data?.projectId;
        const providedUserId = typeof data === 'object' ? data?.userId : undefined;

        console.log(`[Socket][${joinTime}] Socket ${socket.id} requested 'join:project' for project: "${projectId}", providedUserId: "${providedUserId || '(none)'}"`);

        if (!projectId) {
          console.warn(`[Socket][${joinTime}] 'join:project' rejected: Missing projectId`);
          if (callback) callback({ error: 'Project ID is required' });
          return;
        }

        // Dynamically resolve user from socket.data or fallback credentials
        let user = socket.data?.user;
        if (!user?.id) {
          const fallbackUserId = providedUserId || socket.handshake.auth?.userId || socket.handshake.query?.userId;
          if (fallbackUserId) {
            console.log(`[Socket][${joinTime}] Attempting fallback authentication for socket ${socket.id} with userId: "${fallbackUserId}"`);
            await authenticateSocket(socket, fallbackUserId as string);
            user = socket.data?.user;
          }
        }

        // Must be authenticated
        if (!user?.id) {
          console.warn(`[Socket][${joinTime}] Unauthorized 'join:project' for unauthenticated socket ${socket.id} on project ${projectId}`);
          if (callback) callback({ error: 'Unauthorized: Authentication required' });
          return;
        }

        // Check permission using unified canAccessProjectChat
        const hasAccess = await canAccessProjectChat(user.id, user.role, projectId);
        if (!hasAccess) {
          console.warn(`[Socket][${joinTime}] Access denied: User "${user.name}" (${user.role}, ID: ${user.id}) cannot access project ${projectId}`);
          if (callback) callback({ error: 'Unauthorized to join project room' });
          return;
        }

        socket.join(`project:${projectId}`);
        const roomSize = io?.sockets.adapter.rooms.get(`project:${projectId}`)?.size || 1;
        console.log(`[Socket][${joinTime}] User "${user.name}" (${user.id}) successfully joined "project:${projectId}" (Active subscribers in room: ${roomSize})`);
        if (callback) callback({ success: true, room: `project:${projectId}` });
      } catch (err: any) {
        console.error(`[Socket][${joinTime}] Failed to join project room:`, err?.message || err);
        if (callback) callback({ error: 'Failed to join room' });
      }
    });

    // Leave Project Room
    socket.on('leave:project', (data: string | { projectId: string }) => {
      const projectId = typeof data === 'string' ? data : data?.projectId;
      if (projectId) {
        socket.leave(`project:${projectId}`);
        console.log(`[Socket][${new Date().toISOString()}] Socket ${socket.id} left room "project:${projectId}"`);
      }
    });

    // Typing Indicators
    socket.on('typing:start', ({ projectId, userName }: { projectId: string; userName: string }) => {
      if (projectId) {
        console.log(`[Socket][${new Date().toISOString()}] Typing start: "${userName}" in project "${projectId}"`);
        socket.to(`project:${projectId}`).emit('chat:typing', { projectId, userName, isTyping: true });
      }
    });

    socket.on('typing:stop', ({ projectId, userName }: { projectId: string; userName: string }) => {
      if (projectId) {
        console.log(`[Socket][${new Date().toISOString()}] Typing stop: "${userName}" in project "${projectId}"`);
        socket.to(`project:${projectId}`).emit('chat:typing', { projectId, userName, isTyping: false });
      }
    });

    socket.on('disconnect', (reason) => {
      const discTime = new Date().toISOString();
      console.log(`[Socket][${discTime}] Socket disconnected: ${socket.id} (User: ${socket.data?.user?.name || 'Unauthenticated'}, Reason: "${reason}")`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitToUser(userId: string, event: string, data: any) {
  const timestamp = new Date().toISOString();
  if (io) {
    const room = `user:${userId}`;
    const socketsInRoom = io.sockets.adapter.rooms.get(room);
    const count = socketsInRoom ? socketsInRoom.size : 0;
    console.log(`[Socket][${timestamp}] emitToUser -> room: "${room}", event: "${event}", subscribers: ${count}`);
    io.to(room).emit(event, data);
  } else {
    console.warn(`[Socket][${timestamp}] emitToUser called before io is initialized`);
  }
}

export function emitToProject(projectId: string, event: string, data: any) {
  const timestamp = new Date().toISOString();
  if (io) {
    const room = `project:${projectId}`;
    const socketsInRoom = io.sockets.adapter.rooms.get(room);
    const count = socketsInRoom ? socketsInRoom.size : 0;
    console.log(`[Socket][${timestamp}] emitToProject -> room: "${room}", event: "${event}", subscribers: ${count}`);
    io.to(room).emit(event, data);
  } else {
    console.warn(`[Socket][${timestamp}] emitToProject called before io is initialized`);
  }
}

