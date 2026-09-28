import React, { useState, useEffect, useRef } from 'react';
import {
  DollarSign,
  AlertTriangle,
  TrendingUp,
  ShieldAlert,
  Plus,
  ArrowUpRight,
  PieChart,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../lib/api.ts';
import { BudgetHealthData } from '../types.ts';

interface ProjectBudgetTabProps {
  projectId: string;
  projectName: string;
}

export const ProjectBudgetTab: React.FC<ProjectBudgetTabProps> = ({ projectId, projectName }) => {
  const { currentUser, isEmployee, isCEO, isProjectOwner } = useAuth();
  const [budgetData, setBudgetData] = useState<BudgetHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Record Spend Modal
  const [showSpendModal, setShowSpendModal] = useState(false);
  const [spendAmount, setSpendAmount] = useState<string>('');
  const [spendPhaseId, setSpendPhaseId] = useState<string>('');
  const [spendDescription, setSpendDescription] = useState<string>('');
  const [submittingSpend, setSubmittingSpend] = useState(false);

  const fetchBudget = async () => {
    if (isEmployee) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch(`/api/projects/${projectId}/budget`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to load budget');
      }
      const data = await res.json();
      setBudgetData(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching budget');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudget();
  }, [projectId, currentUser]);

  const submittingRef = useRef(false);

  const handleRecordSpend = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(spendAmount);
    if (!amountNum || amountNum <= 0) {
      alert('Please enter a valid positive spend amount');
      return;
    }
    if (submittingRef.current || submittingSpend) return;
    submittingRef.current = true;

    try {
      setSubmittingSpend(true);
      const res = await apiFetch(`/api/projects/${projectId}/budget/spend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountNum,
          phaseId: spendPhaseId || undefined,
          description: spendDescription.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to record spend');
      }

      setShowSpendModal(false);
      setSpendAmount('');
      setSpendDescription('');
      setSpendPhaseId('');
      fetchBudget();
    } catch (err: any) {
      alert(err.message || 'Failed to record spend');
    } finally {
      submittingRef.current = false;
      setSubmittingSpend(false);
    }
  };

  // RBAC GATING: Employees cannot see budget
  if (isEmployee) {
    return (
      <div className="p-8 rounded-2xl bg-[#FBF9F4] border border-[#E8E2D5] text-center space-y-4 max-w-lg mx-auto my-8">
        <div className="w-12 h-12 rounded-2xl bg-[#F6EADB] border border-[#ECD8C3] flex items-center justify-center mx-auto text-[#C85A32]">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="font-serif font-bold text-base text-[#231E1B]">
          Confidential Budget Information
        </h3>
        <p className="text-xs text-[#70685F] leading-relaxed">
          Financial data, contingency funds, and spend metrics are restricted to Project Owners and Executive Leadership (CEO).
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="py-20 text-center text-xs text-[#70685F]">Loading project budget analysis...</div>;
  }

  if (error) {
    return (
      <div className="p-6 rounded-xl bg-[#FDF2F2] border border-[#F8D7D7] text-xs text-[#991B1B] text-center">
        {error}
      </div>
    );
  }

  if (!budgetData) return null;

  return (
    <div className="space-y-6">
      {/* 90% Threshold Alert Banner */}
      {budgetData.isWarning90Percent && (
        <div className="p-4 rounded-2xl bg-[#FFF8E6] border border-[#FEE29A] flex items-start gap-3 text-[#92400E]">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-[#D97706]" />
          <div>
            <h4 className="font-serif font-bold text-sm">Budget Threshold Warning (≥ 90%)</h4>
            <p className="text-xs mt-0.5 leading-relaxed">
              Spend to date (£{budgetData.spendToDate.toLocaleString()}) has surpassed 90% of the planned baseline budget (£{budgetData.plannedBudget.toLocaleString()}). Contingency reserve activation or CEO budget revision is recommended.
            </p>
          </div>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E8E2D5]">
        <div>
          <h3 className="font-serif font-bold text-base text-[#231E1B]">Financial Control &amp; Budget</h3>
          <p className="text-xs text-[#70685F]">
            Baseline allocation, linear planned spend marker, and phase level expenditure
          </p>
        </div>

        {(isCEO || isProjectOwner) && (
          <button
            id="btn-record-spend"
            onClick={() => setShowSpendModal(true)}
            className="px-4 py-2 rounded-xl bg-[#C85A32] hover:bg-[#A63C1E] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Record Spend
          </button>
        )}
      </div>

      {/* Core KPI Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white border border-[#E8E2D5] shadow-2xs">
          <div className="text-[11px] font-bold text-[#70685F] uppercase tracking-wider">Planned Budget</div>
          <div className="text-xl font-serif font-bold text-[#231E1B] mt-1">
            £{budgetData.plannedBudget.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#70685F] mt-1">
            + £{budgetData.contingency.toLocaleString()} contingency
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E8E2D5] shadow-2xs">
          <div className="text-[11px] font-bold text-[#70685F] uppercase tracking-wider">Spend to Date</div>
          <div className="text-xl font-serif font-bold text-[#C85A32] mt-1">
            £{budgetData.spendToDate.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#70685F] mt-1">
            {budgetData.spendPercent}% of planned
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E8E2D5] shadow-2xs">
          <div className="text-[11px] font-bold text-[#70685F] uppercase tracking-wider">Remaining Funds</div>
          <div className="text-xl font-serif font-bold text-[#526E55] mt-1">
            £{budgetData.remaining.toLocaleString()}
          </div>
          <div className="text-[11px] text-[#70685F] mt-1">
            Total capacity: £{budgetData.totalBudget.toLocaleString()}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-[#E8E2D5] shadow-2xs">
          <div className="text-[11px] font-bold text-[#70685F] uppercase tracking-wider">Planned vs Actual</div>
          <div
            className={`text-xl font-serif font-bold mt-1 ${
              budgetData.variance <= 0 ? 'text-[#526E55]' : 'text-[#991B1B]'
            }`}
          >
            {budgetData.variance >= 0 ? `+£${budgetData.variance.toLocaleString()}` : `-£${Math.abs(budgetData.variance).toLocaleString()}`}
          </div>
          <div className="text-[11px] text-[#70685F] mt-1">
            {budgetData.variance <= 0 ? 'Under expected spend pace' : 'Over expected spend pace'}
          </div>
        </div>
      </div>

      {/* Plan Marker Progression Bar */}
      <div className="p-5 rounded-2xl bg-white border border-[#E8E2D5] shadow-2xs space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-[#231E1B]">Schedule vs Spend Progress</span>
            <span className="text-[11px] text-[#70685F]">(Plan Marker: {budgetData.planPercent}%)</span>
          </div>
          <div className="text-[#70685F]">
            Expected spend to date: <strong className="text-[#231E1B]">£{budgetData.plannedSpendToDate.toLocaleString()}</strong>
          </div>
        </div>

        {/* Multi-layered track */}
        <div className="relative w-full h-4 bg-[#F2EDE2] rounded-full overflow-hidden">
          {/* Actual Spend Fill */}
          <div
            className={`h-full rounded-full transition-all ${
              budgetData.isWarning90Percent ? 'bg-[#D97706]' : 'bg-[#C85A32]'
            }`}
            style={{ width: `${Math.min(100, budgetData.spendPercent)}%` }}
          />

          {/* Planned Progression Marker Line */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-[#231E1B] shadow-sm z-10"
            style={{ left: `${Math.min(100, budgetData.planPercent)}%` }}
            title={`Schedule Plan Marker: ${budgetData.planPercent}%`}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#70685F] pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C85A32]" />
            <span>Actual Spend ({budgetData.spendPercent}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-3 bg-[#231E1B] rounded-xs" />
            <span>Linear Schedule Marker ({budgetData.planPercent}%)</span>
          </div>
        </div>
      </div>

      {/* Phase Spend Breakdown Table */}
      <div className="bg-white rounded-2xl border border-[#E8E2D5] shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 bg-[#FBF9F4] border-b border-[#E8E2D5]">
          <h4 className="font-serif font-bold text-sm text-[#231E1B]">Phase Budget Allocations</h4>
          <p className="text-[11px] text-[#70685F]">Expenditure tracked by project execution phase</p>
        </div>

        <div className="divide-y divide-[#E8E2D5] overflow-x-auto">
          {budgetData.phases.map((ph) => (
            <div key={ph.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 sm:w-1/3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#231E1B]">{ph.name}</span>
                  {ph.isWarning90Percent && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#92400E]">
                      ≥ 90%
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-[#70685F]">
                  {new Date(ph.plannedStart).toLocaleDateString()} – {new Date(ph.plannedEnd).toLocaleDateString()}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 sm:w-1/2 text-xs">
                <div>
                  <div className="text-[10px] text-[#70685F] uppercase font-bold">Planned</div>
                  <div className="font-semibold text-[#231E1B]">£{ph.plannedBudget.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#70685F] uppercase font-bold">Spent</div>
                  <div className="font-semibold text-[#C85A32]">£{ph.spendToDate.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#70685F] uppercase font-bold">Remaining</div>
                  <div className="font-semibold text-[#526E55]">£{ph.remaining.toLocaleString()}</div>
                </div>
              </div>

              <div className="sm:w-1/6 flex items-center justify-end">
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-[#F5F1E8] text-[#554E44]">
                  {ph.spendPercent}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Record Spend Modal */}
      {showSpendModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#FBF9F4] rounded-2xl shadow-2xl border border-[#E8E2D5] p-6 space-y-4">
            <h3 className="font-serif font-bold text-base text-[#231E1B]">Record Actual Spend</h3>
            <p className="text-xs text-[#70685F]">
              Log project expenditures against budget and phase allocations.
            </p>

            <form onSubmit={handleRecordSpend} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#231E1B] mb-1">
                  Spend Amount (£) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={spendAmount}
                  onChange={(e) => setSpendAmount(e.target.value)}
                  placeholder="e.g. 1500"
                  className="w-full bg-white border border-[#DDD6C8] rounded-xl px-3 py-2 text-xs text-[#231E1B] focus:outline-hidden focus:ring-1 focus:ring-[#C85A32]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#231E1B] mb-1">
                  Allocate to Phase (Optional)
                </label>
                <select
                  value={spendPhaseId}
                  onChange={(e) => setSpendPhaseId(e.target.value)}
                  className="w-full bg-white border border-[#DDD6C8] rounded-xl px-3 py-2 text-xs text-[#231E1B] focus:outline-hidden focus:ring-1 focus:ring-[#C85A32]"
                >
                  <option value="">-- Project Level / General --</option>
                  {budgetData.phases.map((ph) => (
                    <option key={ph.id} value={ph.id}>
                      {ph.name} (Planned: £{ph.plannedBudget.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#231E1B] mb-1">
                  Description / Invoice Note
                </label>
                <input
                  type="text"
                  value={spendDescription}
                  onChange={(e) => setSpendDescription(e.target.value)}
                  placeholder="e.g. Contractor milestone disbursement"
                  className="w-full bg-white border border-[#DDD6C8] rounded-xl px-3 py-2 text-xs text-[#231E1B] focus:outline-hidden focus:ring-1 focus:ring-[#C85A32]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSpendModal(false)}
                  className="px-4 py-2 rounded-xl border border-[#DDD6C8] text-xs font-semibold text-[#70685F] hover:bg-[#EDE7DC] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSpend}
                  className="px-4 py-2 rounded-xl bg-[#C85A32] text-white text-xs font-semibold hover:bg-[#A63C1E] transition-colors shadow-xs cursor-pointer"
                >
                  {submittingSpend ? 'Recording...' : 'Record Spend'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
