import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { app, httpServer } from '../backend/src/server.ts';
import { prisma } from '../backend/lib/prisma.ts';

describe('Production Socket.IO Real-time Multi-User Suite', () => {
  let server: http.Server;
  let serverPort: number;
  let serverUrl: string;

  let ceoUser: any;
  let memberUser: any;
  let testProject: any;

  let clientA: ClientSocketType;
  let clientB: ClientSocketType;

  beforeAll(async () => {
    // 1. Fetch or create users for test
    ceoUser = await prisma.user.findFirst({ where: { role: 'CEO' } });
    if (!ceoUser) {
      ceoUser = await prisma.user.create({
        data: {
          name: 'Eleanor Foley (CEO)',
          email: 'ceo.socket.test@fernfoley.com',
          role: 'CEO',
          department: 'Executive',
        },
      });
    }

    memberUser = await prisma.user.findFirst({ where: { role: 'Employee' } });
    if (!memberUser) {
      memberUser = await prisma.user.create({
        data: {
          name: 'Marcus Bell',
          email: 'member.socket.test@fernfoley.com',
          role: 'Employee',
          department: 'Engineering',
        },
      });
    }

    // 2. Fetch or create a project
    testProject = await prisma.project.findFirst({
      where: {
        OR: [
          { ownerId: ceoUser.id },
          { memberships: { some: { userId: memberUser.id } } },
        ],
      },
    });

    if (!testProject) {
      testProject = await prisma.project.create({
        data: {
          name: 'Socket Realtime Test Project',
          code: 'SOCK-001',
          goal: 'Validate production socket communication',
          sponsor: 'Eleanor Foley',
          ownerId: ceoUser.id,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
          budgetTotal: 10000,
        },
      });
    }

    // Ensure memberUser is a project member
    await prisma.projectMembership.upsert({
      where: {
        projectId_userId: {
          projectId: testProject.id,
          userId: memberUser.id,
        },
      },
      update: {},
      create: {
        projectId: testProject.id,
        userId: memberUser.id,
        role: 'Contributor',
      },
    });

    // 3. Start test HTTP server on an ephemeral port
    await new Promise<void>((resolve) => {
      server = httpServer.listen(0, () => {
        const address = server.address();
        if (typeof address === 'object' && address !== null) {
          serverPort = address.port;
          serverUrl = `http://127.0.0.1:${serverPort}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (clientA) clientA.disconnect();
    if (clientB) clientB.disconnect();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('connects User A and User B to Socket.IO with authentication', async () => {
    // Connect User A (CEO)
    clientA = ClientSocket(serverUrl, {
      auth: { userId: ceoUser.id },
      transports: ['websocket', 'polling'],
    });

    // Connect User B (Member)
    clientB = ClientSocket(serverUrl, {
      auth: { userId: memberUser.id },
      transports: ['websocket', 'polling'],
    });

    await Promise.all([
      new Promise<void>((resolve) => {
        if (clientA.connected) resolve();
        else clientA.on('connect', () => resolve());
      }),
      new Promise<void>((resolve) => {
        if (clientB.connected) resolve();
        else clientB.on('connect', () => resolve());
      }),
    ]);

    expect(clientA.connected).toBe(true);
    expect(clientB.connected).toBe(true);
  });

  it('allows User A and User B to join the project room successfully', async () => {
    const joinA = await new Promise<any>((resolve) => {
      clientA.emit('join:project', testProject.id, (res: any) => resolve(res));
    });

    const joinB = await new Promise<any>((resolve) => {
      clientB.emit('join:project', testProject.id, (res: any) => resolve(res));
    });

    expect(joinA).toEqual({ success: true, room: `project:${testProject.id}` });
    expect(joinB).toEqual({ success: true, room: `project:${testProject.id}` });
  });

  it('User A sends message -> User B receives instantly via socket and User A receives message response immediately', async () => {
    const messageText = `Live Socket Test Message ${Date.now()}`;

    // Setup listener on User B's socket
    const receivedOnBPromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for socket message on User B')), 5000);
      clientB.on('chat:message', (msg: any) => {
        if (msg.body === messageText) {
          clearTimeout(timeout);
          resolve(msg);
        }
      });
    });

    // User A posts message via API
    const response = await fetch(`${serverUrl}/api/projects/${testProject.id}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ceoUser.id,
      },
      body: JSON.stringify({ body: messageText }),
    });

    expect(response.status).toBe(201);
    const sentMessage = await response.json();
    expect(sentMessage.body).toBe(messageText);
    expect(sentMessage.authorId).toBe(ceoUser.id);

    // Verify User B received the socket event instantly
    const socketMessageB = await receivedOnBPromise;
    expect(socketMessageB.id).toBe(sentMessage.id);
    expect(socketMessageB.body).toBe(messageText);
    expect(socketMessageB.authorId).toBe(ceoUser.id);
    expect(socketMessageB.projectId).toBe(testProject.id);
  });

  it('supports typing indicators in real time between User A and User B', async () => {
    const typingPromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for typing indicator on User B')), 5000);
      clientB.on('chat:typing', (data: any) => {
        if (data.projectId === testProject.id && data.isTyping === true) {
          clearTimeout(timeout);
          resolve(data);
        }
      });
    });

    clientA.emit('typing:start', { projectId: testProject.id, userName: ceoUser.name });
    const typingData = await typingPromise;
    expect(typingData.userName).toBe(ceoUser.name);
    expect(typingData.isTyping).toBe(true);
  });
});
