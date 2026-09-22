import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import { prisma } from '../backend/lib/prisma.ts';
import { authenticate } from '../backend/server/auth.ts';
import authRouter from '../backend/server/routes/auth.ts';
import projectsRouter from '../backend/server/routes/projects.ts';
import approvalsRouter from '../backend/server/routes/approvals.ts';
import portfolioRouter from '../backend/server/routes/portfolio.ts';
import documentsRouter from '../backend/server/routes/documents.ts';
import issuesRouter from '../backend/server/routes/issues.ts';
import risksRouter from '../backend/server/routes/risks.ts';
import workloadRouter from '../backend/server/routes/workload.ts';
import budgetRouter from '../backend/server/routes/budget.ts';
import baselinesRouter from '../backend/server/routes/baselines.ts';
import chatRouter from '../backend/server/routes/chat.ts';

describe('AUTHENTICATION + ACCOUNT + ROLE AUDIT SUITE', () => {
  let server: http.Server;
  let baseUrl: string;
  let ceoUser: any;
  let poUser: any;
  let empUser: any;
  let nonMemberEmp: any;
  let sampleProject: any;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(authenticate);

    // Mount routes
    app.use('/api/auth', authRouter);
    app.use('/api/projects', projectsRouter);
    app.use('/api/approvals', approvalsRouter);
    app.use('/api/portfolio', portfolioRouter);
    app.use('/api', documentsRouter);
    app.use('/api/issues', issuesRouter);
    app.use('/api/risks', risksRouter);
    app.use('/api/workload', workloadRouter);
    app.use('/api/projects', budgetRouter);
    app.use('/api/projects', baselinesRouter);
    app.use('/api', chatRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address: any = server.address();
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });

    // Seed or retrieve test users
    ceoUser = await prisma.user.findFirst({ where: { role: 'CEO' } });
    if (!ceoUser) {
      ceoUser = await prisma.user.create({
        data: {
          name: 'Eleanor Vance (CEO)',
          email: 'eleanor.vance@fernfoley.com',
          role: 'CEO',
          department: 'Executive',
        },
      });
    }

    poUser = await prisma.user.findFirst({ where: { role: 'ProjectOwner' } });
    if (!poUser) {
      poUser = await prisma.user.create({
        data: {
          name: 'Marcus Holloway (PO)',
          email: 'marcus.h@fernfoley.com',
          role: 'ProjectOwner',
          department: 'Engineering',
        },
      });
    }

    empUser = await prisma.user.findFirst({
      where: { role: 'Employee', email: 'david.kim@fernfoley.com' },
    });
    if (!empUser) {
      empUser = await prisma.user.create({
        data: {
          name: 'David Kim (Emp)',
          email: 'david.kim@fernfoley.com',
          role: 'Employee',
          department: 'Engineering',
        },
      });
    }

    nonMemberEmp = await prisma.user.findFirst({
      where: { role: 'Employee', email: 'nonmember.emp@fernfoley.com' },
    });
    if (!nonMemberEmp) {
      nonMemberEmp = await prisma.user.create({
        data: {
          name: 'NonMember Employee',
          email: 'nonmember.emp@fernfoley.com',
          role: 'Employee',
          department: 'Marketing',
        },
      });
    }

    // Ensure sample project owned by poUser with empUser as member (but nonMemberEmp NOT a member)
    sampleProject = await prisma.project.findFirst({
      where: { ownerId: poUser.id },
      include: { memberships: true },
    });

    if (!sampleProject) {
      sampleProject = await prisma.project.create({
        data: {
          name: 'Audit Target Project',
          goal: 'Testing RBAC and Auth',
          sponsor: 'Executive Board',
          ownerId: poUser.id,
          startDate: new Date('2026-09-01'),
          endDate: new Date('2026-12-31'),
          plannedBudget: 100000,
          contingency: 10000,
          spendToDate: 25000,
          memberships: {
            create: [
              { userId: poUser.id, role: 'Owner' },
              { userId: empUser.id, role: 'Member' },
            ],
          },
        },
        include: { memberships: true },
      });
    } else {
      // Make sure empUser is member
      const isMember = sampleProject.memberships.some((m: any) => m.userId === empUser.id);
      if (!isMember) {
        await prisma.projectMembership.create({
          data: {
            projectId: sampleProject.id,
            userId: empUser.id,
            role: 'Member',
          },
        });
      }
    }
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  // 1. SIGNUP / CREATE ACCOUNT
  describe('1. CREATE ACCOUNT / SIGN UP', () => {
    it('successfully creates an Employee account with valid fields', async () => {
      const email = `test.employee.${Date.now()}@fernfoley.com`;
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Alice Wonder',
          email,
          department: 'Design',
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe(email);
      expect(data.user.role).toBe('Employee');
      expect(data.user.department).toBe('Design');

      // Verify session cookie was set
      const cookie = res.headers.get('set-cookie');
      expect(cookie).toBeTruthy();
      expect(cookie).toContain('ff_user_id=');
      expect(cookie).toContain('HttpOnly');
    });

    it('rejects signup with invalid/missing name or invalid email', async () => {
      const res1 = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'A', email: 'valid@fernfoley.com' }),
      });
      expect(res1.status).toBe(400);

      const res2 = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Valid Name', email: 'notanemail' }),
      });
      expect(res2.status).toBe(400);
    });

    it('rejects duplicate email registrations', async () => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Duplicate Test',
          email: ceoUser.email,
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('already exists');
    });

    it('CRITICAL SECURITY: Prevents client payload spoofing of CEO role upon signup', async () => {
      const email = `spoof.ceo.${Date.now()}@fernfoley.com`;
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Malicious Attacker',
          email,
          role: 'CEO', // Client attempts privilege escalation to CEO
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      // Server must NOT grant CEO role; must sanitize to Employee
      expect(data.user.role).toBe('Employee');
      expect(data.user.role).not.toBe('CEO');
    });
  });

  // 2. LOGIN
  describe('2. LOGIN', () => {
    it('authenticates with valid email and returns user + sets cookie', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: poUser.email }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.id).toBe(poUser.id);
      expect(data.user.role).toBe('ProjectOwner');

      const cookie = res.headers.get('set-cookie');
      expect(cookie).toContain(`ff_user_id=${poUser.id}`);
      expect(cookie).toContain('HttpOnly');
    });

    it('authenticates with valid userId and sets cookie', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: ceoUser.id }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.id).toBe(ceoUser.id);
      expect(data.user.role).toBe('CEO');
    });

    it('rejects non-existent credentials with 401 Unauthorized', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ghost.user@nonexistent.domain' }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Invalid credentials');
    });
  });

  // 3. LOGOUT
  describe('3. LOGOUT', () => {
    it('destroys session and sets expired Max-Age=0 cookie', async () => {
      const res = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Cookie: `ff_user_id=${ceoUser.id}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const cookie = res.headers.get('set-cookie');
      expect(cookie).toContain('Max-Age=0');
    });

    it('after logout, /api/auth/me returns currentUser: null', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {}, // No cookie
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.currentUser).toBeNull();
      expect(Array.isArray(data.directory)).toBe(true);
    });
  });

  // 4. SESSION PERSISTENCE
  describe('4. SESSION PERSISTENCE', () => {
    it('persists session across requests when ff_user_id cookie is present', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          Cookie: `ff_user_id=${poUser.id}`,
        },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.currentUser).toBeDefined();
      expect(data.currentUser.id).toBe(poUser.id);
      expect(data.currentUser.role).toBe('ProjectOwner');
    });
  });

  // 5. AUTHENTICATED USER
  describe('5. AUTHENTICATED USER PROFILE', () => {
    it('returns exact user profile matching database', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Cookie: `ff_user_id=${empUser.id}` },
      });

      const data = await res.json();
      expect(data.currentUser.id).toBe(empUser.id);
      expect(data.currentUser.name).toBe(empUser.name);
      expect(data.currentUser.role).toBe('Employee');
      expect(data.currentUser.email).toBe(empUser.email);
    });
  });

  // 6. ROLE ASSIGNMENT & 7. ROLE-BASED ACCESS
  describe('6 & 7. ROLE ASSIGNMENT & ROLE-BASED ACCESS', () => {
    it('CEO has full access to Executive Portfolio', async () => {
      const res = await fetch(`${baseUrl}/api/portfolio`, {
        headers: { Cookie: `ff_user_id=${ceoUser.id}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.projects).toBeDefined();
    });

    it('Employee and Project Owner CANNOT access Executive Portfolio (403 Forbidden)', async () => {
      const res1 = await fetch(`${baseUrl}/api/portfolio`, {
        headers: { Cookie: `ff_user_id=${empUser.id}` },
      });
      expect(res1.status).toBe(403);

      const res2 = await fetch(`${baseUrl}/api/portfolio`, {
        headers: { Cookie: `ff_user_id=${poUser.id}` },
      });
      expect(res2.status).toBe(403);
    });

    it('CEO can decide/approve executive decisions', async () => {
      // Find or create pending approval requested by PO and assigned to CEO
      let approval = await prisma.approvalRequest.create({
        data: {
          projectId: sampleProject.id,
          type: 'Scope',
          summary: 'Audit Executive Approval Request',
          detail: 'Validating CEO approval flow',
          impact: 'High',
          requestedBy: poUser.id,
          approverId: ceoUser.id,
          state: 'Pending',
          payload: JSON.stringify({}),
        },
      });

      const res = await fetch(`${baseUrl}/api/approvals/${approval.id}/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `ff_user_id=${ceoUser.id}`,
        },
        body: JSON.stringify({ action: 'APPROVE', decisionNote: 'Approved by CEO in audit' }),
      });
      expect(res.status).toBe(200);
    });

    it('Employee CANNOT approve approvals (403 Forbidden)', async () => {
      let approval = await prisma.approvalRequest.create({
        data: {
          projectId: sampleProject.id,
          type: 'Budget',
          summary: 'Emp Block Approval Request',
          detail: 'Testing unauthorized decision by Employee',
          impact: 'Medium',
          requestedBy: poUser.id,
          approverId: ceoUser.id,
          state: 'Pending',
          payload: JSON.stringify({}),
        },
      });

      const res = await fetch(`${baseUrl}/api/approvals/${approval.id}/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `ff_user_id=${empUser.id}`,
        },
        body: JSON.stringify({ action: 'APPROVE', decisionNote: 'Malicious attempt' }),
      });
      expect(res.status).toBe(403);
    });
  });

  // 8. PROJECT MEMBERSHIP
  describe('8. PROJECT MEMBERSHIP ENFORCEMENT', () => {
    it('Project Owner can access their owned project', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${sampleProject.id}`, {
        headers: { Cookie: `ff_user_id=${poUser.id}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(sampleProject.id);
    });

    it('Assigned Employee member can access the project', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${sampleProject.id}`, {
        headers: { Cookie: `ff_user_id=${empUser.id}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(sampleProject.id);
    });

    it('Non-member Employee is BLOCKED from accessing non-member project (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${sampleProject.id}`, {
        headers: { Cookie: `ff_user_id=${nonMemberEmp.id}` },
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toMatch(/Forbidden|Access denied/i);
    });

    it('CEO can access ANY project regardless of membership', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${sampleProject.id}`, {
        headers: { Cookie: `ff_user_id=${ceoUser.id}` },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe(sampleProject.id);
    });
  });

  // 9 & 10. PROTECTED ROUTES & APIS
  describe('9 & 10. PROTECTED ROUTES AND APIS', () => {
    it('Unauthenticated requests to protected APIs are rejected with 401', async () => {
      const endpoints = [
        `${baseUrl}/api/projects`,
        `${baseUrl}/api/projects/${sampleProject.id}`,
        `${baseUrl}/api/portfolio`,
        `${baseUrl}/api/approvals`,
        `${baseUrl}/api/projects/${sampleProject.id}/documents`,
        `${baseUrl}/api/projects/${sampleProject.id}/chat`,
        `${baseUrl}/api/issues`,
        `${baseUrl}/api/risks`,
        `${baseUrl}/api/workload`,
      ];

      for (const endpoint of endpoints) {
        const res = await fetch(endpoint, {
          headers: {}, // No cookie
        });
        expect([401, 403]).toContain(res.status);
      }
    });

    it('Direct URL payload tampering: Employee cannot create project (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `ff_user_id=${empUser.id}`,
        },
        body: JSON.stringify({
          name: 'Unauthorized Employee Project',
          goal: 'Hacking project creation',
          sponsor: 'Self',
          ownerId: empUser.id,
          startDate: new Date(),
          endDate: new Date(),
        }),
      });

      expect(res.status).toBe(403);
    });

    it('Direct URL payload tampering: Employee cannot modify project baseline snapshot (403 Forbidden)', async () => {
      const res = await fetch(`${baseUrl}/api/projects/${sampleProject.id}/baselines`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `ff_user_id=${empUser.id}`,
        },
        body: JSON.stringify({
          name: 'Unauthorized Baseline Snapshot',
        }),
      });

      expect(res.status).toBe(403);
    });
  });
});
