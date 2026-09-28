import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { app, httpServer } from '../backend/src/server.ts';
import { prisma } from '../backend/lib/prisma.ts';

describe('Approval Permissions Suite (Owner & CEO dual approval eligibility)', () => {
  let server: http.Server;
  let serverPort: number;
  let baseUrl: string;

  let ceoUser: any;
  let poUser: any;
  let empUser: any;
  let otherPoUser: any;
  let testProject: any;

  beforeAll(async () => {
    // 1. Setup users
    ceoUser = await prisma.user.findFirst({ where: { role: 'CEO' } });
    if (!ceoUser) {
      ceoUser = await prisma.user.create({
        data: {
          name: 'Eleanor Foley (CEO)',
          email: 'ceo.approval.test@fernfoley.com',
          role: 'CEO',
          department: 'Executive',
        },
      });
    }

    poUser = await prisma.user.findFirst({ where: { role: 'ProjectOwner' } });
    if (!poUser) {
      poUser = await prisma.user.create({
        data: {
          name: 'Marcus Bell (PO)',
          email: 'po.approval.test@fernfoley.com',
          role: 'ProjectOwner',
          department: 'Engineering',
        },
      });
    }

    empUser = await prisma.user.findFirst({ where: { role: 'Employee' } });
    if (!empUser) {
      empUser = await prisma.user.create({
        data: {
          name: 'David Song (Emp)',
          email: 'emp.approval.test@fernfoley.com',
          role: 'Employee',
          department: 'Operations',
        },
      });
    }

    otherPoUser = await prisma.user.findFirst({
      where: { role: 'ProjectOwner', id: { not: poUser.id } },
    });
    if (!otherPoUser) {
      otherPoUser = await prisma.user.create({
        data: {
          name: 'Sarah Jenkins (Other PO)',
          email: 'otherpo.approval.test@fernfoley.com',
          role: 'ProjectOwner',
          department: 'Product',
        },
      });
    }

    // 2. Setup project owned by poUser
    testProject = await prisma.project.create({
      data: {
        name: 'Approval Permission Validation Project',
        goal: 'Validate approval permissions for Owner and CEO',
        sponsor: 'Eleanor Foley',
        ownerId: poUser.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        plannedBudget: 20000,
        contingency: 5000,
      },
    });

    // Ensure empUser is a member of the project
    await prisma.projectMembership.upsert({
      where: {
        projectId_userId: { projectId: testProject.id, userId: empUser.id },
      },
      update: {},
      create: {
        projectId: testProject.id,
        userId: empUser.id,
        role: 'Contributor',
      },
    });

    // 3. Start ephemeral server
    await new Promise<void>((resolve) => {
      server = httpServer.listen(0, () => {
        const address = server.address();
        if (typeof address === 'object' && address !== null) {
          serverPort = address.port;
          baseUrl = `http://127.0.0.1:${serverPort}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (testProject) {
      await prisma.approvalRequest.deleteMany({ where: { projectId: testProject.id } });
      await prisma.projectMembership.deleteMany({ where: { projectId: testProject.id } });
      await prisma.project.delete({ where: { id: testProject.id } }).catch(() => {});
    }
  });

  it('1. Employee submits request -> Both Project Owner and CEO can decide (Send Back & Approve)', async () => {
    // 1a. Employee submits
    const submitRes = await fetch(`${baseUrl}/api/approvals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': empUser.id,
      },
      body: JSON.stringify({
        projectId: testProject.id,
        type: 'Budget',
        summary: 'Emp Budget Draw £2,000',
        detail: 'Tools needed for phase 1',
        requestedAmount: 2000,
      }),
    });
    expect(submitRes.status).toBe(201);
    const req1 = await submitRes.json();
    expect(req1.state).toBe('Pending');
    expect(req1.requestedBy).toBe(empUser.id);

    // 1b. Project Owner sends back
    const poSendBackRes = await fetch(`${baseUrl}/api/approvals/${req1.id}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': poUser.id,
      },
      body: JSON.stringify({ action: 'SEND_BACK', decisionNote: 'Please clarify vendor details' }),
    });
    expect(poSendBackRes.status).toBe(200);
    const sentBackReq = await poSendBackRes.json();
    expect(sentBackReq.state).toBe('Sent back');
    expect(sentBackReq.decisionNote).toBe('Please clarify vendor details');

    // 1c. Employee resubmits
    const resubmitRes = await fetch(`${baseUrl}/api/approvals/${req1.id}/resubmit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': empUser.id,
      },
      body: JSON.stringify({
        summary: 'Emp Budget Draw £2,000 (Revised)',
        detail: 'Tools needed with vendor quotation attached',
      }),
    });
    expect(resubmitRes.status).toBe(201);
    const req1Rev = await resubmitRes.json();
    expect(req1Rev.state).toBe('Pending');
    expect(req1Rev.version).toBe(2);

    // 1d. CEO approves the revised request
    const ceoApproveRes = await fetch(`${baseUrl}/api/approvals/${req1Rev.id}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ceoUser.id,
      },
      body: JSON.stringify({ action: 'APPROVE', decisionNote: 'Approved by CEO' }),
    });
    expect(ceoApproveRes.status).toBe(200);
    const approvedReq = await ceoApproveRes.json();
    expect(approvedReq.state).toBe('Approved');
  });

  it('2. Project Owner submits request -> Both Project Owner and CEO can decide (Self-approval & CEO approval enabled)', async () => {
    // 2a. Project Owner submits request
    const submitRes = await fetch(`${baseUrl}/api/approvals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': poUser.id,
      },
      body: JSON.stringify({
        projectId: testProject.id,
        type: 'Timeline',
        summary: 'PO Timeline Extension request',
        detail: 'Weather delay adjustment',
      }),
    });
    expect(submitRes.status).toBe(201);
    const req2 = await submitRes.json();
    expect(req2.state).toBe('Pending');
    expect(req2.requestedBy).toBe(poUser.id);

    // 2b. Project Owner can approve their own request
    const poApproveRes = await fetch(`${baseUrl}/api/approvals/${req2.id}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': poUser.id,
      },
      body: JSON.stringify({ action: 'APPROVE', decisionNote: 'Approved by Project Owner' }),
    });
    expect(poApproveRes.status).toBe(200);
    const approvedReq = await poApproveRes.json();
    expect(approvedReq.state).toBe('Approved');

    // 2c. Another PO request where CEO approves
    const submitRes2 = await fetch(`${baseUrl}/api/approvals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': poUser.id,
      },
      body: JSON.stringify({
        projectId: testProject.id,
        type: 'Scope',
        summary: 'PO Scope Enhancement',
        detail: 'Additional user feature request',
      }),
    });
    expect(submitRes2.status).toBe(201);
    const req2b = await submitRes2.json();

    const ceoApproveRes = await fetch(`${baseUrl}/api/approvals/${req2b.id}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ceoUser.id,
      },
      body: JSON.stringify({ action: 'APPROVE', decisionNote: 'Approved by CEO' }),
    });
    expect(ceoApproveRes.status).toBe(200);
    const approvedReq2 = await ceoApproveRes.json();
    expect(approvedReq2.state).toBe('Approved');
  });

  it('3. CEO submits request -> Both CEO and Project Owner can decide (CEO self-approval & Owner approval enabled)', async () => {
    // 3a. CEO submits request
    const submitRes = await fetch(`${baseUrl}/api/approvals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ceoUser.id,
      },
      body: JSON.stringify({
        projectId: testProject.id,
        type: 'Budget',
        summary: 'CEO Strategic Equipment Upgrade £10,000',
        detail: 'New high-throughput laser cutter',
        requestedAmount: 10000,
      }),
    });
    expect(submitRes.status).toBe(201);
    const req3 = await submitRes.json();
    expect(req3.state).toBe('Pending');
    expect(req3.requestedBy).toBe(ceoUser.id);

    // 3b. CEO can self-approve the request
    const ceoApproveRes = await fetch(`${baseUrl}/api/approvals/${req3.id}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ceoUser.id,
      },
      body: JSON.stringify({ action: 'APPROVE', decisionNote: 'Executive direct approval' }),
    });
    expect(ceoApproveRes.status).toBe(200);
    const approvedReq = await ceoApproveRes.json();
    expect(approvedReq.state).toBe('Approved');

    // 3c. CEO submits another request and Project Owner approves it
    const submitRes2 = await fetch(`${baseUrl}/api/approvals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': ceoUser.id,
      },
      body: JSON.stringify({
        projectId: testProject.id,
        type: 'Scope',
        summary: 'CEO Scope Adjustment',
        detail: 'Adjust delivery specification',
      }),
    });
    expect(submitRes2.status).toBe(201);
    const req3b = await submitRes2.json();

    const poApproveRes = await fetch(`${baseUrl}/api/approvals/${req3b.id}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': poUser.id,
      },
      body: JSON.stringify({ action: 'APPROVE', decisionNote: 'Reviewed and confirmed by Project Owner' }),
    });
    expect(poApproveRes.status).toBe(200);
    const approvedReq2 = await poApproveRes.json();
    expect(approvedReq2.state).toBe('Approved');
  });

  it('4. Employee attempts to decide request -> Blocked with 403 Forbidden', async () => {
    const submitRes = await fetch(`${baseUrl}/api/approvals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': poUser.id,
      },
      body: JSON.stringify({
        projectId: testProject.id,
        type: 'Budget',
        summary: 'Test Employee Permission Block',
        detail: 'Testing Employee 403',
        requestedAmount: 1000,
      }),
    });
    expect(submitRes.status).toBe(201);
    const req = await submitRes.json();

    const empDecideRes = await fetch(`${baseUrl}/api/approvals/${req.id}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': empUser.id,
      },
      body: JSON.stringify({ action: 'APPROVE' }),
    });
    expect(empDecideRes.status).toBe(403);
    const errBody = await empDecideRes.json();
    expect(errBody.error).toContain('Employees cannot approve');
  });

  it('5. Unrelated Project Owner attempts to decide request on another project -> Blocked with 403', async () => {
    const submitRes = await fetch(`${baseUrl}/api/approvals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': poUser.id,
      },
      body: JSON.stringify({
        projectId: testProject.id,
        type: 'Timeline',
        summary: 'Test Cross-PO Isolation',
        detail: 'Testing cross project owner permission',
      }),
    });
    expect(submitRes.status).toBe(201);
    const req = await submitRes.json();

    const otherPoDecideRes = await fetch(`${baseUrl}/api/approvals/${req.id}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': otherPoUser.id,
      },
      body: JSON.stringify({ action: 'APPROVE' }),
    });
    expect(otherPoDecideRes.status).toBe(403);
  });
});
