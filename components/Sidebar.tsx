
import React from 'react';
import { LayoutDashboard, FileText, ClipboardList, Send, BarChart3, Settings, LogOut, UserCircle, Users, Briefcase, BookOpen, UserPlus, ShieldAlert } from 'lucide-react';
import { User, UserRole } from '../types';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  onOpenSettings: () => void;
  onOpenSystemSettings: () => void; // Thêm prop mở cài đặt hệ thống
  currentUser: User;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, onOpenSettings, onOpenSystemSettings, currentUser, onLogout }) => {
  // Xác định quyền
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
      id: 'personal_profile', 
      label: 'Hồ sơ cá nhân', 
      icon: Briefcase, 
      visible: true 
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
      visible: hasManagerRights // Chỉ Admin/Subadmin thấy - Tab mới
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
      visible: hasManagerRights // Chỉ Admin/Subadmin thấy
    },
    { 
      id: 'handover_list', 
      label: 'DS Giao 1 cửa', 
      icon: Send, 
      visible: hasManagerRights // Chỉ Admin/Subadmin thấy
    },
    { 
      id: 'reports', 
      label: 'Báo cáo & Thống kê', 
      icon: BarChart3, 
      visible: true 
    },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white min-h-screen flex flex-col shadow-xl">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="text-blue-400">QL</span> Hồ Sơ
        </h1>
        <p className="text-xs text-slate-400 mt-1">Hệ thống hành chính công</p>
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
            onClick={() => setCurrentView(item.id)}
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
             
             {/* Chỉ Admin mới được quản lý User */}
             {isAdmin && (
                <button
                  onClick={() => setCurrentView('user_management')}
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

             {/* Cả Admin và Subadmin đều được vào cài đặt nhân sự */}
             <button
              onClick={onOpenSettings}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors duration-200"
            >
              <Settings size={20} />
              <span className="font-medium text-sm">Cài đặt nhân sự</span>
            </button>

            {/* Chỉ Admin mới được vào Cấu hình hệ thống (Xóa data) */}
            {isAdmin && (
               <button
                onClick={onOpenSystemSettings}
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
            Phiên bản 1.5.0 (Desktop Ready)
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
