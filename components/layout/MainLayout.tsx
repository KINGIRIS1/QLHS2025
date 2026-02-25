
import React from 'react';
import Sidebar from '../Sidebar';
import { Menu, WifiOff } from 'lucide-react';
import { User } from '../../types';
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
        <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
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

            <Sidebar
                currentView={currentView}
                setCurrentView={setCurrentView}
                onOpenSettings={() => {}} // Deprecated
                currentUser={currentUser}
                onLogout={onLogout}
                mobileOpen={isMobileMenuOpen}
                setMobileOpen={setIsMobileMenuOpen}
                isGeneratingReport={isGeneratingReport}
                // Sidebar doesn't need to know about updates anymore as we use Modal
                onOpenAccountSettings={() => setCurrentView('account_settings')}
                unreadMessagesCount={unreadMessages}
                warningRecordsCount={warningCount.overdue + warningCount.approaching}
                reminderCount={activeRemindersCount}
            />

            <div className="flex-1 flex flex-col min-w-0">
                <header className="md:hidden bg-[#0f172a] text-white p-4 flex justify-between items-center shadow-md z-20">
                    <h1 className="font-bold text-sm truncate">QLHS Đo Đạc</h1>
                    <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <Menu size={24} />
                    </button>
                </header>

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
    );
};

export default MainLayout;
