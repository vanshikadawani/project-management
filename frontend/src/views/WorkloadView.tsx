import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../lib/api.ts';
import { WorkloadMember, Project } from '../types.ts';
import {
  Users,
  Calendar,
  Clock,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Plus,
  X,
} from 'lucide-react';

export const WorkloadView: React.FC = () => {
  const { currentUser, isCEO, isProjectOwner } = useAuth();
  const [data, setData] = useState<{
    weekStartDate: string;
    summary: {
      totalTeam: number;
      overallocatedCount: number;
      balancedCount: number;
      availableCount: number;
    };
    workload: WorkloadMember[];
  } | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Allocation modal
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<WorkloadMember | null>(null);
  const [allocateProjectId, setAllocateProjectId] = useState('');
  const [allocateHours, setAllocateHours] = useState(10);
  const [toast, setToast] = useState<string | null>(null);

  const fetchWorkload = async () => {
    try {
      setLoading(true);
      setError(null);
      const [wRes, pRes] = await Promise.all([
        apiFetch('/api/workload'),
        apiFetch('/api/projects'),
      ]);

      if (!wRes.ok) throw new Error('Failed to load workload statistics');
      const wData = await wRes.json();
      const pData = await pRes.json();

      setData(wData);
      setProjects(pData);
      if (pData.length > 0 && !allocateProjectId) {
        setAllocateProjectId(pData[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading workload');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkload();
  }, [currentUser]);

  const [allocating, setAllocating] = useState(false);
  const submittingRef = useRef(false);

  const handleAllocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !allocateProjectId) return;
    if (submittingRef.current || allocating) return;
    submittingRef.current = true;
    setAllocating(true);

    try {
      const res = await apiFetch('/api/workload/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.user.id,
          projectId: allocateProjectId,
          weekStartDate: data?.weekStartDate || '2026-09-14T00:00:00Z',
          allocatedHours: Number(allocateHours),
        }),
      });
      if (!res.ok) throw new Error('Failed to save allocation');
      setShowAllocateModal(false);
      setToast(`Allocated ${allocateHours}h to ${selectedUser.user.name}`);
      setTimeout(() => setToast(null), 4000);
      fetchWorkload();
    } catch (err: any) {
      setToast(err.message);
      setTimeout(() => setToast(null), 4000);
    } finally {
      submittingRef.current = false;
      setAllocating(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-20 sm:pb-24 max-w-full overflow-hidden sm:overflow-visible">
      {toast && (
        <div className="fixed top-16 right-4 left-4 sm:left-auto z-50 p-4 rounded-2xl bg-[#231E1B] text-white text-xs font-semibold shadow-xl animate-in fade-in">
          {toast}
        </div>
      )}

      {/* Header — title + week */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-bold text-[#231E1B] tracking-tight">
            Workload
          </h1>
          <p className="text-xs lg:text-sm text-[#70675D] mt-0.5 break-words">
            Capacity allocation vs 37-hour standard reference for the active week.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#5A524A] bg-[#FAF6EE] px-3.5 py-1.5 rounded-full border border-[#EAE3D5] shrink-0 shadow-2xs">
          <Calendar className="w-3.5 h-3.5 text-[#C85A32]" />
          <span>Week of Sep 14, 2026</span>
        </div>
      </div>

      {/* Summary KPI cards */}
      {data?.summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-[#EAE3D5] shadow-xs flex flex-col justify-between">
            <span className="text-[10px] sm:text-xs uppercase font-bold text-[#70675D] tracking-wider block truncate">
              Active Team
            </span>
            <div className="mt-1 text-xl sm:text-2xl font-bold font-serif text-[#231E1B]">
              {data.summary.totalTeam}
            </div>
            <span className="text-[10px] sm:text-[11px] text-[#70675D] truncate">Staff members</span>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-[#FECACA] shadow-xs flex flex-col justify-between">
            <span className="text-[10px] sm:text-xs uppercase font-bold text-[#991B1B] tracking-wider block truncate">
              Overallocated
            </span>
            <div className="mt-1 text-xl sm:text-2xl font-bold font-serif text-[#991B1B]">
              {data.summary.overallocatedCount}
            </div>
            <span className="text-[10px] sm:text-[11px] text-[#991B1B] truncate">&gt; 100% capacity</span>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-[#FDE68A] shadow-xs flex flex-col justify-between">
            <span className="text-[10px] sm:text-xs uppercase font-bold text-[#92400E] tracking-wider block truncate">
              Balanced
            </span>
            <div className="mt-1 text-xl sm:text-2xl font-bold font-serif text-[#92400E]">
              {data.summary.balancedCount}
            </div>
            <span className="text-[10px] sm:text-[11px] text-[#92400E] truncate">70% – 100% load</span>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-[#C6DEC7] shadow-xs flex flex-col justify-between">
            <span className="text-[10px] sm:text-xs uppercase font-bold text-[#2D5A34] tracking-wider block truncate">
              Available
            </span>
            <div className="mt-1 text-xl sm:text-2xl font-bold font-serif text-[#2D5A34]">
              {data.summary.availableCount}
            </div>
            <span className="text-[10px] sm:text-[11px] text-[#2D5A34] truncate">&lt; 70% capacity</span>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-white/70 border border-[#EAE3D5] animate-pulse space-y-3"
            >
              <div className="h-4 w-1/3 bg-[#E8E2D5] rounded-md" />
              <div className="h-3 w-3/4 bg-[#E8E2D5] rounded-md" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 rounded-2xl bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchWorkload} className="px-3 py-1 bg-white rounded-lg text-xs font-semibold">
            Retry
          </button>
        </div>
      )}

      {/* Workload Team Cards */}
      {!loading && !error && data?.workload && (
        <div className="space-y-3.5 sm:space-y-4">
          {data.workload.map((member) => {
            const isOver = member.status === 'OVER';
            const isBalanced = member.status === 'BALANCED';

            let statusPillClass = 'bg-[#EBF2EB] text-[#2D5A34] border-[#C4D9C5]';
            let barColor = 'bg-[#526E55]';

            if (isOver) {
              statusPillClass = 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA] font-bold';
              barColor = 'bg-[#B3261E]';
            } else if (isBalanced) {
              statusPillClass = 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A] font-semibold';
              barColor = 'bg-[#D97706]';
            }

            return (
              <div
                key={member.user.id}
                id={`workload-card-${member.user.id}`}
                className="p-4 sm:p-5 rounded-2xl bg-white border border-[#EAE3D5] shadow-xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-3">
                    <img
                      src={member.user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${member.user.name}`}
                      alt={member.user.name}
                      className="w-10 h-10 rounded-full border border-white shadow-2xs shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-xs sm:text-sm text-[#231E1B] truncate">{member.user.name}</h4>
                        <span className="text-[10px] text-[#70675D] bg-[#F5F1E8] px-2 py-0.5 rounded-full">
                          {member.user.department || member.user.role}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#70675D] truncate">{member.user.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                    <span className={`text-xs px-3 py-1 rounded-full border ${statusPillClass}`}>
                      {member.statusLabel} ({member.workloadPercentage}%)
                    </span>

                    {(isCEO || isProjectOwner) && (
                      <button
                        onClick={() => {
                          setSelectedUser(member);
                          setShowAllocateModal(true);
                        }}
                        className="px-3.5 py-1.5 rounded-full bg-[#FAF6EE] hover:bg-[#ECE5D6] text-xs font-semibold text-[#5A524A] border border-[#DDD6C8] flex items-center gap-1 min-h-[44px] cursor-pointer active:scale-95 transition-all"
                        title="Adjust project hours allocation"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#C85A32]" />
                        Allocate
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Visual Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#231E1B]">
                      {member.allocatedHours} hrs allocated
                    </span>
                    <span className="text-[#70675D]">
                      Ref: <strong>{member.referenceHours} hrs / wk</strong>
                    </span>
                  </div>

                  <div className="w-full h-2.5 rounded-full bg-[#EAE4D8] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${Math.min(100, member.workloadPercentage)}%` }}
                    />
                  </div>
                </div>

                {/* Associated Projects Breakdown */}
                <div className="pt-2 border-t border-[#F2ECE1] space-y-1">
                  <span className="text-[10px] sm:text-[11px] font-bold text-[#8C8275] uppercase tracking-wider block">
                    Assigned Projects:
                  </span>
                  {member.projects.length === 0 ? (
                    <div className="text-xs text-[#8C8275] italic">
                      No specific project hours assigned this week.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {member.projects.map((p) => (
                        <div
                          key={p.id}
                          className="px-2.5 py-1 rounded-xl bg-[#FAF8F2] border border-[#EBE4D5] text-xs flex items-center gap-2"
                        >
                          <span className="font-semibold text-[#231E1B] truncate max-w-[150px]">{p.name}</span>
                          <span className="text-[10px] font-bold text-[#C85A32] bg-[#FDECE5] px-1.5 py-0.2 rounded-md shrink-0">
                            {p.hours}h
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ALLOCATE MODAL */}
      {showAllocateModal && selectedUser && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => setShowAllocateModal(false)}
        >
          <div 
            className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border-t sm:border border-[#EAE3D5] space-y-4 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-[#DDD6C8] rounded-full mx-auto sm:hidden" />
            <div className="flex items-center justify-between">
              <h4 className="font-serif text-lg font-bold text-[#231E1B]">
                Allocate Project Hours
              </h4>
              <button 
                onClick={() => setShowAllocateModal(false)} 
                className="p-2 text-gray-400 hover:text-black rounded-xl hover:bg-[#F5F1E8] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#70675D]">
              Assign dedicated hours for <strong>{selectedUser.user.name}</strong> on a project for the
              active reference week.
            </p>

            <form onSubmit={handleAllocateSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#231E1B] mb-1">Project</label>
                <select
                  required
                  value={allocateProjectId}
                  onChange={(e) => setAllocateProjectId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#DDD6C8] text-sm min-h-[44px]"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#231E1B] mb-1">
                  Weekly Allocated Hours (Ref: 37h total)
                </label>
                <input
                  required
                  type="number"
                  min={1}
                  max={60}
                  value={allocateHours}
                  onChange={(e) => setAllocateHours(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-[#DDD6C8] text-sm min-h-[44px]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAllocateModal(false)}
                  className="px-4 py-2.5 rounded-full text-xs font-semibold bg-[#F5F1E8] hover:bg-[#EAE4D6] min-h-[44px] cursor-pointer flex-1 sm:flex-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-full text-xs font-semibold bg-[#C85A32] text-white hover:bg-[#AD4722] min-h-[44px] shadow-xs cursor-pointer active:scale-95 flex-1 sm:flex-none"
                >
                  Confirm Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
