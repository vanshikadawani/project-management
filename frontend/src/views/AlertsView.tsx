import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../lib/api.ts';
import { AlertItem } from '../types.ts';
import { StatusBadge, SeverityBadge } from '../components/StatusBadge.tsx';
import {
  AlertTriangle,
  AlertOctagon,
  Flag,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowRight,
  Filter,
  CheckSquare,
  Sparkles,
  Calendar,
} from 'lucide-react';

interface AlertsViewProps {
  onSelectProject: (projectId: string, initialTab?: string) => void;
  onSelectIssue?: (issueId: string) => void;
  onShowCalendar?: () => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({ onSelectProject, onShowCalendar }) => {
  const { currentUser } = useAuth();
  const [data, setData] = useState<{
    summary: any;
    groupedByProject: Record<string, { projectName: string; alerts: AlertItem[] }>;
    alerts: AlertItem[];
    myTasks: any[];
  } | null>(null);
  const [todayEvents, setTodayEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayEventsLoading, setTodayEventsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'CRITICAL' | 'RISKS' | 'MY_TASKS'>('ALL');

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetch('/api/alerts');
      if (!res.ok) throw new Error('Failed to load attention stream');
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error fetching alerts');
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayEvents = async () => {
    try {
      setTodayEventsLoading(true);
      const res = await apiFetch('/api/calendar/today');
      if (res.ok) {
        const events = await res.json();
        setTodayEvents(events);
      }
    } catch (err) {
      // Silent fail for today's events - it's just a preview
    } finally {
      setTodayEventsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    fetchTodayEvents();
  }, [currentUser]);

  const filteredAlerts = (data?.alerts || []).filter((item) => {
    if (activeFilter === 'CRITICAL') return item.category === 'CRITICAL_ISSUE';
    if (activeFilter === 'RISKS') return item.category === 'HIGH_RISK' || item.category === 'RISK_FLAG';
    if (activeFilter === 'MY_TASKS') return item.category === 'TASK' || item.category === 'QUALITY_CHECK';
    return true;
  });

  return (
    <div className="space-y-5 sm:space-y-6 pb-20 sm:pb-24 max-w-full overflow-hidden sm:overflow-visible">
      {/* Header — title + Refresh */}
      <div className="flex items-start sm:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-bold text-[#231E1B] tracking-tight">
            Attention Stream
          </h1>
          <p className="text-xs lg:text-sm text-[#70675D] mt-0.5 break-words">
            Live operational pulse, critical blockers, and action items for {currentUser?.name}.
          </p>
        </div>
        <button
          onClick={fetchAlerts}
          className="shrink-0 px-3.5 py-2 sm:px-4 rounded-full text-xs lg:text-xs font-semibold bg-[#F5F1E8] hover:bg-[#EAE4D6] active:scale-95 border border-[#DDD6C8] text-[#5A524A] transition-all cursor-pointer min-h-[36px] sm:min-h-[44px] flex items-center gap-1.5 shadow-2xs"
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="sm:hidden">Refresh</span>
          <span className="hidden sm:inline">Refresh Pulse</span>
        </button>
      </div>

      {/* Summary KPI Strip */}
      {data?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-[#EAE3D5] shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-xs font-bold text-[#8C2B2B] uppercase tracking-wider truncate">
                Critical Issues
              </span>
              <AlertOctagon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#B3261E] shrink-0" />
            </div>
            <div className="mt-1 sm:mt-2 text-xl sm:text-2xl font-bold font-serif text-[#231E1B]">
              {data.summary.criticalIssuesCount}
            </div>
            <span className="text-[10px] sm:text-[11px] text-[#70675D] mt-0.5 truncate">Affects status</span>
          </div>

          <div className="p-3 sm:p-3.5 rounded-2xl bg-white border border-[#EAE3D5] shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-xs font-bold text-[#B45309] uppercase tracking-wider truncate">
                High Risks
              </span>
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#D97706] shrink-0" />
            </div>
            <div className="mt-1 sm:mt-2 text-xl sm:text-2xl font-bold font-serif text-[#231E1B]">
              {data.summary.highRisksCount}
            </div>
            <span className="text-[10px] sm:text-[11px] text-[#70675D] mt-0.5 truncate">Leadership view</span>
          </div>

          <div className="p-3 sm:p-3.5 rounded-2xl bg-white border border-[#EAE3D5] shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-xs font-bold text-[#6B7280] uppercase tracking-wider truncate">
                Blocked Tasks
              </span>
              <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#6B7280] shrink-0" />
            </div>
            <div className="mt-1 sm:mt-2 text-xl sm:text-2xl font-bold font-serif text-[#231E1B]">
              {data.summary.blockedTasksCount}
            </div>
            <span className="text-[10px] sm:text-[11px] text-[#70675D] mt-0.5 truncate">Work stoppage</span>
          </div>

          <div className="p-3 sm:p-3.5 rounded-2xl bg-white border border-[#EAE3D5] shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-xs font-bold text-[#2D5A34] uppercase tracking-wider truncate">
                Active Tasks
              </span>
              <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#407B4A] shrink-0" />
            </div>
            <div className="mt-1 sm:mt-2 text-xl sm:text-2xl font-bold font-serif text-[#231E1B]">
              {data.summary.myTasksCount}
            </div>
            <span className="text-[10px] sm:text-[11px] text-[#70675D] mt-0.5 truncate">Assigned to you</span>
          </div>
        </div>
      )}

      {/* Today's Calendar Preview */}
      <div className="bg-white border border-[#E8E2D5] rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-[#C85A32]" />
            <h3 className="font-serif text-base sm:text-lg font-bold text-[#231E1B]">Today's Calendar</h3>
          </div>
          <button
            onClick={fetchTodayEvents}
            className="text-xs text-[#70675D] hover:text-[#C85A32] flex items-center gap-1 cursor-pointer py-1 px-2 rounded-lg hover:bg-[#FAF7F2] transition-colors"
          >
            <Clock className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
        
        {todayEventsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-[#FAF7F2] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : todayEvents.length === 0 ? (
          <div className="py-4 text-center text-xs sm:text-sm text-[#A8A195]">
            No events scheduled for today
          </div>
        ) : (
          <div className="space-y-2">
            {todayEvents.slice(0, 5).map((event) => {
              const { extendedProps } = event;
              return (
                <div
                  key={event.id}
                  onClick={() => {
                    // Navigate to the appropriate page based on event type
                    if (extendedProps.projectId) {
                      switch (extendedProps.type) {
                        case 'task':
                          onSelectProject(extendedProps.projectId, 'tasks');
                          break;
                        case 'milestone':
                          onSelectProject(extendedProps.projectId, 'milestones');
                          break;
                        case 'approval':
                          onSelectProject(extendedProps.projectId, 'approvals');
                          break;
                        case 'risk':
                          onSelectProject(extendedProps.projectId, 'risks');
                          break;
                        case 'issue':
                          onSelectProject(extendedProps.projectId, 'issues');
                          break;
                        default:
                          break;
                      }
                    }
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all active:scale-[0.99] hover:opacity-90 min-h-[44px] ${
                    extendedProps.type === 'task' ? 'bg-blue-50 border-blue-200' :
                    extendedProps.type === 'milestone' ? 'bg-green-50 border-green-200' :
                    extendedProps.type === 'approval' ? 'bg-yellow-50 border-yellow-200' :
                    extendedProps.type === 'risk' ? 'bg-orange-50 border-orange-200' :
                    extendedProps.type === 'issue' ? 'bg-red-50 border-red-200' :
                    'bg-purple-50 border-purple-200'
                  } ${!extendedProps.projectId ? 'cursor-default hover:opacity-100' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium text-xs sm:text-sm text-[#231E1B] truncate">
                      {event.title}
                    </div>
                    <div className="text-[10px] sm:text-xs text-[#70675D] capitalize shrink-0 font-medium">
                      {extendedProps.type}
                    </div>
                  </div>
                  <div className="text-[11px] text-[#70675D] mt-0.5 truncate">
                    {extendedProps.projectName || 'Personal reminder'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        <div className="pt-2 border-t border-[#E8E2D5]">
          <button
            onClick={() => {
              if (onShowCalendar) {
                onShowCalendar();
              }
            }}
            className="w-full py-2.5 rounded-xl bg-[#F5F1E8] hover:bg-[#EDE7DC] active:scale-[0.99] border border-[#E0D9CB] text-[#70685F] hover:text-[#231E1B] text-xs sm:text-sm font-semibold transition-all cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5"
          >
            <Calendar className="w-4 h-4 text-[#C85A32]" />
            View Full Calendar
          </button>
        </div>
      </div>

      {/* Filter — compact select on mobile, chips on sm+ */}
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-[#C85A32] sm:text-[#70685F] shrink-0" />
        <span className="hidden sm:inline text-xs text-[#7A7165] font-medium pl-0.5">Filter:</span>
        {/* Mobile: native select */}
        <select
          className="sm:hidden flex-1 px-3 py-2 rounded-full border border-[#DDD6C8] bg-white text-xs font-semibold text-[#231E1B] focus:outline-none min-h-[36px] cursor-pointer"
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as any)}
        >
          <option value="ALL">All Items</option>
          <option value="CRITICAL">Critical Issues</option>
          <option value="RISKS">Risks &amp; Flags</option>
          <option value="MY_TASKS">My Assigned Work</option>
        </select>
        {/* Desktop: pill chips */}
        <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {[
            { key: 'ALL', label: 'All Items' },
            { key: 'CRITICAL', label: 'Critical Issues' },
            { key: 'RISKS', label: 'Risks & Flags' },
            { key: 'MY_TASKS', label: 'My Assigned Work' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key as any)}
              className={`px-3 sm:px-3.5 py-1.5 sm:py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all min-h-[36px] sm:min-h-[40px] cursor-pointer shrink-0 active:scale-95 flex items-center justify-center ${
                activeFilter === f.key
                  ? 'bg-[#C85A32] text-white shadow-xs font-semibold'
                  : 'bg-[#F3EFE6] text-[#554F47] hover:bg-[#EAE4D6]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-white/70 border border-[#EAE3D5] animate-pulse space-y-2.5"
            >
              <div className="h-4 w-1/3 bg-[#E8E2D5] rounded-md" />
              <div className="h-3 w-3/4 bg-[#E8E2D5] rounded-md" />
              <div className="h-3 w-1/2 bg-[#E8E2D5] rounded-md" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchAlerts}
            className="px-3 py-1 rounded-lg bg-white border border-[#F87171] text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredAlerts.length === 0 && (
        <div className="p-8 rounded-2xl bg-white border border-[#EAE3D5] text-center space-y-2">
          <CheckCircle2 className="w-10 h-10 text-[#526E55] mx-auto" />
          <h3 className="font-serif text-lg font-bold text-[#231E1B]">All clear! No pending alerts</h3>
          <p className="text-xs text-[#70675D] max-w-sm mx-auto">
            There are no open critical issues, unmitigated risks, or blocked tasks matching your filter.
          </p>
        </div>
      )}

      {/* Real database events stream */}
      {!loading && !error && filteredAlerts.length > 0 && (
        <div className="space-y-3">
          {filteredAlerts.map((item) => {
            return (
              <div
                key={item.id}
                id={`alert-card-${item.id}`}
                onClick={() => {
                  if (item.category === 'CRITICAL_ISSUE') {
                    onSelectProject(item.projectId, 'issues');
                  } else if (item.category === 'HIGH_RISK') {
                    onSelectProject(item.projectId, 'risks');
                  } else {
                    onSelectProject(item.projectId, 'tasks');
                  }
                }}
                className="p-4 rounded-2xl bg-white border border-[#EAE3D5] hover:border-[#D5C9B8] hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-[#8C6D58] bg-[#F5F0E6] px-2.5 py-0.5 rounded-full">
                        {item.projectName}
                      </span>
                      {item.severity === 'Critical' && (
                        <SeverityBadge severity="Critical" />
                      )}
                      {item.severity === 'High' && (
                        <SeverityBadge severity="High" />
                      )}
                      {item.category === 'BLOCKED' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#991B1B]">
                          BLOCKED
                        </span>
                      )}
                    </div>

                    <h4 className="font-semibold text-sm text-[#231E1B] group-hover:text-[#C85A32] transition-colors line-clamp-2">
                      {item.title}
                    </h4>

                    <p className="text-xs text-[#70675D] line-clamp-2">
                      {item.subtitle}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 text-[#8C7E70] group-hover:text-[#C85A32] transition-colors pt-1">
                    <span className="text-xs font-medium hidden sm:inline">View</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* User's assigned tasks list */}
      {data?.myTasks && data.myTasks.length > 0 && (
        <div className="pt-4 border-t border-[#E8E2D5] space-y-3">
          <h3 className="font-serif text-lg font-bold text-[#231E1B] flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-[#C85A32]" />
            Your Open Tasks
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.myTasks.map((t) => (
              <div
                key={t.id}
                onClick={() => onSelectProject(t.phase.project.id, 'tasks')}
                className="p-3.5 rounded-2xl bg-white border border-[#EAE3D5] hover:border-[#C85A32]/40 transition-all cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8C6D58] font-medium">{t.phase.project.name}</span>
                  <span className="text-[#70675D]">{t.plannedHours}h planned</span>
                </div>
                <div className="font-medium text-sm text-[#231E1B] line-clamp-1">{t.title}</div>
                <div className="flex items-center justify-between text-xs text-[#70675D]">
                  <span>Due: {new Date(t.plannedEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#F5F1E8] text-[#554F47] text-[10px]">
                    {t.state}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
