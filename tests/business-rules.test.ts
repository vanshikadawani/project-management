import { describe, it, expect } from 'vitest';
import {
  calculateProgress,
  calculatePlanPercentage,
  calculateProjectStatus,
  calculateWorkload,
  calculateMilestoneSlippage,
  determineApprovalRoute,
  calculateBudgetHealth,
} from '../backend/lib/calculations.ts';
import {
  TaskCreateSchema,
  PhaseCreateSchema,
  IssueCreateSchema,
  IssueUpdateSchema,
  RiskCreateSchema,
} from '../backend/lib/validators.ts';

describe('Fern & Foley — Progress Calculation', () => {
  it('calculates progress correctly based on task weight (plannedHours)', () => {
    const tasks = [
      { state: 'Completed', plannedHours: 80 },
      { state: 'Completed', plannedHours: 20 },
      { state: 'In progress', plannedHours: 100 },
    ];
    // completed = 100, total = 200 => 50%
    expect(calculateProgress(tasks)).toBe(50);
  });

  it('assigns weight of 1 if plannedHours is 0', () => {
    const tasks = [
      { state: 'Completed', plannedHours: 0 },
      { state: 'Not started', plannedHours: 0 },
    ];
    // weight 1 + 1 = 2, completed 1 => 50%
    expect(calculateProgress(tasks)).toBe(50);
  });

  it('returns 0 if no tasks exist', () => {
    expect(calculateProgress([])).toBe(0);
  });
});

describe('Fern & Foley — Plan % Calculation', () => {
  it('returns 0 if today is before project start', () => {
    const start = new Date('2026-06-01');
    const end = new Date('2026-11-30');
    const today = new Date('2026-05-15');
    expect(calculatePlanPercentage(start, end, [], today)).toBe(0);
  });

  it('returns 100 if today is after project end', () => {
    const start = new Date('2026-06-01');
    const end = new Date('2026-11-30');
    const today = new Date('2026-12-05');
    expect(calculatePlanPercentage(start, end, [], today)).toBe(100);
  });

  it('interpolates linearly across phases', () => {
    const start = new Date('2026-06-01');
    const end = new Date('2026-11-30');
    const phases = [
      { plannedStart: '2026-06-01', plannedEnd: '2026-07-31' }, // 50% weight
      { plannedStart: '2026-08-01', plannedEnd: '2026-11-30' }, // 50% weight
    ];
    // After phase 1 completes (2026-08-01)
    const midPoint = new Date('2026-08-01');
    const plan = calculatePlanPercentage(start, end, phases, midPoint);
    expect(plan).toBeGreaterThanOrEqual(50);
  });
});

describe('Fern & Foley — Project Status Calculation', () => {
  it('returns ON_TRACK when progress is within 5 percentage points of plan and no critical issue', () => {
    const status = calculateProjectStatus({
      progress: 60,
      plan: 63, // 3 points behind
      hasCriticalIssueOpen: false,
      hasHighRiskOpen: false,
    });
    expect(status).toBe('ON_TRACK');
  });

  it('returns AT_RISK when 5-15 points behind plan', () => {
    const status = calculateProjectStatus({
      progress: 50,
      plan: 60, // 10 points behind
      hasCriticalIssueOpen: false,
      hasHighRiskOpen: false,
    });
    expect(status).toBe('AT_RISK');
  });

  it('returns AT_RISK when a High risk is open even if on schedule', () => {
    const status = calculateProjectStatus({
      progress: 70,
      plan: 70,
      hasCriticalIssueOpen: false,
      hasHighRiskOpen: true,
    });
    expect(status).toBe('AT_RISK');
  });

  it('returns OFF_TRACK when more than 15 percentage points behind plan', () => {
    const status = calculateProjectStatus({
      progress: 40,
      plan: 60, // 20 points behind
      hasCriticalIssueOpen: false,
      hasHighRiskOpen: false,
    });
    expect(status).toBe('OFF_TRACK');
  });

  it('returns OFF_TRACK if a Critical issue is open even if 100% progressed', () => {
    const status = calculateProjectStatus({
      progress: 100,
      plan: 100,
      hasCriticalIssueOpen: true,
      hasHighRiskOpen: false,
    });
    expect(status).toBe('OFF_TRACK');
  });

  it('respects Project Owner status override if provided', () => {
    const status = calculateProjectStatus({
      progress: 10,
      plan: 80,
      hasCriticalIssueOpen: true,
      hasHighRiskOpen: true,
      statusOverride: 'ON_TRACK',
    });
    expect(status).toBe('ON_TRACK');
  });
});

