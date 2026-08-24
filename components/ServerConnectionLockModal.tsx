import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff, ServerOff, RefreshCw, CheckCircle2, ShieldAlert, AlertTriangle } from 'lucide-react';
import { checkServerHealth, ServerHealthResult } from '../services/apiSystem';

interface ServerConnectionLockModalProps {
    isOpen: boolean;
    onReconnectSuccess: () => void;
    initialError?: string;
}

export const ServerConnectionLockModal: React.FC<ServerConnectionLockModalProps> = ({
    isOpen,
    onReconnectSuccess,
    initialError
}) => {
    const [countdown, setCountdown] = useState(5);
    const [isRetrying, setIsRetrying] = useState(false);
    const [lastCheckResult, setLastCheckResult] = useState<ServerHealthResult | null>(null);
    const [reconnected, setReconnected] = useState(false);
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleRetry = useCallback(async () => {
        if (isRetrying || reconnected) return;
        setIsRetrying(true);
        try {
            const result = await checkServerHealth(4000);
            setLastCheckResult(result);
            if (result.isOnline) {
                setReconnected(true);
                setTimeout(() => {
                    onReconnectSuccess();
                    setReconnected(false);
                }, 1000);
                return;
            }
        } catch (err) {
            setLastCheckResult({
                isOnline: false,
                errorType: 'NETWORK_ERROR',
                message: 'Không thể liên lạc với máy chủ.'
            });
        } finally {
            setIsRetrying(false);
            setCountdown(5); // Reset đếm ngược sau khi thử
        }
    }, [isRetrying, reconnected, onReconnectSuccess]);

    // Timer đếm ngược tự động thử lại
    useEffect(() => {
        if (!isOpen || reconnected) return;

        const interval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    handleRetry();
                    return 5;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isOpen, reconnected, handleRetry]);

    // Thử kiểm tra ngay khi mở modal
    useEffect(() => {
        if (isOpen) {
            setCountdown(5);
            setReconnected(false);
            handleRetry();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div 
            id="server-connection-lock-modal"
            className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in"
            style={{ pointerEvents: 'auto' }}
        >
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 transition-all transform scale-100">
                {/* Header dải màu cảnh báo */}
                <div className={`h-2.5 w-full transition-colors duration-500 ${
                    reconnected ? 'bg-emerald-500' : 'bg-gradient-to-r from-red-500 via-amber-500 to-red-500 animate-pulse'
                }`} />

                <div className="p-8 text-center flex flex-col items-center">
                    {/* Icon Status */}
                    <div className="relative mb-6">
                        {reconnected ? (
                            <div className="w-20 h-20 rounded-2xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center text-emerald-600 animate-bounce">
                                <CheckCircle2 size={44} strokeWidth={2.5} />
                            </div>
                        ) : (
                            <div className="relative">
                                <div className="absolute inset-0 rounded-2xl bg-red-400/20 animate-ping" />
                                <div className="relative w-20 h-20 rounded-2xl bg-red-50 border-2 border-red-200 flex items-center justify-center text-red-600 shadow-inner">
                                    <ServerOff size={40} strokeWidth={2} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Tiêu đề & Nội dung */}
                    {reconnected ? (
                        <>
                            <h3 className="text-2xl font-black text-emerald-700 tracking-tight mb-2">
                                KẾT NỐI MÁY CHỦ THÀNH CÔNG!
                            </h3>
                            <p className="text-slate-600 text-sm leading-relaxed mb-6 font-medium">
                                Hệ thống đang tải lại dữ liệu mới nhất từ máy chủ và sẽ mở khóa ngay trong giây lát...
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-black uppercase tracking-wider mb-3">
                                <ShieldAlert size={14} /> Khóa thao tác an toàn
                            </div>
                            
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                                MẤT KẾT NỐI MÁY CHỦ DỮ LIỆU
                            </h3>
                            
                            <p className="text-slate-600 text-sm leading-relaxed mb-4">
                                Hệ thống phát hiện kết nối đến máy chủ <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">api.qlhsct.info.vn</span> bị gián đoạn hoặc máy chủ đang tắt.
                            </p>

                            <div className="w-full bg-amber-50/80 border border-amber-200 rounded-2xl p-4 text-left mb-6 text-xs text-amber-900 space-y-1.5">
                                <div className="flex items-center gap-2 font-bold text-amber-800">
                                    <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                                    <span>Chi tiết trạng thái:</span>
                                </div>
                                <p className="pl-6 text-slate-700">
                                    {lastCheckResult?.message || initialError || 'Máy chủ dữ liệu (Docker) có thể chưa được Quản trị viên khởi động hoặc mạng bị ngắt quãng.'}
                                </p>
                                <p className="pl-6 text-[11px] text-amber-700 italic">
                                    👉 Mọi thao tác tạm thời bị tạm dừng để bảo vệ an toàn toàn bộ dữ liệu hồ sơ.
                                </p>
                            </div>
                        </>
                    )}

                    {/* Progress / Auto retry timer */}
                    {!reconnected && (
                        <div className="w-full mb-6">
                            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-2">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                                    Tự động kiểm tra lại sau:
                                </span>
                                <span className="font-mono text-slate-800 font-bold bg-slate-100 px-2 py-0.5 rounded">
                                    {countdown} giây
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-blue-600 transition-all duration-1000 ease-linear rounded-full"
                                    style={{ width: `${(countdown / 5) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Nút hành động */}
                    {!reconnected && (
                        <div className="w-full flex flex-col sm:flex-row gap-3">
                            <button
                                type="button"
                                onClick={handleRetry}
                                disabled={isRetrying}
                                className="flex-1 py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <RefreshCw size={18} className={isRetrying ? 'animate-spin' : ''} />
                                {isRetrying ? 'Đang kiểm tra máy chủ...' : 'Thử kết nối lại ngay'}
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer hướng dẫn kỹ thuật */}
                <div className="bg-slate-50 px-8 py-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Hệ thống Quản lý Hồ sơ Chi nhánh</span>
                    <span className="font-mono">Server Port: 443 (Tunnel)</span>
                </div>
            </div>
        </div>
    );
};

export default ServerConnectionLockModal;
