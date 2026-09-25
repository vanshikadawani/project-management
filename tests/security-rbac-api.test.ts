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

describe('Security, RBAC & API Enforcement Suite', () => {
  let server: http.Server;
  let baseUrl: string;
  let ceoUser: any;
  let poMarcus: any;
  let poSarah: any;
  let empDavid: any;
  let empLiam: any;
  let testProject: any;
  let testPhase: any;

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

    // Lookup or create test users
    ceoUser = await prisma.user.upsert({
      where: { email: 'eleanor.foley@fernandfoley.internal' },
      update: {},
      create: { name: 'Eleanor Foley', email: 'eleanor.foley@fernandfoley.internal', role: 'CEO', department: 'Executive' },
    });
    poMarcus = await prisma.user.upsert({
      where: { email: 'marcus.vance@fernandfoley.internal' },
      update: {},
      create: { name: 'Marcus Vance', email: 'marcus.vance@fernandfoley.internal', role: 'ProjectOwner', department: 'Operations' },
    });
    poSarah = await prisma.user.upsert({
      where: { email: 'sarah.chen@fernandfoley.internal' },
      update: {},
      create: { name: 'Sarah Chen', email: 'sarah.chen@fernandfoley.internal', role: 'ProjectOwner', department: 'Operations' },
    });
    empDavid = await prisma.user.upsert({
      where: { email: 'david.ross@fernandfoley.internal' },
      update: {},
      create: { name: 'David Ross', email: 'david.ross@fernandfoley.internal', role: 'Employee', department: 'Engineering' },
    });
    empLiam = await prisma.user.upsert({
      where: { email: 'liam.thorne@fernandfoley.internal' },
      update: {},
      create: { name: 'Liam Thorne', email: 'liam.thorne@fernandfoley.internal', role: 'Employee', department: 'Engineering' },
    });

    // Create test project owned by Marcus Vance
    testProject = await prisma.project.create({
      data: {
        name: 'RBAC Security Test Facility',
        goal: 'Validate comprehensive RBAC and operational constraints',
        sponsor: 'Eleanor Foley',
        ownerId: poMarcus.id,
        startDate: new Date('2026-09-01'),
        endDate: new Date('2026-12-31'),
        plannedBudget: 100000,
        contingency: 10000,
        spendToDate: 20000,
      },
    });

    // Memberships: Marcus (Owner), David (Member). Liam is NOT a member.
    await prisma.projectMembership.createMany({
      data: [
        { projectId: testProject.id, userId: poMarcus.id, role: 'Owner' },
        { projectId: testProject.id, userId: empDavid.id, role: 'Member' },
      ],
    });

    testPhase = await prisma.phase.create({
      data: {
        projectId: testProject.id,
        name: 'Phase A: Initial Setup',
        order: 1,
        plannedStart: new Date('2026-09-01'),
        plannedEnd: new Date('2026-10-15'),
        plannedBudget: 40000,
        spendToDate: 5000,
      },
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (testProject) {
      await prisma.project.delete({ where: { id: testProject.id } }).catch(() => {});
    }
  });

  describe('1. Unauthenticated Access Protection (401 Unauthorized)', () => {
    it('rejects unauthenticated GET /api/projects', async () => {
      const res = await fetch(`${baseUrl}/api/projects`);
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated GET /api/portfolio', async () => {
      const res = await fetch(`${baseUrl}/api/portfolio`);
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated GET /api/projects/:id/budget', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${testProject.id}/budget`);
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated POST /api/approvals', async () => {
      const res = await fetch(`${baseUrl}/api/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: testProject.id, type: 'Budget', summary: 'x', detail: 'y' }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('2. Employee RBAC Restrictions (403 Forbidden)', () => {
    it('Employee cannot access CEO Executive Portfolio', async () => {
      const res = await fetch(`${baseUrl}/api/portfolio`, {
        headers: { Authorization: `Bearer ${empDavid.id}` },
      });
      expect(res.status).toBe(403);
    });

    it('Employee cannot access confidential project budget figures', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${testProject.id}/budget`, {
        headers: { Authorization: `Bearer ${empDavid.id}` },
      });
      expect(res.status).toBe(403);
    });

    it('Employee cannot create new tasks', async () => {
      const res = await fetch(`${baseUrl}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${empDavid.id}`,
        },
        body: JSON.stringify({
          phaseId: testPhase.id,
          title: 'Unauthorized Task Creation',
          plannedStart: '2026-09-10',
          plannedEnd: '2026-09-20',
          plannedHours: 10,
        }),
      });
      expect(res.status).toBe(403);
    });

    it('Employee cannot create project phases', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${testProject.id}/phases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${empDavid.id}`,
        },
        body: JSON.stringify({
          name: 'Unauthorized Phase',
          plannedStart: '2026-10-01',
          plannedEnd: '2026-10-30',
        }),
      });
      expect(res.status).toBe(403);
    });

    it('Employee cannot create milestones', async () => {
      const res = await fetch(`${baseUrl}/api/milestones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${empDavid.id}`,
        },
        body: JSON.stringify({
          projectId: testProject.id,
          title: 'Unauthorized Milestone',
          baselineDate: '2026-10-01',
          forecastDate: '2026-10-01',
        }),
      });
      expect(res.status).toBe(403);
    });

    it('Employee cannot edit project charter', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${testProject.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${empDavid.id}`,
        },
        body: JSON.stringify({ name: 'Tampered Project Name' }),
      });
      expect(res.status).toBe(403);
    });

    it('Employee cannot close an issue raised and owned by someone else', async () => {
      const foreignIssue = await prisma.issue.create({
        data: {
          projectId: testProject.id,
          title: 'High Voltage Conduit Crack',
          detail: 'Inspection detected fault',
          severity: 'Critical',
          state: 'Open',
          ownerId: poMarcus.id,
          raisedBy: poMarcus.id,
        },
      });

      const res = await fetch(`${baseUrl}/api/issues/${foreignIssue.id}/close`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${empDavid.id}` },
      });
      expect(res.status).toBe(403);

      // Clean up
      await prisma.issue.delete({ where: { id: foreignIssue.id } });
    });

    it('Employee CAN close their own issue', async () => {
      const ownIssue = await prisma.issue.create({
        data: {
          projectId: testProject.id,
          title: 'Lubricant delivery box misplaced',
          detail: 'Found on shelf B3',
          severity: 'Minor',
          state: 'Open',
          ownerId: poMarcus.id,
          raisedBy: empDavid.id, // Raised by David
        },
      });

      const res = await fetch(`${baseUrl}/api/issues/${ownIssue.id}/close`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${empDavid.id}` },
      });
      expect(res.status).toBe(200);

      // Clean up
      await prisma.issue.delete({ where: { id: ownIssue.id } });
    });
  });

  describe('3. Non-Member Isolation', () => {
    it('rejects access to project chat from a user who is not a member', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${testProject.id}/chat`, {
        headers: { Authorization: `Bearer ${empLiam.id}` },
      });
      expect(res.status).toBe(403);
    });

    it('rejects document access from a non-member', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${testProject.id}/documents`, {
        headers: { Authorization: `Bearer ${empLiam.id}` },
      });
      expect(res.status).toBe(403);
    });
  });

  describe('4. Project Owner Permissions & Cross-Project Isolation', () => {
    it('Project Owner can view budget for their owned project', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${testProject.id}/budget`, {
        headers: { Authorization: `Bearer ${poMarcus.id}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.plannedBudget).toBe(100000);
    });

    it('Project Owner cannot view budget for a project owned by another PO', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${testProject.id}/budget`, {
        headers: { Authorization: `Bearer ${poSarah.id}` },
      });
      expect(res.status).toBe(403);
    });

    it('Project Owner cannot access CEO Portfolio', async () => {
      const res = await fetch(`${baseUrl}/api/portfolio`, {
        headers: { Authorization: `Bearer ${poMarcus.id}` },
      });
      expect(res.status).toBe(403);
    });
  });

  describe('5. CEO Full Portfolio Authority', () => {
    it('CEO can access CEO Portfolio', async () => {
      const res = await fetch(`${baseUrl}/api/portfolio`, {
        headers: { Authorization: `Bearer ${ceoUser.id}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.kpis).toBeDefined();
      expect(data.projects.length).toBeGreaterThan(0);
    });

    it('CEO can view any project budget', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${testProject.id}/budget`, {
        headers: { Authorization: `Bearer ${ceoUser.id}` },
      });
      expect(res.status).toBe(200);
    });
  });

  describe('6. Task Risk Flag Synchronization & Deduplication', () => {
    it('flagging task risk creates linked Risk record and prevents duplicates', async () => {
      const task = await prisma.task.create({
        data: {
          phaseId: testPhase.id,
          title: 'Specialized optical alignment task',
          plannedStart: new Date('2026-09-10'),
          plannedEnd: new Date('2026-09-15'),
          plannedHours: 12,
          state: 'In progress',
        },
      });

      // Flag task risk
      const flagRes = await fetch(`${baseUrl}/api/tasks/${task.id}/risk-flag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${poMarcus.id}`,
        },
        body: JSON.stringify({ reason: 'Optical prism supplier delay risk' }),
      });
      expect(flagRes.status).toBe(200);

      // Verify risk register entry was created
      const risks = await prisma.risk.findMany({
        where: { taskId: task.id, closedAt: null },
      });
      expect(risks.length).toBe(1);
      expect(risks[0].description).toContain('Optical prism');

      // Flag again -> should update existing and NOT create duplicate
      await fetch(`${baseUrl}/api/tasks/${task.id}/risk-flag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${poMarcus.id}`,
        },
        body: JSON.stringify({ reason: 'Optical prism supplier delay risk - revised 2 weeks' }),
      });

      const risksAfter = await prisma.risk.findMany({
        where: { taskId: task.id, closedAt: null },
      });
      expect(risksAfter.length).toBe(1);

      // Unflag risk -> closes open risk register entry
      const unflagRes = await fetch(`${baseUrl}/api/tasks/${task.id}/risk-flag`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${poMarcus.id}` },
      });
      expect(unflagRes.status).toBe(200);

      const openRisks = await prisma.risk.findMany({
        where: { taskId: task.id, closedAt: null },
      });
      expect(openRisks.length).toBe(0);

      // Clean up
      await prisma.risk.deleteMany({ where: { taskId: task.id } });
      await prisma.task.delete({ where: { id: task.id } });
    });
  });

  describe('7. Phase Deletion Business Rule', () => {
    it('rejects deletion of a phase that contains tasks', async () => {
      const task = await prisma.task.create({
        data: {
          phaseId: testPhase.id,
          title: 'Anchoring task',
          plannedStart: new Date('2026-09-02'),
          plannedEnd: new Date('2026-09-05'),
          plannedHours: 8,
        },
      });

      const deleteRes = await fetch(`${baseUrl}/api/phases/${testPhase.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${poMarcus.id}` },
      });
      expect(deleteRes.status).toBe(400);
      const body = await deleteRes.json();
      expect(body.error).toContain('cannot be deleted');

      // Clean up task
      await prisma.task.delete({ where: { id: task.id } });
    });
  });

  describe('8. Approval Self-Approval Prevention & Escalation', () => {
    it('escalates to CEO when requester is Project Owner and rejects self-approval', async () => {
      // Marcus Vance (PO) submits a budget approval within contingency
      const submitRes = await fetch(`${baseUrl}/api/approvals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${poMarcus.id}`,
        },
        body: JSON.stringify({
          projectId: testProject.id,
          type: 'Budget',
          summary: 'Additional scaffolding hire',
          detail: 'Required for ceiling conduit access',
          requestedAmount: 3000,
        }),
      });

      expect(submitRes.status).toBe(201);
      const approval = await submitRes.json();

      // Escalated to CEO because requester is the Project Owner!
      expect(approval.approverId).toBe(ceoUser.id);

      // Marcus attempts to self-approve -> Forbidden!
      const selfApproveRes = await fetch(`${baseUrl}/api/approvals/${approval.id}/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${poMarcus.id}`,
        },
        body: JSON.stringify({ action: 'APPROVE' }),
      });
      expect(selfApproveRes.status).toBe(403);
      const failBody = await selfApproveRes.json();
      expect(failBody.error).toContain('Self-approval is forbidden');

      // CEO approves -> Success!
      const ceoApproveRes = await fetch(`${baseUrl}/api/approvals/${approval.id}/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ceoUser.id}`,
        },
        body: JSON.stringify({ action: 'APPROVE', decisionNote: 'Approved by CEO Foley' }),
      });
      expect(ceoApproveRes.status).toBe(200);

      // Clean up approval
      await prisma.approvalRequest.delete({ where: { id: approval.id } });
    });
  });

  describe('9. Cross-Project Isolation & Access Boundary Tests', () => {
    it('prevents Project Owner Sarah from creating phases on Marcus project', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${testProject.id}/phases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${poSarah.id}`,
        },
        body: JSON.stringify({
          name: 'Sarah Rogue Phase',
          plannedStart: '2026-09-01',
          plannedEnd: '2026-09-30',
        }),
      });
      expect(res.status).toBe(403);
    });

    it('prevents Project Owner Sarah from creating milestones on Marcus project', async () => {
      const res = await fetch(`${baseUrl}/api/milestones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${poSarah.id}`,
        },
        body: JSON.stringify({
          projectId: testProject.id,
          title: 'Sarah Rogue Milestone',
          baselineDate: '2026-09-15',
          forecastDate: '2026-09-15',
        }),
      });
      expect(res.status).toBe(403);
    });

    it('prevents non-member Liam from viewing project change log', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${testProject.id}/changelog`, {
        headers: { Authorization: `Bearer ${empLiam.id}` },
      });
      expect(res.status).toBe(403);
    });

    it('allows project member David to view project change log', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${testProject.id}/changelog`, {
        headers: { Authorization: `Bearer ${empDavid.id}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('changeLogs');
    });

    it('masks budget figures on baseline compare endpoint for Employee David', async () => {
      // First establish baseline by Marcus (PO)
      await fetch(`${baseUrl}/api/projects/${testProject.id}/baselines`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${poMarcus.id}`,
        },
        body: JSON.stringify({ name: 'Baseline 1' }),
      });

      // Employee David sees 0 for budget figures
      const empRes = await fetch(`${baseUrl}/api/projects/${testProject.id}/baselines/compare`, {
        headers: { Authorization: `Bearer ${empDavid.id}` },
      });
      expect(empRes.status).toBe(200);
      const empData = await empRes.json();
      expect(empData.hasBaseline).toBe(true);
      expect(empData.budgetComparison.currentBudget).toBe(0);
      expect(empData.budgetComparison.baselinedBudget).toBe(0);
      expect(empData.budgetComparison.deltaBudget).toBe(0);

      // Project Owner Marcus sees real budget figures
      const poRes = await fetch(`${baseUrl}/api/projects/${testProject.id}/baselines/compare`, {
        headers: { Authorization: `Bearer ${poMarcus.id}` },
      });
      expect(poRes.status).toBe(200);
      const poData = await poRes.json();
      expect(poData.budgetComparison.currentBudget).toBe(testProject.plannedBudget);
    });

    it('prevents Employee David from closing an issue raised by someone else', async () => {
      // Create issue raised by Marcus
      const issue = await prisma.issue.create({
        data: {
          projectId: testProject.id,
          title: 'Roof moisture inspection issue',
          detail: 'Requires inspection',
          severity: 'Major',
          raisedBy: poMarcus.id,
          ownerId: poMarcus.id,
          state: 'Open',
        },
      });

      const closeRes = await fetch(`${baseUrl}/api/issues/${issue.id}/close`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${empDavid.id}` },
      });
      expect(closeRes.status).toBe(403);

      // But Marcus (Project Owner) can close it
      const ownerCloseRes = await fetch(`${baseUrl}/api/issues/${issue.id}/close`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${poMarcus.id}` },
      });
      expect(ownerCloseRes.status).toBe(200);

      // Clean up
      await prisma.issue.delete({ where: { id: issue.id } });
    });
  });
});