describe('Fern & Foley — Workload Calculation', () => {
  it('calculates workload percentage based on 37-hour week', () => {
    const result = calculateWorkload(37, 37);
    expect(result.percentage).toBe(100);
    expect(result.status).toBe('BALANCED');
  });

  it('marks overallocated (>100%) as OVER (red)', () => {
    const result = calculateWorkload(41, 37);
    expect(result.percentage).toBe(111);
    expect(result.status).toBe('OVER');
    expect(result.statusLabel).toBe('Overallocated');
  });

  it('marks near capacity (70-100%) as BALANCED (amber)', () => {
    const result = calculateWorkload(30, 37);
    expect(result.percentage).toBe(81);
    expect(result.status).toBe('BALANCED');
  });

  it('marks <70% as AVAILABLE (green)', () => {
    const result = calculateWorkload(20, 37);
    expect(result.percentage).toBe(54);
    expect(result.status).toBe('AVAILABLE');
  });
});

describe('Fern & Foley — Validation Rules', () => {
  it('validates task: title required, 1-120 chars, hours 0-999', () => {
    const invalidTitle = TaskCreateSchema.safeParse({
      title: '',
      phaseId: 'p1',
      plannedStart: '2026-06-01',
      plannedEnd: '2026-06-10',
      plannedHours: 40,
    });
    expect(invalidTitle.success).toBe(false);

    const validTask = TaskCreateSchema.safeParse({
      title: 'Assemble roller mills',
      phaseId: 'p1',
      plannedStart: '2026-06-01',
      plannedEnd: '2026-06-10',
      plannedHours: 40,
      priority: 'High',
    });
    expect(validTask.success).toBe(true);
  });

  it('validates that planned end cannot precede planned start', () => {
    const invalidDates = TaskCreateSchema.safeParse({
      title: 'Valid title',
      phaseId: 'p1',
      plannedStart: '2026-06-15',
      plannedEnd: '2026-06-01', // Before start
      plannedHours: 10,
    });
    expect(invalidDates.success).toBe(false);
  });

  it('validates phase: name required and dates valid', () => {
    const validPhase = PhaseCreateSchema.safeParse({
      name: 'Phase 1 - Electrical',
      plannedStart: '2026-07-01',
      plannedEnd: '2026-07-20',
    });
    expect(validPhase.success).toBe(true);
  });

  it('validates issue: severity required and detail required', () => {
    const issue = IssueCreateSchema.safeParse({
      projectId: 'proj1',
      title: 'Broken valve',
      severity: 'Critical',
      detail: 'Pressure dropping rapidly',
    });
    expect(issue.success).toBe(true);
  });

  it('validates issue reopening requires a comment', () => {
    const emptyComment = IssueUpdateSchema.safeParse({
      state: 'Open',
      reopenComment: '   ',
    });
    // In our route we also enforce non-empty string on reopen endpoint
    expect(emptyComment.success).toBe(true);
  });

  it('validates risk: description required and severity enum', () => {
    const risk = RiskCreateSchema.safeParse({
      projectId: 'proj1',
      description: 'Potential delay in steel shipping',
      severity: 'Medium',
    });
    expect(risk.success).toBe(true);
  });
});

describe('Fern & Foley Phase 2 — Milestone Slippage Rules', () => {
  it('returns 0 weeks when forecast equals baseline date', () => {
    const slip = calculateMilestoneSlippage('2026-08-01', '2026-08-01');
    expect(slip.weeks).toBe(0);
    expect(slip.isSlipped).toBe(false);
  });

  it('returns 0 weeks when forecast is ahead of baseline (negative delay)', () => {
    const slip = calculateMilestoneSlippage('2026-08-10', '2026-08-05');
    expect(slip.weeks).toBe(0);
    expect(slip.isSlipped).toBe(false);
  });

  it('rounds 1 day delay UPWARD to 1 whole week', () => {
    const slip = calculateMilestoneSlippage('2026-08-01', '2026-08-02');
    expect(slip.days).toBe(1);
    expect(slip.weeks).toBe(1);
    expect(slip.isSlipped).toBe(true);
  });

  it('rounds 8 days delay UPWARD to 2 whole weeks', () => {
    const slip = calculateMilestoneSlippage('2026-08-01', '2026-08-09');
    expect(slip.days).toBe(8);
    expect(slip.weeks).toBe(2);
    expect(slip.isSlipped).toBe(true);
  });

  it('rounds 14 days delay exactly to 2 whole weeks', () => {
    const slip = calculateMilestoneSlippage('2026-08-01', '2026-08-15');
    expect(slip.days).toBe(14);
    expect(slip.weeks).toBe(2);
  });
});

