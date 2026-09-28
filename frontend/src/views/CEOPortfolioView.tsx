import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  TrendingUp,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  DollarSign,
  ChevronRight,
  Filter,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../lib/api.ts';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { CEOPortfolioKPIs, CEOPortfolioProject } from '../types.ts';

interface CEOPortfolioViewProps {
  onSelectProject: (projectId: string) => void;
}

export const CEOPortfolioView: React.FC<CEOPortfolioViewProps> = ({ onSelectProject }) => {
  const { isCEO } = useAuth();
  const [kpis, setKpis] = useState<CEOPortfolioKPIs | null>(null);
  const [projects, setProjects] = useState<CEOPortfolioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');

  const fetchPortfolio = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch('/api/portfolio/ceo');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load CEO portfolio');
      }
      const data = await res.json();
      setKpis(data.kpis);
      setProjects(data.projects || []);
    } catch (err: any) {
      setError(err.message || 'Error loading portfolio data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, []);

  const filteredProjects = projects.filter((p) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'ON_TRACK') return p.status === 'ON_TRACK';
    if (activeFilter === 'AT_RISK') return p.status === 'AT_RISK';
    if (activeFilter === 'OFF_TRACK') return p.status === 'OFF_TRACK';
    if (activeFilter === 'FINANCIAL_CONCERN') return p.isWarning90Percent || p.isOverBudget;
    if (activeFilter === 'CRITICAL') return p.criticalIssuesCount > 0;
    return true;
  });

  return (
    <div className="space-y-6 pb-24">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-[#231E1B] text-white space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-white/10 text-white/80">
            Executive Command
          </span>
          <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-[#C85A32] text-white">
            CEO Dashboard
          </span>
        </div>

        <div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight">
            Portfolio Health &amp; Capital Allocation
          </h2>
          <p className="text-xs text-white/70 max-w-xl mt-1 leading-relaxed">
            Consolidated oversight across active initiatives, financial burn rates, schedule variance, and critical risk escalations.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-[#70685F]">Loading CEO portfolio intelligence...</div>
      ) : error ? (
        <div className="p-6 rounded-xl bg-[#FDF2F2] border border-[#F8D7D7] text-xs text-[#991B1B] text-center">
          {error}
        </div>
      ) : kpis ? (
        <>
          {/* High-Level KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-white border border-[#E8E2D5] shadow-2xs">
              <div className="text-[11px] font-bold text-[#70685F] uppercase tracking-wider">Active Initiatives</div>
              <div className="text-2xl font-serif font-bold text-[#231E1B] mt-1">
                {kpis.totalProjects}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#70685F] mt-1">
                <span className="text-[#2D5A34] font-semibold">{kpis.onTrackCount} on track</span>
                <span>&bull;</span>
                <span className="text-[#991B1B] font-semibold">{kpis.offTrackCount} off track</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E8E2D5] shadow-2xs">
              <div className="text-[11px] font-bold text-[#70685F] uppercase tracking-wider">Committed Portfolio Capital</div>
              <div className="text-2xl font-serif font-bold text-[#231E1B] mt-1">
                £{kpis.totalPortfolioFunds.toLocaleString()}
              </div>
              <div className="text-[11px] text-[#70685F] mt-1">
                (£{kpis.totalContingency.toLocaleString()} reserved contingency)
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E8E2D5] shadow-2xs">
              <div className="text-[11px] font-bold text-[#70685F] uppercase tracking-wider">Portfolio Spend</div>
              <div className="text-2xl font-serif font-bold text-[#C85A32] mt-1">
                £{kpis.totalSpend.toLocaleString()}
              </div>
              <div className="text-[11px] text-[#70685F] mt-1">
                {kpis.overallSpendPercent}% utilized &bull; £{kpis.portfolioRemaining.toLocaleString()} remaining
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-[#E8E2D5] shadow-2xs">
              <div className="text-[11px] font-bold text-[#70685F] uppercase tracking-wider">Risk Escalations</div>
              <div className="text-2xl font-serif font-bold text-[#991B1B] mt-1">
                {kpis.totalCriticalIssues} Critical
              </div>
              <div className="text-[11px] text-[#70685F] mt-1">
                +{kpis.totalHighRisks} High-risk conditions open
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-[#70685F]" />
              <span className="font-semibold text-[#231E1B]">Filter:</span>
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs">
              {[
                { id: 'ALL', label: `All (${projects.length})` },
                { id: 'OFF_TRACK', label: `Off Track (${kpis.offTrackCount})` },
                { id: 'AT_RISK', label: `At Risk (${kpis.atRiskCount})` },
                { id: 'FINANCIAL_CONCERN', label: 'Financial Concern (≥90%)' },
                { id: 'CRITICAL', label: `Critical Issues (${kpis.totalCriticalIssues})` },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setActiveFilter(btn.id)}
                  className={`px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
                    activeFilter === btn.id
                      ? 'bg-[#231E1B] text-white border-[#231E1B]'
                      : 'bg-white text-[#70685F] border-[#DDD6C8] hover:bg-[#F5F1E8]'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Projects Table / Cards */}
          <div className="space-y-3">
            {filteredProjects.map((p) => (
              <div
                key={p.id}
                onClick={() => onSelectProject(p.id)}
                className="p-5 rounded-2xl bg-white border border-[#E8E2D5] hover:border-[#C85A32]/60 transition-all shadow-2xs hover:shadow-xs cursor-pointer space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif font-bold text-base text-[#231E1B] hover:text-[#C85A32] transition-colors">
                        {p.name}
                      </h3>
                      <StatusBadge status={p.status} />
                      {p.isOverridden && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E] font-bold">
                          Override
                        </span>
                      )}
                      {p.isWarning90Percent && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FDF2F2] text-[#991B1B] font-bold border border-[#F8D7D7]">
                          ≥90% Budget
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#70685F] line-clamp-1">{p.goal}</p>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-[#70685F]">
                    <div>
                      Owner: <strong className="text-[#231E1B]">{p.owner.name}</strong>
                    </div>
                    <span>&bull;</span>
                    <div>
                      Sponsor: <strong className="text-[#231E1B]">{p.sponsor}</strong>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#C85A32]" />
                  </div>
                </div>

                {/* Progress & Financial Track */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#F5F1E8] text-xs">
                  {/* Schedule Progress */}
                  <div>
                    <div className="flex justify-between text-[11px] text-[#70685F] mb-1">
                      <span>Schedule: {p.progress}% progress</span>
                      <span>Plan Marker: {p.plan}%</span>
                    </div>
                    <div className="relative w-full h-2.5 bg-[#F2EDE2] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#526E55] rounded-full"
                        style={{ width: `${Math.min(100, p.progress)}%` }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-1 bg-[#231E1B]"
                        style={{ left: `${Math.min(100, p.plan)}%` }}
                      />
                    </div>
                  </div>

                  {/* Financial Overview */}
                  <div>
                    <div className="flex justify-between text-[11px] text-[#70685F] mb-1">
                      <span>
                        Spent: £{p.spendToDate.toLocaleString()} / £{p.plannedBudget.toLocaleString()}
                      </span>
                      <span className={p.remainingBudget < 0 ? 'text-[#991B1B] font-bold' : 'text-[#2D5A34]'}>
                        Rem: £{p.remainingBudget.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-[#F2EDE2] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          p.isWarning90Percent ? 'bg-[#D97706]' : 'bg-[#C85A32]'
                        }`}
                        style={{
                          width: `${Math.min(100, (p.spendToDate / (p.plannedBudget || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Issue / Risk Counters */}
                <div className="flex items-center gap-4 text-[11px] text-[#70685F]">
                  {p.criticalIssuesCount > 0 ? (
                    <span className="text-[#991B1B] font-bold flex items-center gap-1">
                      <AlertOctagon className="w-3.5 h-3.5" />
                      {p.criticalIssuesCount} Critical Issues Open
                    </span>
                  ) : (
                    <span className="text-[#526E55] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      No Critical Issues
                    </span>
                  )}

                  {p.highRisksCount > 0 && (
                    <span className="text-[#B45309] font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {p.highRisksCount} High Risks
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};
