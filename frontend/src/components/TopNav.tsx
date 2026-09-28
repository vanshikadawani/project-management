import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Shield, UserCheck, ChevronDown, Building2, Bell, LogOut, Calendar } from 'lucide-react';

interface TopNavProps {
  onOpenNotifications?: () => void;
  onOpenCalendar?: () => void;
  unreadCount?: number;
}

export const TopNav: React.FC<TopNavProps> = ({ onOpenNotifications, onOpenCalendar, unreadCount = 0 }) => {
  const { currentUser, logout, isLoading } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'CEO':
        return 'bg-[#FBE8E2] text-[#A63C1E] border border-[#F3CEC1] font-semibold';
      case 'ProjectOwner':
        return 'bg-[#EBF2EB] text-[#2D5A34] border border-[#C6DEC7]';
      default:
        return 'bg-[#EFECE4] text-[#554E45] border border-[#DDD6C8]';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'CEO':
        return 'CEO';
      case 'ProjectOwner':
        return 'Project Owner';
      default:
        return 'Employee';
    }
  };

  return (
    <>
      <header
        id="top-nav-bar"
        className="sticky top-0 z-40 w-full bg-[#FBF9F4]/90 backdrop-blur-md border-b border-[#E8E2D5] px-4 py-3"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Logo Brand Header */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#C85A32] flex items-center justify-center text-white shadow-xs">
              <span className="font-serif font-bold text-base leading-none">F</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-lg font-bold tracking-tight text-[#231E1B]">
                  FERN &amp; FOLEY
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#EAE3D5] text-[#60564C]">
                  PROJECTS
                </span>
              </div>
              <p className="text-[11px] text-[#7A7165] hidden sm:block">
                Project Operations &amp; Execution System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Calendar Button */}
            {onOpenCalendar && (
              <button
                id="top-nav-calendar-btn"
                onClick={onOpenCalendar}
                className="p-2.5 rounded-full bg-[#F5F1E8] hover:bg-[#EDE7DC] border border-[#E0D9CB] text-[#70685F] hover:text-[#231E1B] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                title="Calendar"
              >
                <Calendar className="w-4 h-4" />
              </button>
            )}

            {/* Real-time Notifications Bell */}
            <button
              id="top-nav-notifications-btn"
              onClick={onOpenNotifications}
              className="relative p-2.5 rounded-full bg-[#F5F1E8] hover:bg-[#EDE7DC] border border-[#E0D9CB] text-[#70685F] hover:text-[#231E1B] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-[#C85A32] text-white flex items-center justify-center shadow-xs">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {/* Authenticated User Profile */}
            <div className="relative">
              <button
                id="user-profile-button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F5F1E8] hover:bg-[#EDE7DC] border border-[#E0D9CB] transition-colors min-h-[44px] cursor-pointer"
                title="View authenticated account details"
              >
                <img
                  src={currentUser?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${currentUser?.name || 'User'}`}
                  alt={currentUser?.name}
                  className="w-7 h-7 rounded-full object-cover border border-white shadow-2xs"
                  referrerPolicy="no-referrer"
                />
                <div className="text-left leading-tight hidden xs:block sm:block">
                  <div className="text-xs font-semibold text-[#231E1B] truncate max-w-[120px]">
                    {currentUser?.name || 'Loading...'}
                  </div>
                  <div className="text-[10px] text-[#70675D]">
                    {currentUser ? getRoleLabel(currentUser.role) : ''}
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${currentUser ? getRoleBadgeStyle(currentUser.role) : ''}`}
                >
                  {currentUser?.role === 'ProjectOwner' ? 'Owner' : currentUser?.role}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#7A7165]" />
              </button>

              {/* Authenticated User Profile Card */}
              {isMenuOpen && (
                <div
                  id="user-profile-dropdown"
                  className="absolute right-0 mt-2 w-72 rounded-2xl bg-white shadow-xl border border-[#E2DBD0] p-4 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#EFECE4]">
                    <h4 className="font-semibold text-sm text-[#231E1B] flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-[#C85A32]" />
                      Account Profile
                    </h4>
                    <button
                      onClick={() => setIsMenuOpen(false)}
                      className="text-xs text-[#8F867A] hover:text-[#231E1B] px-2 py-1 rounded-md cursor-pointer"
                    >
                      Close
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <img
                      src={currentUser?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${currentUser?.name || 'User'}`}
                      alt={currentUser?.name}
                      className="w-12 h-12 rounded-full border border-[#E8E2D5] shadow-xs"
                      referrerPolicy="no-referrer"
                    />
                    <div className="space-y-0.5">
                      <div className="text-sm font-bold text-[#231E1B]">
                        {currentUser?.name}
                      </div>
                      <div className="text-xs text-[#7A7165]">
                        {currentUser?.email}
                      </div>
                      <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full ${currentUser ? getRoleBadgeStyle(currentUser.role) : ''}`}>
                        {currentUser ? getRoleLabel(currentUser.role) : ''}
                      </span>
                    </div>
                  </div>

                  {currentUser?.department && (
                    <div className="pt-2 border-t border-[#EFECE4] text-xs text-[#70685F] flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#8F867A]" />
                      Department: <strong className="text-[#231E1B]">{currentUser.department}</strong>
                    </div>
                  )}

                  <div className="pt-2 border-t border-[#EFECE4] text-[11px] text-[#7A7165] bg-[#FAF7F0] p-2.5 rounded-xl space-y-1">
                    <div className="font-semibold text-[#231E1B] flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-[#526E55]" />
                      Server-Enforced Access
                    </div>
                    <p className="text-[10px] text-[#7A7165] leading-relaxed">
                      Role and permissions are verified by the server on every request.
                    </p>
                  </div>

                  {/* Sign Out Action */}
                  <button
                    id="user-logout-btn"
                    onClick={async () => {
                      setIsMenuOpen(false);
                      await logout();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-[#F5F1E8] hover:bg-[#FBE8E2] text-[#8C3A27] text-xs font-semibold flex items-center justify-center gap-1.5 border border-[#E5DDCF] transition-colors cursor-pointer min-h-[40px]"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
        </div>
      </div>
    </header>
    </>
  );
};
