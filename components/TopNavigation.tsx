import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, FileText, ClipboardList, Send, BarChart3, Settings, LogOut, UserCircle, Users, Briefcase, BookOpen, UserPlus, ShieldAlert, X, FolderInput, FileSignature, MessageSquare, Loader2, UserCog, ShieldCheck, PenTool, CalendarDays, Archive, FolderArchive, ChevronDown, Bell, FilePlus, Ruler, ChevronRight } from 'lucide-react';
import { User, UserRole } from '../types';

interface TopNavigationProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  currentUser: User;
  onLogout: () => void;
  isGeneratingReport?: boolean;
  onOpenAccountSettings: () => void;
  unreadMessagesCount: number;
  warningRecordsCount: number;
  reminderCount: number;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const TopNavigation: React.FC<TopNavigationProps> = ({ 
  currentView, 
  setCurrentView, 
  currentUser, 
  onLogout,
  isGeneratingReport = false,
  unreadMessagesCount,
  warningRecordsCount,
  reminderCount,
  mobileOpen,
  setMobileOpen
}) => {
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isSubadmin = currentUser.role === UserRole.SUBADMIN;
  const isTeamLeader = currentUser.role === UserRole.TEAM_LEADER;
  const isOneDoor = currentUser.role === UserRole.ONEDOOR;
  const isEmployee = currentUser.role === UserRole.EMPLOYEE;

  // Cập nhật danh sách các view được phép
  const oneDoorAllowedViews = ['dashboard', 'internal_chat', 'receive_record', 'receive_contract', 'all_records', 'personal_profile', 'account_settings', 'utilities', 'handover_list', 'work_schedule', 'archive_records', 'receive_group', 'records_group'];
  const teamLeaderAllowedViews = ['dashboard', 'personal_profile', 'all_records', 'excerpt_management', 'reports', 'account_settings', 'internal_chat', 'utilities', 'work_schedule', 'archive_records', 'records_group'];

  // Define menu structure
  const menuItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, visible: true, badge: reminderCount, badgeColor: 'bg-pink-500' },
    
    // "Tiếp nhận" tab group
    {
      id: 'receive_group',
      label: 'Tiếp nhận',
      icon: FolderInput,
      visible: !isTeamLeader && !isEmployee,
      isDropdown: false,
      isTabGroup: true,
      subItems: [
        { id: 'receive_record', label: 'Hồ sơ', icon: FilePlus, visible: true },
        { id: 'receive_contract', label: 'Hợp đồng', icon: FileSignature, visible: true },
      ]
    },

    // "Hồ sơ" tab group
    { 
      id: 'records_group', 
      label: 'Hồ sơ', 
      icon: FileText, 
      visible: true,
      isDropdown: false,
      isTabGroup: true,
      subItems: [
        { id: 'all_records', label: 'Đo đạc', icon: Ruler, visible: true },
        { id: 'archive_records', label: 'Lưu trữ', icon: FolderArchive, visible: true },
      ]
    },

    // Top level items moved from groups
    { id: 'excerpt_management', label: 'Số trích lục', icon: BookOpen, visible: !isOneDoor },
    { id: 'work_schedule', label: 'Lịch công tác', icon: CalendarDays, visible: true },
    { id: 'personal_profile', label: 'Hồ sơ cá nhân', icon: Briefcase, visible: true },
    { id: 'utilities', label: 'Tiện ích', icon: PenTool, visible: true },

    { id: 'reports', label: 'Báo cáo', icon: BarChart3, visible: !isOneDoor },

    // "Hệ thống" dropdown group (Settings)
    {
      id: 'system_group',
      label: 'Hệ thống',
      icon: Settings,
      visible: true,
      isDropdown: true,
      subItems: [
        { id: 'account_settings', label: 'Cài đặt tài khoản', icon: UserCog, visible: true },
        // Chat nội bộ hidden
        { id: 'internal_chat', label: 'Chat nội bộ', icon: MessageSquare, visible: false, badge: unreadMessagesCount, badgeColor: 'bg-blue-500' },
        ...(isAdmin ? [{ id: 'user_management', label: 'Quản lý tài khoản', icon: Users, visible: true }] : []),
        { id: 'employee_management', label: 'Quản lý nhân sự', icon: UserCog, visible: true },
        ...(isAdmin ? [{ id: 'system_settings', label: 'Cấu hình hệ thống', icon: ShieldAlert, visible: true }] : []),
      ]
    }
  ];

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['system_group']));

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) newSet.delete(groupId);
      else newSet.add(groupId);
      return newSet;
    });
  };

  const handleMenuClick = (viewId: string) => {
    setCurrentView(viewId);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-[90px] bg-[#1e3a8a] text-white shadow-xl transform transition-transform duration-300 ease-in-out flex flex-col pt-14 md:pt-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
      `}>
        
        {/* NAVIGATION */}
        <nav className="flex-1 overflow-y-auto py-2 px-1 space-y-1 custom-scrollbar">
          {menuItems.map((item) => {
            // Check visibility
            if (isOneDoor && !oneDoorAllowedViews.includes(item.id) && !item.isDropdown && !(item as any).isTabGroup) return null;
            if (isTeamLeader && !teamLeaderAllowedViews.includes(item.id) && !item.isDropdown && !(item as any).isTabGroup) return null;
            if (!item.visible) return null;

            // Check if any sub-item is active
            const isGroupActive = item.subItems?.some(sub => currentView === sub.id) || currentView === item.id;
            const isActive = currentView === item.id;

            // Render Tab Group (Section Header + Items)
            if ((item as any).isTabGroup) {
              // Check if group has visible items for current user
              const hasVisibleItems = item.subItems?.some(sub => {
                 if (isOneDoor && !oneDoorAllowedViews.includes(sub.id)) return false;
                 if (isTeamLeader && !teamLeaderAllowedViews.includes(sub.id)) return false;
                 return sub.visible;
              });
              
              if (!hasVisibleItems) return null;

              return (
                <div key={item.id} className="mb-2 pb-2 border-b border-blue-800/50 last:border-0">
                  <div className="px-1 mb-1 text-[10px] font-bold text-blue-300 uppercase tracking-wider text-center flex flex-col items-center justify-center">
                    {/* <item.icon size={14} className="mb-0.5 opacity-70" /> */}
                    <span>{item.label}</span>
                  </div>
                  <div className="space-y-1">
                    {item.subItems?.map(sub => {
                       if (isOneDoor && !oneDoorAllowedViews.includes(sub.id)) return null;
                       if (isTeamLeader && !teamLeaderAllowedViews.includes(sub.id)) return null;
                       if (!sub.visible) return null;
    
                       const isSubActive = currentView === sub.id;
                       return (
                        <button
                          key={sub.id}
                          onClick={() => handleMenuClick(sub.id)}
                          className={`
                            w-full flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-all relative group
                            ${isSubActive ? 'bg-white text-blue-900 shadow-md' : 'text-blue-100 hover:bg-white/10 hover:text-white'}
                          `}
                          title={sub.label}
                        >
                          <sub.icon size={20} />
                          <span className="text-[10px] font-medium text-center leading-tight line-clamp-2 w-full">{sub.label}</span>
                          {(sub as any).badge !== undefined && (sub as any).badge > 0 && (
                            <span className={`absolute top-0 right-0 -mt-1 -mr-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white ${(sub as any).badgeColor || 'bg-red-500'} shadow-sm z-10`}>
                              {(sub as any).badge > 99 ? '99+' : (sub as any).badge}
                            </span>
                          )}
                        </button>
                       );
                    })}
                  </div>
                </div>
              );
            }

            // Render Dropdown (Collapsible) - For "Hệ thống"
            if (item.isDropdown) {
              const isExpanded = expandedGroups.has(item.id);
              return (
                <div key={item.id} className="mb-2 pb-2 border-b border-blue-800/50 last:border-0">
                   <button
                    onClick={() => toggleGroup(item.id)}
                    className={`
                      w-full flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-colors relative
                      ${isGroupActive ? 'text-white bg-white/10' : 'text-blue-100 hover:bg-white/5 hover:text-white'}
                    `}
                  >
                    <item.icon size={20} />
                    <span className="text-[10px] font-medium text-center leading-tight">{item.label}</span>
                    <ChevronDown size={12} className={`transition-transform duration-200 absolute bottom-1 right-1 opacity-50 ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isExpanded && (
                    <div className="mt-1 space-y-1 animate-in slide-in-from-top-2 duration-200 bg-black/20 rounded-lg p-1">
                      {item.subItems?.map(sub => {
                         if (isOneDoor && !oneDoorAllowedViews.includes(sub.id)) return null;
                         if (isTeamLeader && !teamLeaderAllowedViews.includes(sub.id)) return null;
                         if (!sub.visible) return null;
  
                         return (
                          <button
                            key={sub.id}
                            onClick={() => handleMenuClick(sub.id)}
                            className={`
                              w-full flex flex-col items-center justify-center gap-1 p-1.5 rounded transition-colors
                              ${currentView === sub.id ? 'text-blue-900 bg-white font-bold shadow-sm' : 'text-blue-200 hover:text-white hover:bg-white/5'}
                            `}
                            title={sub.label}
                          >
                            <sub.icon size={16} />
                            {/* <span className="text-[9px] text-center leading-tight">{sub.label}</span> */}
                            {(sub as any).badge !== undefined && (sub as any).badge > 0 && (
                              <span className={`absolute top-0 right-0 w-2 h-2 rounded-full ${(sub as any).badgeColor || 'bg-red-500'}`}></span>
                            )}
                          </button>
                         );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Render Standard Item
            return (
              <button
                key={item.id}
                onClick={() => handleMenuClick(item.id)}
                className={`
                  w-full flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-colors relative mb-1
                  ${isActive ? 'bg-white text-blue-900 shadow-md' : 'text-blue-100 hover:bg-white/10 hover:text-white'}
                `}
              >
                <item.icon size={20} />
                <span className="text-[10px] font-medium text-center leading-tight line-clamp-2 w-full">{item.label}</span>
                {item.id === 'reports' && isGeneratingReport && (
                  <Loader2 size={12} className="animate-spin text-amber-400 absolute top-1 right-1" />
                )}
                {(item as any).badge !== undefined && (item as any).badge > 0 && (
                  <span className={`absolute top-0 right-0 -mt-1 -mr-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white ${(item as any).badgeColor || 'bg-red-500'} shadow-sm`}>
                    {(item as any).badge > 99 ? '99+' : (item as any).badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
};

export default TopNavigation;