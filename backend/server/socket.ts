import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { prisma } from '../lib/prisma.ts';

let io: SocketIOServer | null = null;

// Helper to authenticate a socket with a given userId
export async function authenticateSocket(socket: Socket, userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (user) {
      socket.data.user = user;
      socket.join(`user:${user.id}`);
      return true;
    }
  } catch (err) {
    console.error('Socket user lookup error:', err);
  }
  return false;
}

export function initSocket(httpServer: HTTPServer): SocketIOServer {
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
    try {
      // Check auth object, query parameters, custom headers, or cookie
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

      if (userId) {
        await authenticateSocket(socket, userId);
      }
      next();
    } catch (err) {
      console.error('Socket authentication error:', err);
      next();
    }
  });

  io.on('connection', (socket: Socket) => {
    // If authenticated during handshake, join user's private room for direct notifications
    if (socket.data?.user?.id) {
      socket.join(`user:${socket.data.user.id}`);
    }

    // Dynamic authentication event for post-handshake user identification
    socket.on('authenticate', async ({ userId }: { userId: string }, callback?: (res: any) => void) => {
      if (userId) {
        const success = await authenticateSocket(socket, userId);
        if (success) {
          if (callback) callback({ success: true, user: socket.data.user });
          return;
        }
      }
      if (callback) callback({ error: 'Authentication failed' });
    });

    // Join Project Room with membership check
    socket.on('join:project', async (projectId: string, callback?: (res: any) => void) => {
      try {
        if (!projectId) {
          if (callback) callback({ error: 'Project ID is required' });
          return;
        }

        // Dynamically resolve user from socket.data or fallback handshake credentials
        let user = socket.data?.user;
        if (!user?.id) {
          const fallbackUserId = socket.handshake.auth?.userId || socket.handshake.query?.userId;
          if (fallbackUserId) {
            await authenticateSocket(socket, fallbackUserId as string);
            user = socket.data?.user;
          }
        }

        // Must be authenticated
        if (!user?.id) {
          if (callback) callback({ error: 'Unauthorized: Authentication required' });
          return;
        }

        // Check permission: CEO or Project Owner of this project or Project Member or task assignee
        if (user.role !== 'CEO') {
          const isOwner = await prisma.project.findFirst({
            where: { id: projectId, ownerId: user.id },
          });
          const member = await prisma.projectMembership.findUnique({
            where: {
              projectId_userId: {
                projectId,
                userId: user.id,
              },
            },
          });
          const hasTask = !isOwner && !member && (await prisma.task.findFirst({
            where: { assigneeId: user.id, phase: { projectId } },
          }));

          if (!member && !isOwner && !hasTask) {
            if (callback) callback({ error: 'Unauthorized to join project room' });
            return;
          }
        }

        socket.join(`project:${projectId}`);
        if (callback) callback({ success: true, room: `project:${projectId}` });
      } catch (err) {
        if (callback) callback({ error: 'Failed to join room' });
      }
    });

    // Leave Project Room
    socket.on('leave:project', (projectId: string) => {
      if (projectId) {
        socket.leave(`project:${projectId}`);
      }
    });

    // Typing Indicators
    socket.on('typing:start', ({ projectId, userName }: { projectId: string; userName: string }) => {
      if (projectId) {
        socket.to(`project:${projectId}`).emit('chat:typing', { projectId, userName, isTyping: true });
      }
    });

    socket.on('typing:stop', ({ projectId, userName }: { projectId: string; userName: string }) => {
      if (projectId) {
        socket.to(`project:${projectId}`).emit('chat:typing', { projectId, userName, isTyping: false });
      }
    });

    socket.on('disconnect', () => {
      // Clean up
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitToUser(userId: string, event: string, data: any) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

export function emitToProject(projectId: string, event: string, data: any) {
  if (io) {
    io.to(`project:${projectId}`).emit(event, data);
  }
}
