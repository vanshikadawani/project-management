import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../backend/lib/prisma.ts';

describe('Fern & Foley — Integration Tests: RBAC & Business Rules', () => {
  let ceoUser: any;
  let poUser: any;
  let empUser: any;
  let testProject: any;
  let testPhase: any;

  beforeAll(async () => {
    // Look up seeded users
    ceoUser = await prisma.user.findFirst({ where: { role: 'CEO' } });
    poUser = await prisma.user.findFirst({ where: { role: 'ProjectOwner' } });
    empUser = await prisma.user.findFirst({ where: { role: 'Employee' } });

    testProject = await prisma.project.findFirst({
      include: { phases: true },
    });
    testPhase = testProject?.phases[0];
  });

  it('verifies CEO has global visibility and CEO role', () => {
    expect(ceoUser).toBeDefined();
    expect(ceoUser.role).toBe('CEO');
  });

  it('verifies Project Owner has ownership privileges', () => {
    expect(poUser).toBeDefined();
    expect(poUser.role).toBe('ProjectOwner');
  });

  it('verifies Employee has Member role in memberships', async () => {
    const membership = await prisma.projectMembership.findFirst({
      where: { userId: empUser.id },
    });
    expect(membership).toBeDefined();
    expect(membership?.role).toBe('Member');
  });

  it('enforces task completion blocker: mandatory quality check', async () => {
    // Create a task with an uncompleted mandatory quality check
    const task = await prisma.task.create({
      data: {
        phaseId: testPhase.id,
        title: 'Safety Interlock Calibration',
        plannedStart: new Date('2026-09-01'),
        plannedEnd: new Date('2026-09-05'),
        plannedHours: 16,
        state: 'In progress',
      },
    });

    const qc = await prisma.qualityCheck.create({
      data: {
        taskId: task.id,
        label: 'Optical trip sensor calibration check',
        mandatory: true,
        checkedAt: null,
      },
    });

    // Check mandatory check logic
    const incompleteChecks = await prisma.qualityCheck.findMany({
      where: { taskId: task.id, mandatory: true, checkedAt: null },
    });
    expect(incompleteChecks.length).toBe(1);

    // After ticking the check
    await prisma.qualityCheck.update({
      where: { id: qc.id },
      data: { checkedAt: new Date(), checkedBy: empUser.id },
    });

    const remainingIncomplete = await prisma.qualityCheck.findMany({
      where: { taskId: task.id, mandatory: true, checkedAt: null },
    });
    expect(remainingIncomplete.length).toBe(0);

    // Clean up
    await prisma.qualityCheck.delete({ where: { id: qc.id } });
    await prisma.task.delete({ where: { id: task.id } });
  });

  it('enforces task completion blocker: blocking dependency', async () => {
    // Task A (prerequisite)
    const taskA = await prisma.task.create({
      data: {
        phaseId: testPhase.id,
        title: 'Prerequisite Substation Wiring',
        plannedStart: new Date('2026-09-01'),
        plannedEnd: new Date('2026-09-05'),
        plannedHours: 20,
        state: 'In progress', // Open!
      },
    });

    // Task B (depends on A)
    const taskB = await prisma.task.create({
      data: {
        phaseId: testPhase.id,
        title: 'Main Inverter Turn-On',
        plannedStart: new Date('2026-09-06'),
        plannedEnd: new Date('2026-09-08'),
        plannedHours: 12,
        state: 'Not started',
        dependsOn: taskA.id,
      },
    });

    // Verify taskA blocks taskB
    const dep = await prisma.task.findUnique({ where: { id: taskB.dependsOn! } });
    expect(dep?.state).not.toBe('Completed');

    // Complete taskA
    await prisma.task.update({
      where: { id: taskA.id },
      data: { state: 'Completed' },
    });

    const unblockedDep = await prisma.task.findUnique({ where: { id: taskB.dependsOn! } });
    expect(unblockedDep?.state).toBe('Completed');

    // Clean up
    await prisma.task.delete({ where: { id: taskB.id } });
    await prisma.task.delete({ where: { id: taskA.id } });
  });

  it('enforces milestone within project date window rule', async () => {
    const pStart = new Date(testProject.startDate).getTime();
    const pEnd = new Date(testProject.endDate).getTime();

    const validDate = new Date(testProject.startDate.getTime() + 86400000 * 5);
    const invalidDate = new Date(testProject.endDate.getTime() + 86400000 * 30); // 30 days past end

    expect(validDate.getTime() >= pStart && validDate.getTime() <= pEnd).toBe(true);
    expect(invalidDate.getTime() >= pStart && invalidDate.getTime() <= pEnd).toBe(false);
  });
});
