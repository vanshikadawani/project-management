/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { TopNav } from './components/TopNav.tsx';
import { BottomNav, NavTab } from './components/BottomNav.tsx';
import { NotificationsModal } from './components/NotificationsModal.tsx';
import { AuthView } from './views/AuthView.tsx';
import { AlertsView } from './views/AlertsView.tsx';
import { ProjectsView } from './views/ProjectsView.tsx';
import { ProjectDetailView } from './views/ProjectDetailView.tsx';
import { IssuesView } from './views/IssuesView.tsx';
import { WorkloadView } from './views/WorkloadView.tsx';
import { ChatView } from './views/ChatView.tsx';
import { CalendarView } from './views/CalendarView.tsx';
import { getSocket } from './lib/socket.ts';
import { apiFetch } from './lib/api.ts';

function MainApp() {
  const { currentUser, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('alerts');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectInitialTab, setProjectInitialTab] = useState<string>('phases');
  const [alertsBadge, setAlertsBadge] = useState<number>(0);
  const [criticalIssuesBadge, setCriticalIssuesBadge] = useState<number>(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [showCalendar, setShowCalendar] = useState(false);

  // Fetch unread notifications count
  const fetchNotificationCount = async () => {
    if (!currentUser) return;
    try {
      const res = await apiFetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setUnreadNotificationsCount(data.unreadCount || 0);
      }
    } catch {
      // silent fallback
    }
  };

  useEffect(() => {
    fetchNotificationCount();
  }, [currentUser]);

  // Real-time notification updates
  useEffect(() => {
    if (!currentUser) return;
    const socket = getSocket();

    const handleNewNotification = () => {
      setUnreadNotificationsCount((prev) => prev + 1);
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [currentUser]);

  // Poll / fetch active badges for bottom navigation
  useEffect(() => {
    if (!currentUser) return;
    const fetchBadges = async () => {
      try {
        const res = await apiFetch('/api/alerts');
        if (res.ok) {
          const data = await res.json();
          setAlertsBadge(data.alerts?.length || 0);
          setCriticalIssuesBadge(data.summary?.criticalIssuesCount || 0);
        }
      } catch (err) {
        // silent badge fallback
      }
    };
    fetchBadges();
  }, [currentUser, activeTab, selectedProjectId]);

  const handleSelectProject = (projectId: string, initialTab: string = 'phases') => {
    setSelectedProjectId(projectId);
    setProjectInitialTab(initialTab);
    setIsNotificationsOpen(false);
    setShowCalendar(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab);
    // If switching tabs, clear selected project drilldown
    setSelectedProjectId(null);
    setShowCalendar(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleShowCalendar = () => {
    setShowCalendar(true);
    setSelectedProjectId(null);
    setIsNotificationsOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#C85A32] flex items-center justify-center text-white font-serif font-bold text-2xl shadow-md animate-pulse">
          F
        </div>
        <p className="font-serif text-sm font-semibold text-[#5A524A] tracking-wide">
          Loading Fern &amp; Foley Projects...
        </p>
      </div>
    );
  }

  // If unauthenticated, redirect / render AuthView
  if (!currentUser) {
    return <AuthView />;
  }

  return (
    <div className="min-h-screen bg-[#FBF9F4] text-[#231E1B] flex flex-col antialiased selection:bg-[#FBECE6] selection:text-[#C85A32]">
      {/* Fixed Top Brand & Auth Bar */}
      <TopNav
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenCalendar={handleShowCalendar}
        unreadCount={unreadNotificationsCount}
      />

      {/* Main Screen Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        {selectedProjectId ? (
          <ProjectDetailView
            projectId={selectedProjectId}
            initialTab={projectInitialTab}
            onBack={() => setSelectedProjectId(null)}
          />
        ) : showCalendar ? (
          <CalendarView onSelectProject={handleSelectProject} />
        ) : (
          <>
            {activeTab === 'alerts' && (
              <AlertsView 
                onSelectProject={handleSelectProject} 
                onShowCalendar={handleShowCalendar}
              />
            )}
            {activeTab === 'projects' && (
              <ProjectsView onSelectProject={handleSelectProject} />
            )}
            {activeTab === 'issues' && (
              <IssuesView onSelectProject={handleSelectProject} />
            )}
            {activeTab === 'workload' && <WorkloadView />}
            {activeTab === 'chat' && <ChatView />}
          </>
        )}
      </main>

      {/* Fixed Bottom 5-Tab Navigation */}
      <BottomNav
        activeTab={selectedProjectId ? 'projects' : activeTab}
        onTabChange={handleTabChange}
        alertsCount={alertsBadge}
        criticalIssuesCount={criticalIssuesBadge}
      />

      {/* Real-time Notifications Drawer */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => {
          setIsNotificationsOpen(false);
          fetchNotificationCount();
        }}
        onSelectProject={handleSelectProject}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
