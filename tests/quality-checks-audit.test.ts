import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import { prisma } from '../backend/lib/prisma.ts';
import { authenticate } from '../backend/server/auth.ts';
import tasksRouter from '../backend/server/routes/tasks.ts';
import projectsRouter from '../backend/server/routes/projects.ts';

describe('Quality Check Checkbox & Completion Enforcement Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  let poUser: any;
  let empUser: any;
  let testProject: any;
  let testPhase: any;
  let testTask: any;
  let mandatoryQc: any;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(authenticate);

    app.use('/api/projects', projectsRouter);
    app.use('/api/tasks', tasksRouter);
    app.post('/api/quality-checks/:id/toggle', (req, res, next) => {
      req.url = `/quality-checks/${req.params.id}/toggle`;
      tasksRouter(req, res, next);
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address: any = server.address();
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });

    // Lookup PO and Emp users
    poUser = await prisma.user.findFirst({ where: { role: 'ProjectOwner' } });
    empUser = await prisma.user.findFirst({ where: { role: 'Employee' } });

    testProject = await prisma.project.create({
      data: {
        name: 'QC Verification Project',
        goal: 'Test Quality Check Flow',
        sponsor: 'Audit Sponsor',
        ownerId: poUser.id,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-12-31'),
        plannedBudget: 50000,
        contingency: 5000,
        memberships: {
          create: [
            { userId: poUser.id, role: 'Owner' },
            { userId: empUser.id, role: 'Member' },
          ],
        },
      },
    });

    testPhase = await prisma.phase.create({
      data: {
        projectId: testProject.id,
        name: 'Phase 1 QC Tests',
        order: 1,
        plannedStart: new Date('2026-09-01'),
        plannedEnd: new Date('2026-10-15'),
      },
    });

    testTask = await prisma.task.create({
      data: {
        phaseId: testPhase.id,
        title: 'QC Calibration Task',
        assigneeId: empUser.id,
        priority: 'High',
        plannedStart: new Date('2026-09-01'),
        plannedEnd: new Date('2026-09-20'),
        plannedHours: 20,
        state: 'In progress',
      },
    });

    mandatoryQc = await prisma.qualityCheck.create({
      data: {
        taskId: testTask.id,
        label: 'Mandatory torque & pressure verification',
        mandatory: true,
        checkedAt: null,
        checkedBy: null,
      },
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('1. Mandatory check blocks task completion when unchecked', async () => {
    const res = await fetch(`${baseUrl}/api/tasks/${testTask.id}/state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `ff_user_id=${empUser.id}`,
      },
      body: JSON.stringify({ state: 'Completed' }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('mandatory quality check(s) incomplete');
  });

  it('2. Checks off quality check via /api/tasks/quality-checks/:id/toggle and persists to DB', async () => {
    const res = await fetch(`${baseUrl}/api/tasks/quality-checks/${mandatoryQc.id}/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `ff_user_id=${empUser.id}`,
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(mandatoryQc.id);
    expect(data.checkedAt).toBeTruthy();
    expect(data.checkedBy).toBe(empUser.id);

    // Verify DB persistence
    const inDb = await prisma.qualityCheck.findUnique({ where: { id: mandatoryQc.id } });
    expect(inDb?.checkedAt).not.toBeNull();
    expect(inDb?.checkedBy).toBe(empUser.id);
  });

  it('3. Allows completing task when all mandatory checks are checked', async () => {
    const res = await fetch(`${baseUrl}/api/tasks/${testTask.id}/state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `ff_user_id=${empUser.id}`,
      },
      body: JSON.stringify({ state: 'Completed' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.state).toBe('Completed');
  });

  it('4. Unchecks quality check via direct alias /api/quality-checks/:id/toggle and persists', async () => {
    const res = await fetch(`${baseUrl}/api/quality-checks/${mandatoryQc.id}/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `ff_user_id=${empUser.id}`,
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.checkedAt).toBeNull();
    expect(data.checkedBy).toBeNull();

    // Verify DB persistence
    const inDb = await prisma.qualityCheck.findUnique({ where: { id: mandatoryQc.id } });
    expect(inDb?.checkedAt).toBeNull();
    expect(inDb?.checkedBy).toBeNull();
  });

  it('5. Mandatory check blocks task completion again once unchecked', async () => {
    // Reopen task
    await prisma.task.update({
      where: { id: testTask.id },
      data: { state: 'In progress' },
    });

    const res = await fetch(`${baseUrl}/api/tasks/${testTask.id}/state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `ff_user_id=${empUser.id}`,
      },
      body: JSON.stringify({ state: 'Completed' }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('mandatory quality check(s) incomplete');
  });
});
