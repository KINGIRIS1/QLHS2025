
import React from 'react';
import TopNavigation from '../TopNavigation';
import { Menu, WifiOff, ShieldCheck, UserCircle, LogOut } from 'lucide-react';
import { User, UserRole } from '../../types';
import UpdateRequiredModal from '../UpdateRequiredModal';

interface MainLayoutProps {
    children: React.ReactNode;
    currentUser: User | null;
    currentView: string;
    setCurrentView: (view: string) => void;
    onLogout: () => void;
    
    // Sidebar specific props
    isMobileMenuOpen: boolean;
    setIsMobileMenuOpen: (open: boolean) => void;
    isGeneratingReport: boolean;
    isUpdateAvailable: boolean;
    latestVersion: string;
    updateUrl: string | null;
    unreadMessages: number;
    warningCount: { overdue: number; approaching: number };
    activeRemindersCount: number;
    
    // Connection status
    connectionStatus: 'connected' | 'offline';

    // Update Modal Props
    showUpdateModal?: boolean;
    updateVersion?: string;
    updateDownloadStatus?: 'idle' | 'downloading' | 'ready' | 'error';
    updateProgress?: number;
    updateSpeed?: number; // Prop mới
    onUpdateNow?: () => void;
    onUpdateLater?: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    currentUser,
    currentView,
    setCurrentView,
    onLogout,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isGeneratingReport,
    isUpdateAvailable,
    latestVersion,
    updateUrl,
    unreadMessages,
    warningCount,
    activeRemindersCount,
    connectionStatus,
    // Update props defaults
    showUpdateModal = false,
    updateVersion = '',
    updateDownloadStatus = 'idle',
    updateProgress = 0,
    updateSpeed = 0, // Default
    onUpdateNow = () => {},
    onUpdateLater = () => {}
}) => {
    if (!currentUser) return <>{children}</>;

    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
            {/* Modal Cập nhật Bắt buộc */}
            <UpdateRequiredModal 
                visible={showUpdateModal}
                version={updateVersion}
                downloadStatus={updateDownloadStatus}
                progress={updateProgress}
                downloadSpeed={updateSpeed}
                onUpdateNow={onUpdateNow}
                onUpdateLater={onUpdateLater}
            />

            {/* HEADER */}
            <header className="h-14 bg-[#1e3a8a] text-white flex items-center justify-between px-4 shadow-md z-50 shrink-0 border-b border-blue-800">
                {/* LEFT: BRAND */}
                <div className="flex items-center gap-3">
                    <div className="bg-white/10 p-1.5 rounded-lg">
                        <ShieldCheck size={24} className="text-white" />
                    </div>
                    <div className="flex flex-col leading-tight">
                        <h1 className="font-bold text-sm uppercase tracking-wide">Hệ thống tiếp nhận và</h1>
                        <span className="font-bold text-sm uppercase tracking-wide">quản lý hồ sơ</span>
                        <span className="text-[10px] text-blue-200 font-normal">Chi nhánh Chơn Thành</span>
                    </div>
                </div>

                {/* RIGHT: USER INFO */}
                <div className="flex items-center gap-4">
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
            </header>

            {/* MAIN BODY */}
            <div className="flex flex-1 overflow-hidden">
                {/* SIDEBAR */}
                <TopNavigation
                    currentView={currentView}
                    setCurrentView={setCurrentView}
                    currentUser={currentUser}
                    onLogout={onLogout}
                    mobileOpen={isMobileMenuOpen}
                    setMobileOpen={setIsMobileMenuOpen}
                    isGeneratingReport={isGeneratingReport}
                    onOpenAccountSettings={() => setCurrentView('account_settings')}
                    unreadMessagesCount={unreadMessages}
                    warningRecordsCount={warningCount.overdue + warningCount.approaching}
                    reminderCount={activeRemindersCount}
                />

                {/* CONTENT */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f0f2f5]">
                    {connectionStatus === 'offline' && (
                        <div className="bg-red-600 text-white text-xs py-1 px-4 text-center font-bold flex items-center justify-center gap-2 shadow-sm z-30">
                            <WifiOff size={14} /> MẤT KẾT NỐI SERVER - ĐANG CHẠY CHẾ ĐỘ OFFLINE (Chỉ xem)
                        </div>
                    )}

                    <main className="flex-1 p-4 overflow-hidden relative">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
};

export default MainLayout;
