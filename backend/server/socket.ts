import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { prisma } from '../lib/prisma.ts';

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // Socket Authentication Middleware
  io.use(async (socket: Socket, next) => {
    try {
      // Check auth object or cookie
      const authUserId = socket.handshake.auth?.userId;
      const cookieHeader = socket.handshake.headers.cookie;
      let userId: string | null = authUserId || null;

      if (!userId && cookieHeader) {
        const match = cookieHeader.match(/ff_user_id=([^;]+)/);
        if (match && match[1]) {
          userId = decodeURIComponent(match[1]);
        }
      }

      if (!userId) {
        // Allow connection as guest/unauthenticated or reject if desired
        return next();
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true },
      });

      if (user) {
        socket.data.user = user;
      }
      next();
    } catch (err) {
      console.error('Socket authentication error:', err);
      next();
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data?.user;

    // If authenticated, join user's private room for direct notifications
    if (user?.id) {
      socket.join(`user:${user.id}`);
    }

    // Join Project Room with membership check
    socket.on('join:project', async (projectId: string, callback?: (res: any) => void) => {
      try {
        if (!projectId) {
          if (callback) callback({ error: 'Project ID is required' });
          return;
        }

        // Must be authenticated
        if (!user?.id) {
          if (callback) callback({ error: 'Unauthorized: Authentication required' });
          return;
        }

        // Check permission: CEO or Project Owner of this project or Project Member
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

          if (!member && !isOwner) {
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
      // Clean up if needed
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
