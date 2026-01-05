
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, FileText, ClipboardList, Send, BarChart3, Settings, LogOut, UserCircle, Users, Briefcase, BookOpen, UserPlus, ShieldAlert, X, FolderInput, FileSignature, MessageSquare, Loader2, UserCog, ArrowUpCircle, RefreshCw, CheckCircle, Info, Download, ShieldCheck, Bell, Power, ExternalLink, DownloadCloud, PenTool, PlayCircle } from 'lucide-react';
import { User, UserRole } from '../types';
import { APP_VERSION } from '../constants';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  onOpenSettings: () => void; // Deprecated but kept for backward compatibility if needed
  onOpenSystemSettings: () => void;
  currentUser: User;
  onLogout: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isGeneratingReport?: boolean;
  
  // Update Props
  isUpdateAvailable?: boolean;
  latestVersion?: string;
  updateUrl?: string | null; 
  onOpenAccountSettings: () => void;
  unreadMessagesCount: number;
  warningRecordsCount: number;
  reminderCount: number;
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
  updateUrl,
  onOpenAccountSettings,
  unreadMessagesCount,
  warningRecordsCount,
  reminderCount
}) => {
  const [isBannerVisible, setIsBannerVisible] = useState(true);
  
  // State quản lý tiến trình tải cập nhật
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'checking' | 'downloading' | 'ready' | 'error'>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Tự động hiện banner khi có update
  useEffect(() => {
      if (isUpdateAvailable) setIsBannerVisible(true);
  }, [isUpdateAvailable]);

  // Hàm chuẩn hóa thông báo lỗi để thân thiện với người dùng
  const getFriendlyErrorMessage = (msg: string) => {
      if (!msg) return 'Lỗi không xác định';
      
      // Lỗi 404 từ GitHub
      if (msg.includes('404') && msg.includes('github')) {
          return 'File cài đặt không tồn tại trên GitHub. Admin vui lòng kiểm tra lại Release.';
      }

      // Lỗi 404 chung chung hoặc link khác
      if (msg.includes('404') || msg.includes('latest.yml') || msg.includes('Cannot find channel')) {
          return 'Không tìm thấy thông tin cập nhật. Vui lòng thử lại sau.';
      }

      if (msg.includes('NetworkError') || msg.includes('net::ERR')) {
          return 'Lỗi kết nối mạng. Vui lòng kiểm tra internet.';
      }
      return msg; // Trả về lỗi gốc nếu không khớp case nào
  };

  // Lắng nghe sự kiện update từ Electron
  useEffect(() => {
      if (window.electronAPI && window.electronAPI.onUpdateStatus) {
          window.electronAPI.onUpdateStatus((data: any) => {
              if (data.status === 'downloading') {
                  setDownloadStatus('downloading');
                  setDownloadProgress(Math.round(data.progress));
                  const speed = (data.bytesPerSecond / 1024 / 1024).toFixed(2);
                  setDownloadSpeed(`${speed} MB/s`);
              } else if (data.status === 'downloaded') {
                  setDownloadStatus('ready');
                  setDownloadProgress(100);
              } else if (data.status === 'error') {
                  setDownloadStatus('error');
                  setErrorMessage(getFriendlyErrorMessage(data.message));
                  console.error("Update error from main:", data.message);
              }
          });

          // Cleanup listener
          return () => {
              if (window.electronAPI?.removeUpdateListener) {
                  window.electronAPI.removeUpdateListener();
              }
          };
      }
  }, []);

  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isSubadmin = currentUser.role === UserRole.SUBADMIN;
  const isTeamLeader = currentUser.role === UserRole.TEAM_LEADER;
  const isOneDoor = currentUser.role === UserRole.ONEDOOR;
  const isEmployee = currentUser.role === UserRole.EMPLOYEE;
  
  const hasManagerRights = isAdmin || isSubadmin || isTeamLeader;

  const oneDoorAllowedViews = ['dashboard', 'internal_chat', 'receive_record', 'receive_contract', 'all_records', 'personal_profile', 'account_settings', 'utilities'];
  const teamLeaderAllowedViews = ['dashboard', 'personal_profile', 'assign_tasks', 'all_records', 'excerpt_management', 'reports', 'account_settings', 'internal_chat', 'utilities'];

  const menuItems = [
    { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, visible: true, badge: reminderCount, badgeColor: 'bg-pink-500' },
    { id: 'internal_chat', label: 'Chat nội bộ', icon: MessageSquare, visible: true, badge: unreadMessagesCount, badgeColor: 'bg-blue-500' },
    { id: 'personal_profile', label: 'Hồ sơ cá nhân', icon: Briefcase, visible: true }, 
    { id: 'receive_record', label: 'Tiếp nhận hồ sơ', icon: FolderInput, visible: !isTeamLeader && !isEmployee },
    { id: 'receive_contract', label: 'Tiếp nhận hợp đồng', icon: FileSignature, visible: !isTeamLeader && !isEmployee },
    { id: 'all_records', label: 'Tất cả hồ sơ', icon: FileText, visible: true, badge: !isOneDoor ? warningRecordsCount : 0, badgeColor: 'bg-red-600' },
    { id: 'assign_tasks', label: 'Giao hồ sơ', icon: UserPlus, visible: hasManagerRights },
    { id: 'excerpt_management', label: 'Số trích lục', icon: BookOpen, visible: !isOneDoor },
    { id: 'utilities', label: 'Tiện ích', icon: PenTool, visible: true },
    { id: 'check_list', label: 'DS Ký kiểm tra', icon: ClipboardList, visible: isAdmin || isSubadmin },
    { id: 'handover_list', label: 'DS Giao 1 cửa', icon: Send, visible: isAdmin || isSubadmin },
    { id: 'reports', label: 'Báo cáo & Thống kê', icon: BarChart3, visible: !isOneDoor },
    { id: 'account_settings', label: 'Cài đặt tài khoản', icon: UserCog, visible: true },
  ];

  const handleMenuClick = (viewId: string) => {
    setCurrentView(viewId);
    if (window.innerWidth < 768) {
        setMobileOpen(false);
    }
  };

  const handleDownloadInApp = async () => {
      if (window.electronAPI && window.electronAPI.downloadUpdate && window.electronAPI.checkForUpdate) {
          try {
              setDownloadStatus('checking');
              setErrorMessage('');
              
              // Gọi checkForUpdate trước để Electron khởi tạo luồng cập nhật.
              const checkResult = await window.electronAPI.checkForUpdate(updateUrl || '');
              
              if (checkResult?.status === 'dev-mode') {
                  setDownloadStatus('error');
                  setErrorMessage('Chế độ Dev không hỗ trợ auto-update');
                  return;
              }

              if (checkResult?.status === 'error') {
                  setDownloadStatus('error');
                  setErrorMessage(getFriendlyErrorMessage(checkResult.message));
                  return;
              }

              if (checkResult && checkResult.status === 'available') {
                  setDownloadStatus('downloading');
                  await window.electronAPI.downloadUpdate();
              } else {
                  console.warn("AutoUpdate check failed or not available:", checkResult);
                  setDownloadStatus('error');
                  if (checkResult?.status === 'not-available') {
                      setErrorMessage('Không tìm thấy file cấu hình cập nhật.');
                  } else {
                      setErrorMessage('Link tải không hỗ trợ tự động.');
                  }
              }
          } catch (e: any) {
              console.error("AutoUpdate flow error:", e);
              setDownloadStatus('error');
              setErrorMessage(getFriendlyErrorMessage(e.message));
          }
      } else {
          // Fallback nếu không phải môi trường Electron
          handleDownloadExternal();
      }
  };

  const handleQuitAndInstall = async () => {
      if (window.electronAPI && window.electronAPI.quitAndInstall) {
          await window.electronAPI.quitAndInstall();
      }
  };

  const handleDownloadExternal = () => {
      if (updateUrl) {
          if (window.electronAPI && window.electronAPI.openExternal) {
              window.electronAPI.openExternal(updateUrl);
          } else {
              window.open(updateUrl, '_blank');
          }
      } else {
          alert("Không tìm thấy link tải về. Vui lòng liên hệ Admin.");
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

        {/* UPDATE NOTIFICATION BANNER (AUTO UPDATER) */}
        {isUpdateAvailable && isBannerVisible && (
            <div className="bg-gradient-to-b from-amber-600/90 to-amber-700/90 backdrop-blur-sm text-white text-xs px-4 py-3 border-b border-amber-800 flex flex-col gap-2 shadow-inner relative animate-fade-in shrink-0">
                <button 
                    onClick={() => setIsBannerVisible(false)}
                    className="absolute top-1 right-1 text-amber-200 hover:text-white p-1 rounded-full hover:bg-amber-700/50"
                >
                    <X size={14} />
                </button>
                
                <div className="flex items-center gap-2 font-bold animate-pulse text-amber-100">
                    <DownloadCloud size={16} />
                    <span>CÓ BẢN CẬP NHẬT MỚI</span>
                </div>
                
                <div className="flex justify-between items-center opacity-90 text-[10px] text-amber-200 font-mono">
                    <span>Mới: v{latestVersion}</span>
                    <span>Hiện tại: v{APP_VERSION}</span>
                </div>
                
                <div className="bg-black/20 p-2 rounded text-[10px] border border-white/10 mt-1">
                    {downloadStatus === 'idle' && (
                        <button 
                            onClick={handleDownloadInApp} 
                            className="bg-emerald-600 hover:bg-emerald-500 w-full py-1.5 rounded flex items-center justify-center gap-1 font-bold text-white mb-1 transition-colors shadow-sm"
                        >
                            <Download size={12} /> Tải & Cài đặt ngay
                        </button>
                    )}

                    {downloadStatus === 'checking' && (
                        <div className="text-center text-emerald-100 py-1 flex items-center justify-center gap-2">
                            <Loader2 size={12} className="animate-spin" />
                            Đang kiểm tra...
                        </div>
                    )}

                    {downloadStatus === 'downloading' && (
                        <div className="space-y-1">
                            <div className="flex justify-between items-center text-[9px] text-emerald-100">
                                <span>Đang tải xuống...</span>
                                <span>{downloadProgress}%</span>
                            </div>
                            <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden">
                                <div 
                                    className="bg-emerald-400 h-full transition-all duration-300" 
                                    style={{ width: `${downloadProgress}%` }}
                                ></div>
                            </div>
                            <div className="text-[9px] text-center text-emerald-200 italic">{downloadSpeed}</div>
                        </div>
                    )}

                    {downloadStatus === 'ready' && (
                        <button 
                            onClick={handleQuitAndInstall} 
                            className="bg-blue-600 hover:bg-blue-500 w-full py-2 rounded flex items-center justify-center gap-1 font-bold text-white mb-1 transition-colors shadow-sm animate-pulse"
                        >
                            <PlayCircle size={14} /> Khởi động lại để cập nhật
                        </button>
                    )}

                    {downloadStatus === 'error' && (
                        <>
                            <div className="text-red-200 bg-red-900/40 p-2 rounded mb-2 border border-red-500/30 flex flex-col items-center">
                                <span className="font-bold mb-1">Tải tự động thất bại!</span>
                                <span className="text-[9px] text-center opacity-90 leading-tight break-words max-w-full">{errorMessage}</span>
                            </div>
                            <button 
                                onClick={handleDownloadExternal} 
                                className="bg-gray-200 hover:bg-white text-gray-800 w-full py-1.5 rounded flex items-center justify-center gap-1 font-bold transition-colors shadow-sm"
                            >
                                <ExternalLink size={12} /> Tải thủ công (Mở Link)
                            </button>
                        </>
                    )}
                </div>
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
                onClick={() => handleMenuClick('employee_management')} 
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group ${currentView === 'employee_management' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'} `}
              >
                <Settings size={18} className={currentView === 'employee_management' ? 'text-white' : 'text-slate-500 group-hover:text-white'} />
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
