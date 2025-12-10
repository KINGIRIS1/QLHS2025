
import React, { useState, useEffect, useRef } from 'react';
import { User, Employee } from '../types';
import { Save, Lock, User as UserIcon, Briefcase, CheckCircle, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

interface AccountSettingsViewProps {
  currentUser: User;
  linkedEmployee: Employee | undefined;
  onUpdate: (data: { name: string; password?: string; department?: string }) => Promise<boolean>;
}

const AccountSettingsView: React.FC<AccountSettingsViewProps> = ({ 
  currentUser, 
  linkedEmployee, 
  onUpdate 
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'security'>('info');
  const [isLoading, setIsLoading] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  
  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Notification State
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Ref để cuộn lên đầu trang
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load dữ liệu khi component được mount
    setName(currentUser.name);
    setDepartment(linkedEmployee?.department || '');
    // KHÔNG reset notification ở đây vì khi update thành công, currentUser thay đổi sẽ kích hoạt effect này
    // và làm mất thông báo thành công ngay lập tức.
  }, [currentUser, linkedEmployee]);

  // Cuộn lên đầu khi có thông báo mới (Không tự động tắt nữa)
  useEffect(() => {
    if (notification) {
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [notification]);

  const handleTabChange = (tab: 'info' | 'security') => {
      setActiveTab(tab);
      setNotification(null); // Xóa thông báo khi chuyển tab
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotification(null);
    setIsLoading(true);

    try {
        const updateData: { name: string; password?: string; department?: string } = {
            name: name.trim()
        };

        // Validate Info
        if (!updateData.name) throw new Error("Tên hiển thị không được để trống.");

        // Handle Department update if linked
        if (linkedEmployee) {
            updateData.department = department.trim();
        }

        // Handle Password Change
        if (activeTab === 'security') {
            if (!currentPassword) throw new Error("Vui lòng nhập mật khẩu hiện tại để xác thực.");
            
            // Check old password (Verify against currentUser prop locally first)
            if (currentPassword !== currentUser.password) {
                throw new Error("Mật khẩu hiện tại không chính xác.");
            }

            if (newPassword) {
                if (newPassword.length < 3) throw new Error("Mật khẩu mới quá ngắn (tối thiểu 3 ký tự).");
                if (newPassword !== confirmPassword) throw new Error("Xác nhận mật khẩu không khớp.");
                updateData.password = newPassword;
            } else {
                 throw new Error("Vui lòng nhập mật khẩu mới.");
            }
        }

        const result = await onUpdate(updateData);
        
        if (result) {
            const successMsg = activeTab === 'security' 
                ? "Đổi mật khẩu thành công! Vui lòng sử dụng mật khẩu mới cho lần đăng nhập sau." 
                : "Cập nhật thông tin cá nhân thành công!";
            
            setNotification({ type: 'success', message: successMsg });
            
            if (activeTab === 'security') {
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            }
        } else {
            throw new Error("Không thể kết nối đến máy chủ. Vui lòng thử lại.");
        }

    } catch (err: any) {
        setNotification({ type: 'error', message: err.message || "Đã xảy ra lỗi không xác định." });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6 animate-fade-in-up overflow-hidden">
        {/* Header Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between shrink-0">
            <div>
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <UserIcon className="text-blue-600" />
                    Cài đặt tài khoản
                </h2>
                <p className="text-gray-500 mt-1">Quản lý thông tin cá nhân và bảo mật tài khoản.</p>
            </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col md:flex-row min-h-0">
            {/* Sidebar Tabs */}
            <div className="w-full md:w-64 bg-gray-50 border-r border-gray-200 p-4 space-y-2 shrink-0">
                <button 
                    onClick={() => handleTabChange('info')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                        activeTab === 'info' 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    <UserIcon size={18} /> Thông tin chung
                </button>
                <button 
                    onClick={() => handleTabChange('security')}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                        activeTab === 'security' 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    <Lock size={18} /> Bảo mật & Mật khẩu
                </button>
            </div>

            {/* Form Area */}
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-2xl mx-auto">
                    {/* Anchor để cuộn lên */}
                    <div ref={topRef} />

                    {/* Notification Area - Hiển thị tĩnh */}
                    {notification && (
                        <div className={`mb-6 p-4 rounded-lg border flex items-start gap-3 shadow-sm animate-fade-in ${
                            notification.type === 'success' 
                            ? 'bg-green-50 border-green-200 text-green-800' 
                            : 'bg-red-50 border-red-200 text-red-800'
                        }`}>
                            {notification.type === 'success' ? (
                                <CheckCircle className="shrink-0 text-green-600" size={24} />
                            ) : (
                                <AlertCircle className="shrink-0 text-red-600" size={24} />
                            )}
                            <div>
                                <h4 className="font-bold text-lg">{notification.type === 'success' ? 'Thành công!' : 'Có lỗi xảy ra!'}</h4>
                                <p>{notification.message}</p>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {activeTab === 'info' && (
                            <div className="space-y-6 animate-fade-in">
                                <h3 className="text-xl font-bold text-gray-800 border-b pb-2">Thông tin cá nhân</h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Tên đăng nhập</label>
                                        <div className="flex items-center gap-2 px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed">
                                            <ShieldCheck size={18} />
                                            <span>{currentUser.username}</span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">* Tên đăng nhập không thể thay đổi.</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Vai trò hệ thống</label>
                                        <div className="px-4 py-3 bg-blue-50 border border-blue-100 text-blue-700 rounded-lg font-medium">
                                            {currentUser.role}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tên hiển thị <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            value={name}
                                            disabled={isLoading}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg px-4 py-3 pl-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-gray-50"
                                            placeholder="Nhập tên hiển thị của bạn..."
                                        />
                                        <UserIcon size={18} className="absolute left-3 top-3.5 text-gray-400" />
                                    </div>
                                </div>

                                {linkedEmployee ? (
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Phòng ban / Chức vụ</label>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                value={department}
                                                disabled={isLoading}
                                                onChange={(e) => setDepartment(e.target.value)}
                                                className="w-full border border-gray-300 rounded-lg px-4 py-3 pl-10 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-gray-50"
                                                placeholder="Nhập phòng ban..."
                                            />
                                            <Briefcase size={18} className="absolute left-3 top-3.5 text-gray-400" />
                                        </div>
                                        <p className="text-sm text-green-600 mt-2 flex items-center gap-1 font-medium bg-green-50 w-fit px-2 py-1 rounded">
                                            <CheckCircle size={14} /> Tài khoản đã liên kết với hồ sơ nhân sự.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 flex items-start gap-3">
                                        <AlertCircle className="text-orange-600 shrink-0" size={20} />
                                        <div>
                                            <p className="text-sm text-orange-800 font-bold">Chưa liên kết hồ sơ nhân viên</p>
                                            <p className="text-xs text-orange-700 mt-1">
                                                Vui lòng liên hệ Quản trị viên để liên kết tài khoản này với một hồ sơ nhân viên trong hệ thống.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="space-y-6 animate-fade-in">
                                <h3 className="text-xl font-bold text-gray-800 border-b pb-2">Đổi mật khẩu</h3>
                                <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 mb-4 border border-blue-100">
                                    <p>Để bảo mật, vui lòng nhập mật khẩu hiện tại trước khi thay đổi mật khẩu mới.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Mật khẩu hiện tại <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <input 
                                            type="password" 
                                            value={currentPassword}
                                            disabled={isLoading}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg px-4 py-3 pl-10 focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-gray-50"
                                            placeholder="••••••"
                                        />
                                        <Lock size={18} className="absolute left-3 top-3.5 text-gray-400" />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <div className="mb-4">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Mật khẩu mới</label>
                                        <div className="relative">
                                            <input 
                                                type="password" 
                                                value={newPassword}
                                                disabled={isLoading}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="w-full border border-gray-300 rounded-lg px-4 py-3 pl-10 focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-gray-50"
                                                placeholder="Mật khẩu mới (Tối thiểu 3 ký tự)"
                                            />
                                            <Lock size={18} className="absolute left-3 top-3.5 text-gray-400" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Xác nhận mật khẩu mới</label>
                                        <div className="relative">
                                            <input 
                                                type="password" 
                                                value={confirmPassword}
                                                disabled={isLoading}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                className="w-full border border-gray-300 rounded-lg px-4 py-3 pl-10 focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:bg-gray-50"
                                                placeholder="Nhập lại mật khẩu mới"
                                            />
                                            <CheckCircle size={18} className="absolute left-3 top-3.5 text-gray-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="pt-6 border-t border-gray-200">
                            <button 
                                type="submit"
                                disabled={isLoading}
                                className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl font-bold text-lg disabled:opacity-70 disabled:cursor-not-allowed ml-auto"
                            >
                                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                                {isLoading ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
  );
};

export default AccountSettingsView;
