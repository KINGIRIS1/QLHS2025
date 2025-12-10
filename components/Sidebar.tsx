
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, FileText, ClipboardList, Send, BarChart3, Settings, LogOut, UserCircle, Users, Briefcase, BookOpen, UserPlus, ShieldAlert, X, FolderInput, FileSignature, MessageSquare, Loader2, UserCog, ArrowUpCircle, RefreshCw, CheckCircle, Info, Download, ShieldCheck, Bell } from 'lucide-react';
import { User, UserRole } from '../types';
import { APP_VERSION } from '../constants';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  onOpenSettings: () => void;
  onOpenSystemSettings: () => void;
  currentUser: User;
  onLogout: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isGeneratingReport?: boolean;
  isUpdateAvailable?: boolean;
  latestVersion?: string;
  updateUrl?: string | null; 
  onOpenAccountSettings: () => void;
  // New props for notifications
  unreadMessagesCount: number;
  warningRecordsCount: number;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  setCurrentView, 
  onOpenSettings, 
  onOpenSystemSettings, 
  currentUser, 
  onLogout,
  mobileOpen,
  setMobileOpen,
  isGeneratingReport = false,
  isUpdateAvailable = false,
  latestVersion = '',
  updateUrl = null,
  onOpenAccountSettings,
  unreadMessagesCount,
  warningRecordsCount
}) => {
  const [isBannerVisible, setIsBannerVisible] = useState(true);
  const isElectron = navigator.userAgent.toLowerCase().includes(' electron/');
  
  useEffect(() => {
      if (isUpdateAvailable) setIsBannerVisible(true);
  }, [isUpdateAvailable]);

  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isSubadmin = currentUser.role === UserRole.SUBADMIN;
  const isTeamLeader = currentUser.role === UserRole.TEAM_LEADER;
  const isOneDoor = currentUser.role === UserRole.ONEDOOR;
  const isEmployee = currentUser.role === UserRole.EMPLOYEE;
  
  const hasManagerRights = isAdmin || isSubadmin || isTeamLeader;

  const oneDoorAllowedViews = ['dashboard', 'internal_chat', 'receive_record', 'receive_contract', 'all_records', 'personal_profile', 'account_settings'];
  const teamLeaderAllowedViews = ['dashboard', 'personal_profile', 'assign_tasks', 'all_records', 'excerpt_management', 'reports', 'account_settings', 'internal_chat'];

  const menuItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, visible: true },
    { id: 'internal_chat', label: 'Chat nội bộ', icon: MessageSquare, visible: true, badge: unreadMessagesCount, badgeColor: 'bg-blue-500' },
    { id: 'personal_profile', label: 'Hồ sơ cá nhân', icon: Briefcase, visible: true }, 
    { id: 'receive_record', label: 'Tiếp nhận hồ sơ', icon: FolderInput, visible: !isTeamLeader && !isEmployee },
    { id: 'receive_contract', label: 'Tiếp nhận hợp đồng', icon: FileSignature, visible: !isTeamLeader && !isEmployee },
    // Cập nhật: Badge cảnh báo sẽ hiển thị ở "Tất cả hồ sơ" và ẩn với Một cửa
    { id: 'all_records', label: 'Tất cả hồ sơ', icon: FileText, visible: true, badge: !isOneDoor ? warningRecordsCount : 0, badgeColor: 'bg-red-600' },
    { id: 'assign_tasks', label: 'Giao hồ sơ', icon: UserPlus, visible: hasManagerRights },
    { id: 'excerpt_management', label: 'Số trích lục', icon: BookOpen, visible: !isOneDoor },
    { id: 'check_list', label: 'DS Ký kiểm tra', icon: ClipboardList, visible: isAdmin || isSubadmin },
    { id: 'handover_list', label: 'DS Giao 1 cửa', icon: Send, visible: isAdmin || isSubadmin },
    { id: 'reports', label: 'Báo cáo & Thống kê', icon: BarChart3, visible: !isOneDoor },
    { id: 'account_settings', label: 'Cài đặt tài khoản', icon: UserCog, visible: true },
  ];

  const handleMenuClick = (viewId: string) => {
    setCurrentView(viewId);
    // Chỉ đóng menu khi đang ở chế độ mobile (màn hình < 768px)
    if (window.innerWidth < 768) {
        setMobileOpen(false);
    }
  };

  const handleDownloadUpdate = async () => {
      if (!updateUrl) return;
      
      // Kiểm tra nếu chạy trong Electron và có API mở link ngoài
      if (window.electronAPI && window.electronAPI.openExternal) {
          await window.electronAPI.openExternal(updateUrl);
      } else {
          // Fallback cho trình duyệt web thường
          window.open(updateUrl, '_blank');
      }
  };

  return (
    <>
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* THÊM class 'shrink-0' ĐỂ NGĂN SIDEBAR BỊ CO LẠI */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50 w-64 shrink-0 bg-[#0f172a] text-white min-h-screen flex flex-col shadow-xl transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* BRAND HEADER */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-col gap-3 shrink-0">
          <div className="flex items-start gap-3">
             <div className="bg-blue-600 p-1.5 rounded-lg shadow-blue-500/20 shrink-0 mt-1">
                <ShieldCheck size={20} className="text-white" />
             </div>
             <div className="flex-1">
                 <h1 className="font-bold text-sm text-slate-100 leading-snug">
                    Hệ thống tiếp nhận và quản lý hồ sơ đo đạc
                 </h1>
                 <div className="text-[11px] text-blue-400 font-medium mt-1">
                    Chi nhánh Chơn Thành
                 </div>
             </div>
             <button onClick={() => setMobileOpen(false)} className="md:hidden text-slate-400 hover:text-white"><X size={20} /></button>
          </div>
        </div>

        {/* UPDATE NOTIFICATION */}
        {isUpdateAvailable && isBannerVisible && (
            <div className="bg-amber-600/90 backdrop-blur-sm text-white text-xs px-4 py-3 border-b border-amber-700 flex flex-col gap-2 shadow-inner relative animate-fade-in shrink-0">
                <button 
                    onClick={() => setIsBannerVisible(false)}
                    className="absolute top-1 right-1 text-amber-200 hover:text-white p-1 rounded-full hover:bg-amber-700/50"
                >
                    <X size={14} />
                </button>
                <div className="flex items-center gap-2 font-bold animate-pulse">
                    <ArrowUpCircle size={16} />
                    <span>CÓ BẢN CẬP NHẬT MỚI</span>
                </div>
                <div className="flex justify-between items-center opacity-90">
                    <span>Server: v{latestVersion}</span>
                </div>
                
                {isElectron ? (
                    <div className="bg-black/20 p-2 rounded text-[10px] border border-white/10 mt-1">
                        {updateUrl ? (
                            <>
                                <button onClick={handleDownloadUpdate} className="bg-emerald-600 hover:bg-emerald-500 w-full py-1.5 rounded flex items-center justify-center gap-1 font-bold text-white mb-1 transition-colors">
                                    <Download size={12} /> Tải bản cập nhật
                                </button>
                                <p className="text-center italic opacity-80">Tải và chạy file cài đặt.</p>
                            </>
                        ) : (
                            <>
                                <p className="flex gap-1 mb-1"><Info size={12} className="shrink-0 mt-0.5" /> <span>Vui lòng chạy file cập nhật thủ công.</span></p>
                            </>
                        )}
                    </div>
                ) : (
                    <button onClick={() => window.location.reload()} className="bg-white/20 hover:bg-white/30 px-2 py-1.5 rounded text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1 mt-1 w-full">
                        <RefreshCw size={10} /> Tải lại trang
                    </button>
                )}
            </div>
        )}

        {/* USER INFO */}
        <div className="px-4 py-4 border-b border-slate-800 bg-[#1e293b]/50 shrink-0">
          <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-blue-300 ring-2 ring-slate-600">
                  <UserCircle size={24} />
              </div>
              <div className="overflow-hidden flex-1">
                  <p className="text-sm font-bold truncate max-w-[120px] text-slate-200">{currentUser.name}</p>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1 uppercase font-semibold tracking-wider">
                      {currentUser.role === UserRole.ADMIN ? 'Administrator' : currentUser.role === UserRole.SUBADMIN ? 'Phó quản trị' : currentUser.role === UserRole.TEAM_LEADER ? 'Nhóm trưởng' : currentUser.role === UserRole.ONEDOOR ? 'Một cửa' : 'Nhân viên'}
                  </p>
              </div>
          </div>
        </div>

        {/* MENU */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.filter(item => {
             if (isOneDoor && !oneDoorAllowedViews.includes(item.id)) return false;
             if (isTeamLeader && !teamLeaderAllowedViews.includes(item.id)) return false;
             return item.visible;
          }).map((item) => (
            <button
              key={item.id}
              onClick={() => handleMenuClick(item.id)}
              className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all duration-200 group relative ${
                currentView === item.id
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20 font-semibold'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white font-medium'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon size={18} className={currentView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-white transition-colors'} />
                <span className="text-sm">{item.label}</span>
              </div>
              
              <div className="flex items-center gap-2">
                  {item.id === 'reports' && isGeneratingReport && (
                    <Loader2 size={14} className="animate-spin text-amber-400" />
                  )}
                  {/* NOTIFICATION BADGE */}
                  {item.badge !== undefined && item.badge > 0 && (
                      <span className={`min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm animate-pulse ${item.badgeColor || 'bg-red-500'}`}>
                          {item.badge > 99 ? '99+' : item.badge}
                      </span>
                  )}
              </div>
            </button>
          ))}
          
          {!isTeamLeader && !isEmployee && (isAdmin || isSubadmin) && (
            <div className="pt-4 mt-4 border-t border-slate-800 space-y-1">
              <div className="px-4 text-[10px] font-bold text-slate-600 uppercase mb-2 tracking-widest">Quản trị hệ thống</div>
              
              {isAdmin && (
                  <button onClick={() => handleMenuClick('user_management')} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group ${currentView === 'user_management' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} `}>
                    <Users size={18} className={currentView === 'user_management' ? 'text-white' : 'text-slate-500 group-hover:text-white'} />
                    <span className="font-medium text-sm">Tài khoản</span>
                  </button>
              )}

              <button 
                onClick={() => { 
                    onOpenSettings(); 
                    if(window.innerWidth < 768) setMobileOpen(false); 
                }} 
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors duration-200 group"
              >
                <Settings size={18} className="text-slate-500 group-hover:text-white" />
                <span className="font-medium text-sm">Nhân sự</span>
              </button>

              {isAdmin && (
                <button 
                    onClick={() => { 
                        onOpenSystemSettings(); 
                        if(window.innerWidth < 768) setMobileOpen(false); 
                    }} 
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors duration-200 group"
                >
                  <ShieldAlert size={18} className="text-slate-500 group-hover:text-red-400" />
                  <span className="font-medium text-sm group-hover:text-red-400">Cấu hình</span>
                </button>
              )}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-[#0f172a] shrink-0">
          <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-white hover:bg-red-600/80 px-4 py-2.5 rounded-lg transition-all text-sm font-bold shadow-sm">
              <LogOut size={16} /> Đăng xuất
          </button>
          
          <div className="mt-3 text-[10px] text-slate-600 text-center flex flex-col items-center gap-1 font-mono">
              <span>v{APP_VERSION}</span>
              {!isUpdateAvailable && <span className="text-emerald-500 flex items-center gap-1 font-bold">● Latest</span>}
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
