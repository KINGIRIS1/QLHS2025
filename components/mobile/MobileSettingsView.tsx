
import React, { useState } from 'react';
import { User, Employee, UserRole, Holiday } from '../../types';
import AccountSettingsView from '../AccountSettingsView';
import UserManagement from '../UserManagement';
import EmployeeManagement from '../EmployeeManagement';
import SystemSettingsView from '../SystemSettingsView';
import { 
  User as UserIcon, 
  Shield, 
  Users, 
  Settings2, 
  ChevronRight, 
  LogOut,
  ArrowLeft
} from 'lucide-react';

interface MobileSettingsViewProps {
  currentUser: User;
  employees: Employee[];
  users: User[];
  wards: string[];
  onUpdateAccount: (data: any) => Promise<boolean>;
  onAddUser: (user: Omit<User, 'id'>) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (username: string) => void;
  onSaveEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  onDeleteAllData: () => Promise<boolean>;
  onHolidaysChanged: () => void;
  notificationEnabled: boolean;
  setNotificationEnabled: (enabled: boolean) => void;
  onLogout: () => void;
}

const MobileSettingsView: React.FC<MobileSettingsViewProps> = (props) => {
  const { currentUser, employees, users, wards, onLogout } = props;
  const [activeSubView, setActiveSubView] = useState<string | null>(null);
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isSubAdmin = currentUser.role === UserRole.SUBADMIN;

  const menuItems = [
    { id: 'account', label: 'Tài khoản của tôi', icon: UserIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
    ...(isAdmin || isSubAdmin ? [
      { id: 'employees', label: 'Quản lý nhân sự', icon: Users, color: 'text-teal-600', bg: 'bg-teal-50' }
    ] : []),
    ...(isAdmin ? [
      { id: 'users', label: 'Quản lý người dùng', icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50' },
      { id: 'system', label: 'Cấu hình hệ thống', icon: Settings2, color: 'text-orange-600', bg: 'bg-orange-50' }
    ] : []),
  ];

  const renderSubView = () => {
    switch (activeSubView) {
      case 'account':
        return (
          <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b flex items-center gap-3 bg-white sticky top-0 z-10">
              <button onClick={() => setActiveSubView(null)} className="p-1 hover:bg-gray-100 rounded-full">
                <ArrowLeft size={20} />
              </button>
              <h3 className="font-bold text-lg">Tài khoản của tôi</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <AccountSettingsView 
                currentUser={currentUser}
                linkedEmployee={employees.find(e => e.id === currentUser.employeeId)}
                onUpdate={props.onUpdateAccount}
                notificationEnabled={props.notificationEnabled}
                setNotificationEnabled={props.setNotificationEnabled}
              />
            </div>
          </div>
        );
      case 'employees':
        return (
          <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b flex items-center gap-3 bg-white sticky top-0 z-10">
              <button onClick={() => setActiveSubView(null)} className="p-1 hover:bg-gray-100 rounded-full">
                <ArrowLeft size={20} />
              </button>
              <h3 className="font-bold text-lg">Quản lý nhân sự</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <EmployeeManagement 
                employees={employees}
                onSaveEmployee={props.onSaveEmployee}
                onDeleteEmployee={props.onDeleteEmployee}
                wards={wards}
                currentUser={currentUser}
              />
            </div>
          </div>
        );
      case 'users':
        return (
          <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b flex items-center gap-3 bg-white sticky top-0 z-10">
              <button onClick={() => setActiveSubView(null)} className="p-1 hover:bg-gray-100 rounded-full">
                <ArrowLeft size={20} />
              </button>
              <h3 className="font-bold text-lg">Quản lý người dùng</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <UserManagement 
                users={users}
                employees={employees}
                onAddUser={props.onAddUser}
                onUpdateUser={props.onUpdateUser}
                onDeleteUser={props.onDeleteUser}
              />
            </div>
          </div>
        );
      case 'system':
        return (
          <div className="flex flex-col h-full bg-white">
            <div className="p-4 border-b flex items-center gap-3 bg-white sticky top-0 z-10">
              <button onClick={() => setActiveSubView(null)} className="p-1 hover:bg-gray-100 rounded-full">
                <ArrowLeft size={20} />
              </button>
              <h3 className="font-bold text-lg">Cấu hình hệ thống</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <SystemSettingsView 
                onDeleteAllData={props.onDeleteAllData}
                onHolidaysChanged={props.onHolidaysChanged}
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (activeSubView) {
    return (
      <div className="fixed inset-0 bg-white z-[60] animate-slide-in-right">
        {renderSubView()}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 bg-slate-50 min-h-full pb-24">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-4">
        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold border-4 border-blue-50">
          {currentUser.name.charAt(0)}
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">{currentUser.name}</h2>
          <p className="text-slate-500 text-sm">@{currentUser.username}</p>
          <div className="mt-1 inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase tracking-wider">
            {currentUser.role}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-50">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cài đặt ứng dụng</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSubView(item.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 active:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 ${item.bg} ${item.color} rounded-xl flex items-center justify-center`}>
                    <Icon size={20} />
                  </div>
                  <span className="font-semibold text-slate-700">{item.label}</span>
                </div>
                <ChevronRight size={18} className="text-slate-300" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-4 p-4 text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
        >
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
            <LogOut size={20} />
          </div>
          <span className="font-bold">Đăng xuất</span>
        </button>
      </div>

      <div className="text-center">
        <p className="text-slate-400 text-xs">Phiên bản 2.0.0 (Mobile)</p>
      </div>
    </div>
  );
};

export default MobileSettingsView;
