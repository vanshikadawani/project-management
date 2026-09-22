import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Calendar, Plus, X, Edit2, Trash2, Check, ArrowLeft } from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  color: string;
  extendedProps: {
    type: 'task' | 'milestone' | 'approval' | 'risk' | 'issue' | 'reminder';
    projectId?: string;
    projectName?: string;
    taskId?: string;
    milestoneId?: string;
    approvalId?: string;
    riskId?: string;
    issueId?: string;
    reminderId?: string;
    [key: string]: any;
  };
}

interface ReminderFormData {
  title: string;
  description: string;
  reminderDate: string;
}

interface CalendarViewProps {
  onSelectProject: (projectId: string, initialTab?: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ onSelectProject }) => {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderForm, setReminderForm] = useState<ReminderFormData>({
    title: '',
    description: '',
    reminderDate: new Date().toISOString().split('T')[0],
  });

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Calculate date range based on view
      const start = new Date(currentDate);
      const end = new Date(currentDate);
      
      if (view === 'month') {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
      } else if (view === 'week') {
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Monday start
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
      } else { // day view
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      }
      
      const res = await fetch(`/api/calendar?start=${start.toISOString()}&end=${end.toISOString()}`);
      if (!res.ok) throw new Error('Failed to load calendar events');
      const data = await res.json();
      setEvents(data);
    } catch (err: any) {
      setError(err.message || 'Error fetching calendar events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchEvents();
    }
  }, [currentUser, view, currentDate]);

  const handleEventClick = (event: CalendarEvent) => {
    const { extendedProps } = event;
    
    switch (extendedProps.type) {
      case 'task':
        if (extendedProps.projectId && extendedProps.taskId) {
          onSelectProject(extendedProps.projectId, 'tasks');
        }
        break;
      case 'milestone':
        if (extendedProps.projectId) {
          onSelectProject(extendedProps.projectId, 'milestones');
        }
        break;
      case 'approval':
        if (extendedProps.projectId) {
          onSelectProject(extendedProps.projectId, 'approvals');
        }
        break;
      case 'risk':
        if (extendedProps.projectId) {
          onSelectProject(extendedProps.projectId, 'risks');
        }
        break;
      case 'issue':
        if (extendedProps.projectId) {
          onSelectProject(extendedProps.projectId, 'issues');
        }
        break;
      case 'reminder':
        // Reminders are handled in modal
        break;
    }
  };

  const handleCreateReminder = async () => {
    try {
      const res = await fetch('/api/calendar/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reminderForm),
      });
      
      if (!res.ok) throw new Error('Failed to create reminder');
      
      setShowReminderModal(false);
      setReminderForm({
        title: '',
        description: '',
        reminderDate: new Date().toISOString().split('T')[0],
      });
      fetchEvents(); // Refresh events
    } catch (err: any) {
      setError(err.message || 'Error creating reminder');
    }
  };

  const handleDeleteReminder = async (reminderId: string) => {
    if (!confirm('Are you sure you want to delete this reminder?')) return;
    
    try {
      const res = await fetch(`/api/calendar/reminders/${reminderId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) throw new Error('Failed to delete reminder');
      
      fetchEvents(); // Refresh events
    } catch (err: any) {
      setError(err.message || 'Error deleting reminder');
    }
  };

  const handleCompleteReminder = async (reminderId: string) => {
    try {
      const res = await fetch(`/api/calendar/reminders/${reminderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: true }),
      });
      
      if (!res.ok) throw new Error('Failed to complete reminder');
      
      fetchEvents(); // Refresh events
    } catch (err: any) {
      setError(err.message || 'Error completing reminder');
    }
  };

  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    const newDate = new Date(currentDate);
    
    if (direction === 'today') {
      setCurrentDate(new Date());
    } else if (direction === 'prev') {
      if (view === 'month') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else if (view === 'week') {
        newDate.setDate(newDate.getDate() - 7);
      } else {
        newDate.setDate(newDate.getDate() - 1);
      }
      setCurrentDate(newDate);
    } else if (direction === 'next') {
      if (view === 'month') {
        newDate.setMonth(newDate.getMonth() + 1);
      } else if (view === 'week') {
        newDate.setDate(newDate.getDate() + 7);
      } else {
        newDate.setDate(newDate.getDate() + 1);
      }
      setCurrentDate(newDate);
    }
  };

  const getDateRangeText = () => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);
    
    if (view === 'month') {
      return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (view === 'week') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      end.setDate(start.getDate() + 6);
      
      if (start.getMonth() === end.getMonth()) {
        return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })}`;
      } else {
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
    } else {
      return start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'task': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'milestone': return 'bg-green-100 text-green-800 border-green-200';
      case 'approval': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'risk': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'issue': return 'bg-red-100 text-red-800 border-red-200';
      case 'reminder': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'task': return 'Task';
      case 'milestone': return 'Milestone';
      case 'approval': return 'Approval';
      case 'risk': return 'Risk';
      case 'issue': return 'Issue';
      case 'reminder': return 'Reminder';
      default: return 'Event';
    }
  };

  // Simple calendar grid for month view
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Get day of week for first day (0 = Sunday, 1 = Monday, etc.)
    let firstDayOfWeek = firstDay.getDay();
    // Adjust to start on Monday
    if (firstDayOfWeek === 0) firstDayOfWeek = 6;
    else firstDayOfWeek -= 1;
    
    const weeks = [];
    let day = 1;
    
    for (let week = 0; week < 6; week++) {
      const days = [];
      
      for (let weekDay = 0; weekDay < 7; weekDay++) {
        if (week === 0 && weekDay < firstDayOfWeek) {
          // Empty days before first day of month
          const prevMonthDay = new Date(year, month, 0 - (firstDayOfWeek - weekDay - 1));
          days.push(
            <div key={`empty-${weekDay}`} className="h-32 p-1 border border-[#E8E2D5] bg-[#FAF7F2]">
              <div className="text-xs text-[#A8A195] text-right">
                {prevMonthDay.getDate()}
              </div>
            </div>
          );
        } else if (day > daysInMonth) {
          // Empty days after last day of month
          const nextMonthDay = new Date(year, month + 1, day - daysInMonth);
          days.push(
            <div key={`empty-end-${weekDay}`} className="h-32 p-1 border border-[#E8E2D5] bg-[#FAF7F2]">
              <div className="text-xs text-[#A8A195] text-right">
                {nextMonthDay.getDate()}
              </div>
            </div>
          );
          day++;
        } else {
          const currentDay = new Date(year, month, day);
          const dayEvents = events.filter(event => {
            const eventDate = new Date(event.start);
            return eventDate.getDate() === day && 
                   eventDate.getMonth() === month && 
                   eventDate.getFullYear() === year;
          });
          
          const isToday = currentDay.toDateString() === new Date().toDateString();
          
          days.push(
            <div 
              key={day} 
              className={`h-32 p-1 border border-[#E8E2D5] ${isToday ? 'bg-[#FBECE6]' : 'bg-white'}`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={`text-xs font-medium ${isToday ? 'text-[#C85A32]' : 'text-[#70675D]'}`}>
                  {currentDay.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                </span>
                <span className={`text-sm font-bold ${isToday ? 'text-[#C85A32]' : 'text-[#231E1B]'}`}>
                  {day}
                </span>
              </div>
              
              <div className="space-y-1 overflow-y-auto max-h-24">
                {dayEvents.slice(0, 3).map((event, idx) => (
                  <div
                    key={event.id}
                    onClick={() => handleEventClick(event)}
                    className={`text-xs p-1.5 rounded-lg border cursor-pointer transition-colors hover:opacity-90 ${
                      getEventTypeColor(event.extendedProps.type)
                    }`}
                  >
                    <div className="font-medium truncate">{event.title}</div>
                    <div className="text-[10px] opacity-75 truncate">
                      {getEventTypeLabel(event.extendedProps.type)}
                      {event.extendedProps.projectName && ` • ${event.extendedProps.projectName}`}
                    </div>
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-[#70675D] px-1">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
          day++;
        }
      }
      
      weeks.push(
        <div key={week} className="grid grid-cols-7 gap-0">
          {days}
        </div>
      );
      
      if (day > daysInMonth) break;
    }
    
    return weeks;
  };

  const renderWeekView = () => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    
    const days = [];
    
    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(start);
      currentDay.setDate(start.getDate() + i);
      
      const dayEvents = events.filter(event => {
        const eventDate = new Date(event.start);
        return eventDate.getDate() === currentDay.getDate() && 
               eventDate.getMonth() === currentDay.getMonth() && 
               eventDate.getFullYear() === currentDay.getFullYear();
      });
      
      const isToday = currentDay.toDateString() === new Date().toDateString();
      
      days.push(
        <div key={i} className="flex-1 border border-[#E8E2D5]">
          <div className={`p-3 border-b border-[#E8E2D5] ${isToday ? 'bg-[#FBECE6]' : 'bg-white'}`}>
            <div className="text-xs font-medium text-[#70675D]">
              {currentDay.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()}
            </div>
            <div className={`text-lg font-bold ${isToday ? 'text-[#C85A32]' : 'text-[#231E1B]'}`}>
              {currentDay.getDate()}
            </div>
            <div className="text-xs text-[#70675D]">
              {currentDay.toLocaleDateString('en-US', { month: 'short' })}
            </div>
          </div>
          
          <div className="p-2 space-y-2 h-[calc(100vh-300px)] overflow-y-auto">
            {dayEvents.length === 0 ? (
              <div className="text-center py-8 text-sm text-[#A8A195]">
                No events
              </div>
            ) : (
              dayEvents.map(event => (
                <div
                  key={event.id}
                  onClick={() => handleEventClick(event)}
                  className={`p-3 rounded-xl border cursor-pointer transition-colors hover:opacity-90 ${
                    getEventTypeColor(event.extendedProps.type)
                  }`}
                >
                  <div className="font-medium text-sm mb-1">{event.title}</div>
                  <div className="text-xs opacity-75 mb-2">
                    {getEventTypeLabel(event.extendedProps.type)}
                    {event.extendedProps.projectName && ` • ${event.extendedProps.projectName}`}
                  </div>
                  {event.extendedProps.type === 'reminder' && (
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCompleteReminder(event.extendedProps.reminderId);
                        }}
                        className="text-xs px-2 py-1 rounded bg-white border border-green-200 text-green-700 hover:bg-green-50"
                      >
                        <Check className="w-3 h-3 inline mr-1" />
                        Complete
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteReminder(event.extendedProps.reminderId);
                        }}
                        className="text-xs px-2 py-1 rounded bg-white border border-red-200 text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3 inline mr-1" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex border border-[#E8E2D5] rounded-xl overflow-hidden">
        {days}
      </div>
    );
  };

  const renderDayView = () => {
    const currentDay = new Date(currentDate);
    const dayEvents = events.filter(event => {
      const eventDate = new Date(event.start);
      return eventDate.getDate() === currentDay.getDate() && 
             eventDate.getMonth() === currentDay.getMonth() && 
             eventDate.getFullYear() === currentDay.getFullYear();
    });
    
    const isToday = currentDay.toDateString() === new Date().toDateString();
    
    // Group events by hour
    const hours = Array.from({ length: 24 }, (_, i) => i);
    
    return (
      <div className="border border-[#E8E2D5] rounded-xl overflow-hidden">
        <div className={`p-4 border-b border-[#E8E2D5] ${isToday ? 'bg-[#FBECE6]' : 'bg-white'}`}>
          <div className="text-xs font-medium text-[#70675D]">
            {currentDay.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()}
          </div>
          <div className="text-2xl font-bold text-[#231E1B]">
            {currentDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        
        <div className="divide-y divide-[#E8E2D5] max-h-[calc(100vh-250px)] overflow-y-auto">
          {hours.map(hour => {
            const hourEvents = dayEvents.filter(event => {
              const eventDate = new Date(event.start);
              return eventDate.getHours() === hour;
            });
            
            return (
              <div key={hour} className="flex min-h-16">
                <div className="w-16 p-3 border-r border-[#E8E2D5] bg-[#FAF7F2] text-sm text-[#70675D]">
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                </div>
                <div className="flex-1 p-3">
                  {hourEvents.map(event => (
                    <div
                      key={event.id}
                      onClick={() => handleEventClick(event)}
                      className={`mb-2 p-3 rounded-xl border cursor-pointer transition-colors hover:opacity-90 ${
                        getEventTypeColor(event.extendedProps.type)
                      }`}
                    >
                      <div className="font-medium text-sm mb-1">{event.title}</div>
                      <div className="text-xs opacity-75">
                        {getEventTypeLabel(event.extendedProps.type)}
                        {event.extendedProps.projectName && ` • ${event.extendedProps.projectName}`}
                      </div>
                      {event.extendedProps.type === 'reminder' && (
                        <div className="flex gap-1 mt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCompleteReminder(event.extendedProps.reminderId);
                            }}
                            className="text-xs px-2 py-1 rounded bg-white border border-green-200 text-green-700 hover:bg-green-50"
                          >
                            <Check className="w-3 h-3 inline mr-1" />
                            Complete
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteReminder(event.extendedProps.reminderId);
                            }}
                            className="text-xs px-2 py-1 rounded bg-white border border-red-200 text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3 inline mr-1" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
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
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="p-2 rounded-lg border border-[#E8E2D5] hover:bg-[#FAF7F2] text-[#70675D] hover:text-[#231E1B] transition-colors cursor-pointer"
            title="Back to Alerts"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#231E1B]">
              Calendar
            </h1>
            <p className="text-sm text-[#70675D]">
              View and manage your project schedule, deadlines, and reminders
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReminderModal(true)}
            className="px-4 py-2 rounded-xl bg-[#C85A32] hover:bg-[#A63C1E] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Reminder
          </button>
        </div>
      </div>

      {/* Calendar Controls */}
      <div className="bg-white border border-[#E8E2D5] rounded-2xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateDate('prev')}
              className="px-3 py-1.5 rounded-lg border border-[#E8E2D5] hover:bg-[#FAF7F2] text-sm font-medium cursor-pointer"
            >
              ← Prev
            </button>
            
            <button
              onClick={() => navigateDate('today')}
              className="px-3 py-1.5 rounded-lg border border-[#E8E2D5] hover:bg-[#FAF7F2] text-sm font-medium cursor-pointer"
            >
              Today
            </button>
            
            <button
              onClick={() => navigateDate('next')}
              className="px-3 py-1.5 rounded-lg border border-[#E8E2D5] hover:bg-[#FAF7F2] text-sm font-medium cursor-pointer"
            >
              Next →
            </button>
            
            <div className="text-lg font-bold text-[#231E1B] ml-4">
              {getDateRangeText()}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {(['month', 'week', 'day'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize cursor-pointer transition-colors ${
                  view === v
                    ? 'bg-[#C85A32] text-white'
                    : 'border border-[#E8E2D5] hover:bg-[#FAF7F2] text-[#70675D]'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="p-4 rounded-2xl bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={fetchEvents}
              className="px-3 py-1 rounded-lg bg-white border border-[#F87171] text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-2">
          {(['task', 'milestone', 'approval', 'risk', 'issue', 'reminder'] as const).map((type) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-full ${getEventTypeColor(type).split(' ')[0]}`} />
              <span className="text-xs text-[#70675D] capitalize">{type}s</span>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar View */}
      <div className="bg-white border border-[#E8E2D5] rounded-2xl overflow-hidden">
        {view === 'month' && (
          <>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-0 border-b border-[#E8E2D5]">
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                <div key={day} className="p-3 text-center text-xs font-semibold text-[#70675D] bg-[#FAF7F2]">
                  {day.substring(0, 3).toUpperCase()}
                </div>
              ))}
            </div>
            
            {/* Month grid */}
            <div className="divide-y divide-[#E8E2D5]">
              {renderMonthView()}
            </div>
          </>
        )}
        
        {view === 'week' && renderWeekView()}
        {view === 'day' && renderDayView()}
      </div>

      {/* Event Type Summary */}
      <div className="bg-white border border-[#E8E2D5] rounded-2xl p-4">
        <h3 className="font-serif text-lg font-bold text-[#231E1B] mb-3">Event Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(['task', 'milestone', 'approval', 'risk', 'issue', 'reminder'] as const).map((type) => {
            const count = events.filter(e => e.extendedProps.type === type).length;
            return (
              <div key={type} className="p-3 rounded-xl border border-[#E8E2D5]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-[#70675D] capitalize">
                    {type}s
                  </span>
                  <div className={`w-3 h-3 rounded-full ${getEventTypeColor(type).split(' ')[0]}`} />
                </div>
                <div className="text-2xl font-bold font-serif text-[#231E1B]">
                  {count}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-[#231E1B]">Add Personal Reminder</h3>
              <button
                onClick={() => setShowReminderModal(false)}
                className="p-1 rounded-lg hover:bg-[#FAF7F2] cursor-pointer"
              >
                <X className="w-5 h-5 text-[#70675D]" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#70675D] mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={reminderForm.title}
                  onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E8E2D5] focus:outline-none focus:ring-2 focus:ring-[#C85A32] focus:border-transparent"
                  placeholder="e.g., Follow up with team"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#70675D] mb-1">
                  Description
                </label>
                <textarea
                  value={reminderForm.description}
                  onChange={(e) => setReminderForm({ ...reminderForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E8E2D5] focus:outline-none focus:ring-2 focus:ring-[#C85A32] focus:border-transparent"
                  placeholder="Optional details..."
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#70675D] mb-1">
                  Reminder Date *
                </label>
                <input
                  type="date"
                  value={reminderForm.reminderDate}
                  onChange={(e) => setReminderForm({ ...reminderForm, reminderDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E8E2D5] focus:outline-none focus:ring-2 focus:ring-[#C85A32] focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => setShowReminderModal(false)}
                className="px-4 py-2 rounded-lg border border-[#E8E2D5] hover:bg-[#FAF7F2] text-sm font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateReminder}
                disabled={!reminderForm.title || !reminderForm.reminderDate}
                className="px-4 py-2 rounded-lg bg-[#C85A32] hover:bg-[#A63C1E] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Add Reminder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};