
import React from 'react';
import { LayoutDashboard, FileText, ClipboardList, Send, BarChart3, Settings, LogOut, UserCircle, Users, Briefcase, BookOpen, UserPlus, ShieldAlert, X, FolderInput, FileSignature, MessageSquare } from 'lucide-react';
import { User, UserRole } from '../types';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  onOpenSettings: () => void;
  onOpenSystemSettings: () => void;
  currentUser: User;
  onLogout: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  setCurrentView, 
  onOpenSettings, 
  onOpenSystemSettings, 
  currentUser, 
  onLogout,
  mobileOpen,
  setMobileOpen
}) => {
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isSubadmin = currentUser.role === UserRole.SUBADMIN;
  const hasManagerRights = isAdmin || isSubadmin;

  const menuItems = [
    { 
      id: 'dashboard', 
      label: 'Tổng quan', 
      icon: LayoutDashboard, 
      visible: true 
    },
    { 
      id: 'internal_chat', 
      label: 'Chat nội bộ', 
      icon: MessageSquare, 
      visible: true // Hiển thị cho mọi người
    },
    { 
      id: 'personal_profile', 
      label: 'Hồ sơ cá nhân', 
      icon: Briefcase, 
      visible: true 
    }, 
    { 
      id: 'receive_record', 
      label: 'Tiếp nhận hồ sơ', 
      icon: FolderInput, 
      visible: true // Hiển thị cho mọi người
    },
    { 
      id: 'receive_contract', 
      label: 'Tiếp nhận hợp đồng', 
      icon: FileSignature, 
      visible: true // Hiển thị cho mọi người
    },
    { 
      id: 'all_records', 
      label: 'Tất cả hồ sơ', 
      icon: FileText, 
      visible: true 
    },
    { 
      id: 'assign_tasks', 
      label: 'Giao hồ sơ', 
      icon: UserPlus, 
      visible: hasManagerRights
    },
    { 
      id: 'excerpt_management', 
      label: 'Số trích lục', 
      icon: BookOpen, 
      visible: true 
    },
    { 
      id: 'check_list', 
      label: 'DS Ký kiểm tra', 
      icon: ClipboardList, 
      visible: hasManagerRights
    },
    { 
      id: 'handover_list', 
      label: 'DS Giao 1 cửa', 
      icon: Send, 
      visible: hasManagerRights
    },
    { 
      id: 'reports', 
      label: 'Báo cáo & Thống kê', 
      icon: BarChart3, 
      visible: true 
    },
  ];

  const handleMenuClick = (viewId: string) => {
    setCurrentView(viewId);
    setMobileOpen(false);
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
        fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white min-h-screen flex flex-col shadow-xl transition-transform duration-300 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span className="text-blue-400">QL</span> Hồ Sơ
            </h1>
            <p className="text-xs text-slate-400 mt-1">Hệ thống hành chính công</p>
          </div>
          <button 
            onClick={() => setMobileOpen(false)}
            className="md:hidden text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <div className="px-4 py-4 border-b border-slate-800 bg-slate-800/50">
          <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-blue-300">
                  <UserCircle size={24} />
              </div>
              <div className="overflow-hidden">
                  <p className="text-sm font-semibold truncate">{currentUser.name}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                      {currentUser.role === UserRole.ADMIN ? 'Administrator' : 
                      currentUser.role === UserRole.SUBADMIN ? 'Phó quản trị' : 'Nhân viên'}
                  </p>
              </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.filter(item => item.visible).map((item) => (
            <button
              key={item.id}
              onClick={() => handleMenuClick(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                currentView === item.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          ))}
          
          {hasManagerRights && (
            <div className="pt-4 mt-4 border-t border-slate-700 space-y-2">
              <div className="px-4 text-xs font-semibold text-slate-500 uppercase mb-2">Quản trị</div>
              
              {isAdmin && (
                  <button
                    onClick={() => handleMenuClick('user_management')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                      currentView === 'user_management'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <Users size={20} />
                    <span className="font-medium text-sm">Quản lý tài khoản</span>
                  </button>
              )}

              <button
                onClick={() => { onOpenSettings(); setMobileOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors duration-200"
              >
                <Settings size={20} />
                <span className="font-medium text-sm">Cài đặt nhân sự</span>
              </button>

              {isAdmin && (
                <button
                  onClick={() => { onOpenSystemSettings(); setMobileOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-300 hover:bg-slate-800 hover:text-red-200 transition-colors duration-200"
                >
                  <ShieldAlert size={20} />
                  <span className="font-medium text-sm">Cấu hình hệ thống</span>
                </button>
              )}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button 
              onClick={onLogout}
              className="w-full flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
          >
              <LogOut size={18} />
              Đăng xuất
          </button>
          <div className="mt-2 text-[10px] text-slate-500 text-center">
              Phiên bản 1.6.0
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
