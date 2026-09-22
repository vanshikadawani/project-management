import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import { prisma } from '../backend/lib/prisma.ts';
import { authenticate } from '../backend/server/auth.ts';
import projectsRouter from '../backend/server/routes/projects.ts';
import phasesRouter from '../backend/server/routes/phases.ts';

describe('Project Creation without Automatic Initial Phase', () => {
  let server: http.Server;
  let baseUrl: string;
  let ceoUser: any;
  let poUser: any;
  let createdProjectId: string | null = null;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(authenticate);
    app.use('/api/projects', projectsRouter);
    app.use('/api', phasesRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address: any = server.address();
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });

    // Ensure we have test users or fetch existing ones
    ceoUser = await prisma.user.findFirst({ where: { role: 'CEO' } });
    poUser = await prisma.user.findFirst({ where: { role: 'ProjectOwner' } });

    if (!ceoUser) {
      ceoUser = await prisma.user.create({
        data: {
          email: 'ceo.test@fernfoley.com',
          name: 'CEO Test User',
          role: 'CEO',
        },
      });
    }

    if (!poUser) {
      poUser = await prisma.user.create({
        data: {
          email: 'po.test@fernfoley.com',
          name: 'PO Test User',
          role: 'ProjectOwner',
        },
      });
    }
  });

  afterAll(async () => {
    if (createdProjectId) {
      await prisma.task.deleteMany({ where: { phase: { projectId: createdProjectId } } });
      await prisma.phase.deleteMany({ where: { projectId: createdProjectId } });
      await prisma.projectMembership.deleteMany({ where: { projectId: createdProjectId } });
      await prisma.changeLogEntry.deleteMany({ where: { projectId: createdProjectId } });
      await prisma.project.deleteMany({ where: { id: createdProjectId } });
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('creates a project with ONLY membership and changelog, and NO automatic phases', async () => {
    const res = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': poUser.id,
      },
      body: JSON.stringify({
        name: 'Test Blank Project Verification',
        goal: 'Verify project creates with zero phases',
        sponsor: 'Audit Board',
        startDate: '2026-10-01',
        endDate: '2026-12-31',
        plannedBudget: 50000,
        contingency: 5000,
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    createdProjectId = data.id;

    // Verify response structure
    expect(data.id).toBeDefined();
    expect(data.name).toBe('Test Blank Project Verification');
    expect(data.phases).toBeDefined();
    expect(data.phases.length).toBe(0);

    // Verify database records
    const dbPhases = await prisma.phase.findMany({
      where: { projectId: createdProjectId },
    });
    expect(dbPhases.length).toBe(0);

    // Verify project membership exists
    const memberships = await prisma.projectMembership.findMany({
      where: { projectId: createdProjectId },
    });
    expect(memberships.length).toBeGreaterThanOrEqual(1);
    expect(memberships.some((m) => m.userId === poUser.id && m.role === 'Owner')).toBe(true);

    // Verify change log entry exists
    const changelog = await prisma.changeLogEntry.findMany({
      where: { projectId: createdProjectId },
    });
    expect(changelog.length).toBeGreaterThanOrEqual(1);
    expect(changelog.some((c) => c.action === 'PROJECT_CREATED')).toBe(true);
  });

  it('allows Project Owner to manually create Phase 1 using Add Phase endpoint', async () => {
    expect(createdProjectId).toBeDefined();

    const res = await fetch(`${baseUrl}/api/projects/${createdProjectId}/phases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': poUser.id,
      },
      body: JSON.stringify({
        name: 'Manual Phase 1: Discovery',
        order: 1,
        plannedStart: '2026-10-01',
        plannedEnd: '2026-10-31',
      }),
    });

    expect(res.status).toBe(201);
    const phase = await res.json();
    expect(phase.name).toBe('Manual Phase 1: Discovery');
    expect(phase.order).toBe(1);

    const dbPhases = await prisma.phase.findMany({
      where: { projectId: createdProjectId! },
    });
    expect(dbPhases.length).toBe(1);
    expect(dbPhases[0].name).toBe('Manual Phase 1: Discovery');
  });
});
