import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import { prisma } from '../backend/lib/prisma.ts';
import { authenticate } from '../backend/server/auth.ts';
import projectsRouter from '../backend/server/routes/projects.ts';
import phasesRouter from '../backend/server/routes/phases.ts';
import tasksRouter from '../backend/server/routes/tasks.ts';
import issuesRouter from '../backend/server/routes/issues.ts';
import risksRouter from '../backend/server/routes/risks.ts';
import milestonesRouter from '../backend/server/routes/milestones.ts';
import alertsRouter from '../backend/server/routes/alerts.ts';
import workloadRouter from '../backend/server/routes/workload.ts';
import notificationsRouter from '../backend/server/routes/notifications.ts';
import chatRouter from '../backend/server/routes/chat.ts';
import approvalsRouter from '../backend/server/routes/approvals.ts';
import baselinesRouter from '../backend/server/routes/baselines.ts';
import changelogRouter from '../backend/server/routes/changelog.ts';
import budgetRouter from '../backend/server/routes/budget.ts';
import portfolioRouter from '../backend/server/routes/portfolio.ts';
import documentsRouter from '../backend/server/routes/documents.ts';

describe('End-to-End Operational Workflows', () => {
  let server: http.Server;
  let baseUrl: string;
  let ceoId: string;
  let poId: string;
  let employeeId: string;
  let testProjectId: string;
  let testPhaseId: string;

  beforeAll(async () => {
    // Start test express server
    const app = express();
    app.use(express.json());
    app.use(authenticate);

    app.use('/api/projects', projectsRouter);
    app.use('/api', phasesRouter);
    app.use('/api/tasks', tasksRouter);
    app.use('/api/issues', issuesRouter);
    app.use('/api/risks', risksRouter);
    app.use('/api/milestones', milestonesRouter);
    app.use('/api/alerts', alertsRouter);
    app.use('/api/workload', workloadRouter);
    app.use('/api/notifications', notificationsRouter);
    app.use('/api', chatRouter);
    app.use('/api/approvals', approvalsRouter);
    app.use('/api/projects', baselinesRouter);
    app.use('/api/projects', changelogRouter);
    app.use('/api/projects', budgetRouter);
    app.use('/api/portfolio', portfolioRouter);
    app.use('/api', documentsRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address: any = server.address();
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });

    // Lookup seeded users
    const ceo = await prisma.user.findFirst({ where: { role: 'CEO' } });
    const po = await prisma.user.findFirst({ where: { role: 'ProjectOwner' } });
    const emp = await prisma.user.findFirst({ where: { role: 'Employee' } });

    ceoId = ceo!.id;
    poId = po!.id;
    employeeId = emp!.id;

    // Create a dedicated test project
    const project = await prisma.project.create({
      data: {
        name: 'Workflow Integration Test Project',
        goal: 'Deliver verifiable end-to-end integration proof for Fern & Foley operational engine',
        sponsor: 'Executive Operations Committee',
        ownerId: poId,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-10-31'),
        plannedBudget: 50000,
        contingency: 5000,
        spendToDate: 0,
      },
    });
    testProjectId = project.id;

    const phase = await prisma.phase.create({
      data: {
        projectId: testProjectId,
        name: 'Fabrication Phase',
        order: 1,
        plannedStart: new Date('2026-09-01'),
        plannedEnd: new Date('2026-09-30'),
      },
    });
    testPhaseId = phase.id;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    // Clean up created test project
    if (testProjectId) {
      await prisma.project.delete({ where: { id: testProjectId } }).catch(() => {});
    }
  });

  it('1. Enforces Task Dependency Blocking on completion', async () => {
    // Task A: Foundation task
    const taskA = await prisma.task.create({
      data: {
        phaseId: testPhaseId,
        title: 'Task A: Pour concrete base',
        state: 'Not started',
        plannedHours: 20,
        plannedStart: new Date('2026-09-05'),
        plannedEnd: new Date('2026-09-12'),
        assigneeId: employeeId,
      },
    });

    // Task B: Dependent on Task A
    const taskB = await prisma.task.create({
      data: {
        phaseId: testPhaseId,
        title: 'Task B: Bolt steel frame',
        state: 'Not started',
        plannedHours: 15,
        plannedStart: new Date('2026-09-13'),
        plannedEnd: new Date('2026-09-20'),
        dependsOn: taskA.id,
        assigneeId: employeeId,
      },
    });

    // Attempt to complete Task B while Task A is not finished
    const res = await fetch(`${baseUrl}/api/tasks/${taskB.id}/state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${employeeId}`,
      },
      body: JSON.stringify({ state: 'Completed' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('blocking dependency');

    // Now complete Task A
    const resCompleteA = await fetch(`${baseUrl}/api/tasks/${taskA.id}/state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${employeeId}`,
      },
      body: JSON.stringify({ state: 'Completed' }),
    });
    expect(resCompleteA.status).toBe(200);

    // Now complete Task B -> Should succeed!
    const resCompleteB = await fetch(`${baseUrl}/api/tasks/${taskB.id}/state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${employeeId}`,
      },
      body: JSON.stringify({ state: 'Completed' }),
    });
    expect(resCompleteB.status).toBe(200);
  });

  it('2. Enforces Mandatory Quality Checks before completion', async () => {
    const taskWithQC = await prisma.task.create({
      data: {
        phaseId: testPhaseId,
        title: 'Calibrate digital pressure switches',
        state: 'In progress',
        plannedHours: 8,
        plannedStart: new Date('2026-09-10'),
        plannedEnd: new Date('2026-09-15'),
        assigneeId: employeeId,
      },
    });

    const qc = await prisma.qualityCheck.create({
      data: {
        taskId: taskWithQC.id,
        label: 'Check 4-20mA loop with calibrated multimeter',
        mandatory: true,
      },
    });

    // Try completing task directly -> must fail due to mandatory quality check
    const resFail = await fetch(`${baseUrl}/api/tasks/${taskWithQC.id}/state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${employeeId}`,
      },
      body: JSON.stringify({ state: 'Completed' }),
    });
    expect(resFail.status).toBe(400);
    const failBody = await resFail.json();
    expect(failBody.error).toContain('mandatory quality check');

    // Pass the quality check
    const qcPassRes = await fetch(`${baseUrl}/api/tasks/quality-checks/${qc.id}/toggle`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${employeeId}`,
      },
    });
    expect(qcPassRes.status).toBe(200);

    // Now complete task -> should pass!
    const resSuccess = await fetch(`${baseUrl}/api/tasks/${taskWithQC.id}/state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${employeeId}`,
      },
      body: JSON.stringify({ state: 'Completed' }),
    });
    expect(resSuccess.status).toBe(200);
  });

  it('3. Project Owner / CEO Status Override logs immutable audit trail', async () => {
    const reasonText = 'Executive approval to mark project At Risk due to supplier tariff negotiations.';
    const res = await fetch(`${baseUrl}/api/projects/${testProjectId}/status-override`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${poId}`,
      },
      body: JSON.stringify({
        status: 'AT_RISK',
        reason: reasonText,
      }),
    });

    expect(res.status).toBe(200);

    // Verify audit log exists in DB
    const log = await prisma.statusOverrideLog.findFirst({
      where: {
        projectId: testProjectId,
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(log).toBeDefined();
    expect(log?.reason).toBe(reasonText);
    expect(log?.overriddenBy).toBe(poId);
  });

  it('4. Reopening an issue strictly requires non-empty comment', async () => {
    // Raise an issue
    const issue = await prisma.issue.create({
      data: {
        projectId: testProjectId,
        title: 'Emergency stop push button stuck',
        detail: 'Contact block broken inside switch enclosure',
        severity: 'Major',
        state: 'Open',
        ownerId: poId,
        raisedBy: employeeId,
      },
    });

    // Close the issue
    const closeRes = await fetch(`${baseUrl}/api/issues/${issue.id}/close`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${employeeId}` },
    });
    expect(closeRes.status).toBe(200);

    // Attempt reopen with empty comment -> Should fail!
    const failReopenRes = await fetch(`${baseUrl}/api/issues/${issue.id}/reopen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${employeeId}`,
      },
      body: JSON.stringify({ comment: '' }),
    });
    expect(failReopenRes.status).toBe(400);

    // Reopen with valid comment -> Should succeed!
    const validReopenRes = await fetch(`${baseUrl}/api/issues/${issue.id}/reopen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${employeeId}`,
      },
      body: JSON.stringify({ comment: 'Replacement push button arrived with cracked bezel, reopening.' }),
    });
    expect(validReopenRes.status).toBe(200);
    const reopenBody = await validReopenRes.json();
    expect(reopenBody.issue.state).toBe('Open');
    expect(reopenBody.issue.reopenComment).toContain('cracked bezel');
  });
});