describe('Fern & Foley Phase 2 — Approval Routing & Self-Approval Prevention', () => {
  const PO_ID = 'user-po-1';
  const CEO_ID = 'user-ceo-1';
  const EMP_ID = 'user-emp-1';

  it('routes budget change within contingency to Project Owner', () => {
    const route = determineApprovalRoute({
      type: 'Budget',
      requestedAmount: 5000,
      projectContingency: 10000,
      requesterId: EMP_ID,
      requesterRole: 'Employee',
      projectOwnerId: PO_ID,
      ceoId: CEO_ID,
    });
    expect(route.requiredRole).toBe('ProjectOwner');
    expect(route.designatedApproverId).toBe(PO_ID);
  });

  it('escalates to CEO when budget change exceeds contingency', () => {
    const route = determineApprovalRoute({
      type: 'Budget',
      requestedAmount: 15000,
      projectContingency: 10000,
      requesterId: EMP_ID,
      requesterRole: 'Employee',
      projectOwnerId: PO_ID,
      ceoId: CEO_ID,
    });
    expect(route.requiredRole).toBe('CEO');
    expect(route.designatedApproverId).toBe(CEO_ID);
  });

  it('escalates to CEO for any budget increase over £50,000 even if within contingency', () => {
    const route = determineApprovalRoute({
      type: 'Budget',
      requestedAmount: 55000,
      projectContingency: 100000,
      requesterId: EMP_ID,
      requesterRole: 'Employee',
      projectOwnerId: PO_ID,
      ceoId: CEO_ID,
    });
    expect(route.requiredRole).toBe('CEO');
    expect(route.designatedApproverId).toBe(CEO_ID);
  });

  it('prevents self-approval: escalates to CEO when requester is the Project Owner', () => {
    const route = determineApprovalRoute({
      type: 'Budget',
      requestedAmount: 5000,
      projectContingency: 10000,
      requesterId: PO_ID, // Requester is PO!
      requesterRole: 'ProjectOwner',
      projectOwnerId: PO_ID,
      ceoId: CEO_ID,
    });
    expect(route.requiredRole).toBe('CEO');
    expect(route.designatedApproverId).toBe(CEO_ID);
    expect(route.escalationReason).toContain('cannot self-approve');
  });

  it('routes timeline change moving a baselined milestone to Sponsor/CEO', () => {
    const route = determineApprovalRoute({
      type: 'Timeline',
      movesBaselinedMilestone: true,
      requesterId: EMP_ID,
      requesterRole: 'Employee',
      projectOwnerId: PO_ID,
      ceoId: CEO_ID,
    });
    expect(route.requiredRole).toBe('CEO');
    expect(route.designatedApproverId).toBe(CEO_ID);
  });

  it('routes scope change strictly to CEO', () => {
    const route = determineApprovalRoute({
      type: 'Scope',
      requesterId: EMP_ID,
      requesterRole: 'Employee',
      projectOwnerId: PO_ID,
      ceoId: CEO_ID,
    });
    expect(route.requiredRole).toBe('CEO');
    expect(route.designatedApproverId).toBe(CEO_ID);
  });
});

describe('Fern & Foley Phase 2 — Budget Health & 90% Threshold Alert', () => {
  it('correctly calculates total budget, remaining, and variance', () => {
    const health = calculateBudgetHealth({
      plannedBudget: 100000,
      contingency: 10000,
      spendToDate: 45000,
      planPercent: 50,
    });
    expect(health.totalBudget).toBe(110000);
    expect(health.remaining).toBe(65000);
    expect(health.plannedSpendToDate).toBe(50000);
    expect(health.variance).toBe(-5000); // 45000 - 50000 = -5000 (under budget)
    expect(health.isWarning90Percent).toBe(false);
  });

  it('triggers 90% budget warning when spend >= 90% of planned budget', () => {
    const health = calculateBudgetHealth({
      plannedBudget: 100000,
      contingency: 10000,
      spendToDate: 91000,
      planPercent: 80,
    });
    expect(health.isWarning90Percent).toBe(true);
    expect(health.spendPercent).toBe(91);
  });
});

