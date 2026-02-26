import React, { useState, useRef } from 'react';
import { LayoutDashboard, FileText, ClipboardList, Send, BarChart3, Settings, LogOut, UserCircle, Users, Briefcase, BookOpen, UserPlus, ShieldAlert, X, FolderInput, FileSignature, MessageSquare, Loader2, UserCog, ShieldCheck, PenTool, CalendarDays, Archive, FolderArchive, ChevronDown, Bell } from 'lucide-react';
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
  const oneDoorAllowedViews = ['dashboard', 'internal_chat', 'receive_record', 'receive_contract', 'all_records', 'personal_profile', 'account_settings', 'utilities', 'handover_list', 'work_schedule', 'archive_records'];
  const teamLeaderAllowedViews = ['dashboard', 'personal_profile', 'all_records', 'excerpt_management', 'reports', 'account_settings', 'internal_chat', 'utilities', 'work_schedule', 'archive_records'];

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
        { id: 'receive_record', label: 'Hồ sơ', icon: FolderInput, visible: true },
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
        { id: 'all_records', label: 'Đo đạc', icon: FileText, visible: true, badge: !isOneDoor ? warningRecordsCount : 0, badgeColor: 'bg-red-600' },
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

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (itemId: string) => {
    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
    setActiveDropdown(itemId);
  };

  const handleMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 200);
  };

  const handleMenuClick = (viewId: string) => {
    setCurrentView(viewId);
    setActiveDropdown(null);
    setMobileOpen(false);
  };

  return (
    <div className="bg-[#1e3a8a] text-white min-h-[64px] py-1 flex items-center justify-between px-4 shadow-md shrink-0 z-50 relative">
      {/* LEFT: BRAND */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="bg-white/10 p-1.5 rounded-lg">
          <ShieldCheck size={24} className="text-white" />
        </div>
        <div className="flex flex-col leading-tight">
          <h1 className="font-bold text-sm uppercase tracking-wide">Hệ thống tiếp nhận và</h1>
          <span className="font-bold text-sm uppercase tracking-wide">quản lý hồ sơ đo đạc</span>
          <span className="text-[10px] text-blue-200 font-normal">Chi nhánh Chơn Thành</span>
        </div>
      </div>

      {/* CENTER: NAVIGATION */}
      <nav className="hidden md:flex items-center gap-1 h-full px-4 overflow-visible">
        {menuItems.map((item) => {
          // Check visibility
          if (isOneDoor && !oneDoorAllowedViews.includes(item.id) && !item.isDropdown) return null;
          if (isTeamLeader && !teamLeaderAllowedViews.includes(item.id) && !item.isDropdown) return null;
          if (!item.visible) return null;

          // Check if any sub-item is active
          const isGroupActive = item.subItems?.some(sub => currentView === sub.id) || currentView === item.id;
          const isActive = currentView === item.id || isGroupActive;

          // Render Tab Group
          if ((item as any).isTabGroup) {
            return (
              <div key={item.id} className="flex items-stretch gap-1 mx-2 bg-blue-800/40 rounded-lg p-1 border border-blue-700/50 h-full">
                <div className="flex flex-col items-center justify-center gap-0.5 px-2 text-blue-200 border-r border-blue-700/50 mr-1 min-w-[60px]">
                  <item.icon size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-center leading-tight">{item.label}</span>
                </div>
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
                        flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded text-[11px] font-medium transition-all h-full min-w-[60px] text-center
                        ${isSubActive ? 'bg-white text-blue-900 shadow-sm' : 'text-blue-100 hover:bg-white/10 hover:text-white'}
                      `}
                    >
                      <sub.icon size={16} />
                      <span className="leading-tight">{sub.label}</span>
                      {sub.badge !== undefined && sub.badge > 0 && (
                        <span className={`absolute top-0 right-0 -mt-1 -mr-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white ${sub.badgeColor || 'bg-red-500'} shadow-sm`}>
                          {sub.badge > 99 ? '99+' : sub.badge}
                        </span>
                      )}
                    </button>
                   );
                })}
              </div>
            );
          }

          if (item.isDropdown) {
            return (
              <div 
                key={item.id}
                className="relative h-full flex items-center"
                onMouseEnter={() => handleMouseEnter(item.id)}
                onMouseLeave={handleMouseLeave}
              >
                <button 
                  className={`
                    flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors h-full min-w-[60px] text-center
                    ${isActive ? 'bg-white/20 text-white' : 'text-blue-100 hover:bg-white/10 hover:text-white'}
                  `}
                >
                  <item.icon size={20} />
                  <span className="leading-tight">{item.label}</span>
                  {/* Badge for group if needed */}
                  {item.subItems?.some(sub => sub.badge && sub.badge > 0) && (
                     <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500"></span>
                  )}
                </button>

                {/* Dropdown Menu */}
                {activeDropdown === item.id && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-md shadow-xl border border-gray-200 py-1 text-gray-800 animate-in fade-in slide-in-from-top-2 duration-150">
                    {item.subItems?.map(sub => {
                       if (isOneDoor && !oneDoorAllowedViews.includes(sub.id)) return null;
                       if (isTeamLeader && !teamLeaderAllowedViews.includes(sub.id)) return null;
                       if (!sub.visible) return null;

                       return (
                        <button
                          key={sub.id}
                          onClick={() => handleMenuClick(sub.id)}
                          className={`
                            w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors text-left
                            ${currentView === sub.id ? 'text-blue-700 font-bold bg-blue-50' : 'text-gray-600'}
                          `}
                        >
                          <sub.icon size={16} className={currentView === sub.id ? 'text-blue-600' : 'text-gray-400'} />
                          <span className="flex-1">{sub.label}</span>
                          {sub.badge !== undefined && sub.badge > 0 && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white ${sub.badgeColor || 'bg-red-500'}`}>
                              {sub.badge > 99 ? '99+' : sub.badge}
                            </span>
                          )}
                        </button>
                       );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => handleMenuClick(item.id)}
              className={`
                flex flex-col items-center justify-center gap-0.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors mx-1 relative h-full min-w-[60px] text-center
                ${isActive ? 'bg-white/20 text-white' : 'text-blue-100 hover:bg-white/10 hover:text-white'}
              `}
            >
              <item.icon size={20} />
              <span className="leading-tight">{item.label}</span>
              {item.id === 'reports' && isGeneratingReport && (
                <Loader2 size={14} className="animate-spin text-amber-400 absolute top-1 right-1" />
              )}
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`absolute top-0 right-0 -mt-1 -mr-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white ${item.badgeColor || 'bg-red-500'} shadow-sm`}>
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* RIGHT: USER INFO */}
      <div className="flex items-center gap-4 shrink-0">
        {/* Notification Bell */}
        <button className="relative p-2 text-blue-200 hover:text-white transition-colors">
          <Bell size={20} />
          {unreadMessagesCount > 0 && (
            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#1e3a8a]"></span>
          )}
        </button>

        <div className="h-8 w-[1px] bg-blue-700/50"></div>

        <div className="flex items-center gap-3 group relative cursor-pointer">
           <div className="w-9 h-9 rounded-full bg-blue-700 flex items-center justify-center text-white ring-2 ring-blue-600/50">
              <UserCircle size={20} />
           </div>
           <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold leading-none">{currentUser.name}</span>
              <span className="text-[10px] text-blue-300 uppercase font-semibold tracking-wider mt-0.5">
                {currentUser.role === UserRole.ADMIN ? 'Administrator' : currentUser.role === UserRole.SUBADMIN ? 'Phó quản trị' : currentUser.role === UserRole.TEAM_LEADER ? 'Nhóm trưởng' : currentUser.role === UserRole.ONEDOOR ? 'Một cửa' : 'Nhân viên'}
              </span>
           </div>
           
           {/* Logout Button */}
           <button 
             onClick={onLogout}
             className="ml-2 p-2 text-blue-200 hover:text-red-400 hover:bg-white/10 rounded-full transition-all"
             title="Đăng xuất"
           >
             <LogOut size={18} />
           </button>
        </div>
      </div>
    </div>
  );
};

export default TopNavigation;