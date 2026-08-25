import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { ShieldCheck, User as UserIcon, Lock, CheckCircle2, Eye, EyeOff, ServerOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { checkServerHealth, ServerHealthResult } from '../services/apiSystem';
import { fetchUsers } from '../services/apiPeople';
import { APP_VERSION } from '../constants';
import { VietnamCyberMap } from './VietnamCyberMap';

interface LoginProps {
  onLogin: (user: User) => void;
  users: User[]; 
}

const Login: React.FC<LoginProps> = ({ onLogin, users }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Timeline Animation Phase:
  // Phase 1 (0.0s - 1.0s): Quét sáng viền bản đồ Việt Nam & Hoàng Sa / Trường Sa
  // Phase 2 (1.0s - 2.2s): Tỏa sáng trọng tâm tỉnh Đồng Nai + Vòng tròn sóng radar
  // Phase 3 (2.2s+): Camera trượt mượt mà, khung Đăng nhập hiện lên êm ái
  const [animationPhase, setAnimationPhase] = useState<number>(1);

  // Server Offline Warning Modal state for Login
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [serverCheckResult, setServerCheckResult] = useState<ServerHealthResult | null>(null);
  const [isCheckingServer, setIsCheckingServer] = useState(false);
  const [currentUsersList, setCurrentUsersList] = useState<User[]>(users);

  useEffect(() => {
    // Luồng timeline animation đúng kịch bản
    const timerPhase2 = setTimeout(() => {
      setAnimationPhase(2);
    }, 1000);

    const timerPhase3 = setTimeout(() => {
      setAnimationPhase(3);
    }, 2200);

    return () => {
      clearTimeout(timerPhase2);
      clearTimeout(timerPhase3);
    };
  }, []);

  useEffect(() => {
    setCurrentUsersList(users);
  }, [users]);

  useEffect(() => {
    const savedUser = localStorage.getItem('saved_username');
    if (savedUser) {
      setUsername(savedUser);
      setRememberMe(true);
    }
  }, []);

  const handleCheckServer = async () => {
    setIsCheckingServer(true);
    try {
      const health = await checkServerHealth(4000);
      setServerCheckResult(health);
      if (health.isOnline) {
        const freshUsers = await fetchUsers();
        if (freshUsers && freshUsers.length > 0) {
          setCurrentUsersList(freshUsers);
        }
      }
    } catch (e) {
      setServerCheckResult({
        isOnline: false,
        errorType: 'NETWORK_ERROR',
        message: 'Không thể kết nối đến máy chủ api.qlhsct.info.vn'
      });
    } finally {
      setIsCheckingServer(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();

    // 1. Kiểm tra trong danh sách users hiện có
    let matchedUser = currentUsersList.find(u => 
      u.username.trim().toLowerCase() === cleanUsername && 
      String(u.password).trim() === cleanPassword
    );

    // Nếu chưa tìm thấy hoặc users rỗng, kiểm tra trạng thái máy chủ
    if (!matchedUser) {
      const health = await checkServerHealth(3500);
      setServerCheckResult(health);

      if (!health.isOnline) {
        setIsLoading(false);
        setIsServerModalOpen(true);
        return;
      }

      // Nếu server online, thử fetch lại users từ server một lần nữa
      const freshUsers = await fetchUsers();
      if (freshUsers && freshUsers.length > 0) {
        setCurrentUsersList(freshUsers);
        matchedUser = freshUsers.find(u => 
          u.username.trim().toLowerCase() === cleanUsername && 
          String(u.password).trim() === cleanPassword
        );
      }

      if (!matchedUser) {
        setError('Tên đăng nhập hoặc mật khẩu không chính xác.');
        setIsLoading(false);
        return;
      }
    }

    // 2. Ghi nhớ tên đăng nhập nếu cán bộ tích chọn
    if (rememberMe) {
      localStorage.setItem('saved_username', username.trim());
    } else {
      localStorage.removeItem('saved_username');
    }

    // 3. Gọi server để cấp Token JWT cho phiên làm việc
    try {
      const res = await fetch('/custom/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: matchedUser.username, 
          password: cleanPassword,
          user: matchedUser 
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
        }
      }
    } catch (err) {
      console.warn("Không thể lấy Token từ server, tiếp tục đăng nhập trực tiếp:", err);
    }

    onLogin(matchedUser);
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-[#040b17] overflow-hidden flex items-center justify-center font-sans">
      {/* BACKGROUND HI-TECH CYBER GIS MAP */}
      <div className="absolute inset-0 z-0">
        <VietnamCyberMap phase={animationPhase} />
      </div>

      {/* LOGIN CARD (GLASSMORPHISM CYBER HUD - PHASE 3 SLIDE & FADE IN) */}
      <div 
        className={`relative z-30 w-full max-w-[460px] mx-4 transition-all duration-1000 ease-out transform ${
          animationPhase >= 3 
            ? 'opacity-100 translate-x-0 translate-y-0 md:ml-auto md:mr-16 lg:mr-24' 
            : 'opacity-0 translate-x-20 pointer-events-none'
        }`}
      >
        <div 
          className="relative rounded-3xl p-8 sm:p-10 backdrop-blur-2xl bg-[#091527]/85 border-2 border-cyan-400/40 shadow-[0_0_50px_rgba(0,180,255,0.35),inset_0_0_20px_rgba(0,229,255,0.15)] overflow-hidden"
        >
          {/* Card Tech Corner Accents */}
          <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
          <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
          <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
          <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-cyan-400" />

          {/* Top Logo / Cyber Icon */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative mb-3">
              {/* Glowing Cyber Folder Icon Box */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 via-cyan-500/20 to-blue-600/30 border border-cyan-400/50 flex items-center justify-center p-3 shadow-[0_0_25px_rgba(0,229,255,0.4)]">
                <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" fill="none">
                  {/* Folder Tab & Body in Gold */}
                  <path d="M6 14C6 11.7909 7.79086 10 10 10H18L22 15H38C40.2091 15 42 16.7909 42 19V36C42 38.2091 40.2091 40 38 40H10C7.79086 40 6 38.2091 6 36V14Z" stroke="#fbbf24" strokeWidth="2.5" fill="rgba(245,158,11,0.15)" />
                  {/* Internal Circuit Connection Dots & Lines in Cyan */}
                  <path d="M16 26H24M24 26L28 32M24 26L28 20M28 20H34M28 32H34" stroke="#00e5ff" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="16" cy="26" r="2.5" fill="#00e5ff" />
                  <circle cx="34" cy="20" r="2.5" fill="#00e5ff" />
                  <circle cx="34" cy="32" r="2.5" fill="#00e5ff" />
                </svg>
              </div>
              <div className="absolute -inset-1 rounded-2xl bg-cyan-400/20 blur-md -z-10 animate-pulse" />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-wider uppercase drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">
              HỆ THỐNG QUẢN LÝ HỒ SƠ
            </h2>
            <p className="text-xs text-cyan-200/80 mt-1.5 max-w-xs font-medium">
              Chào mừng bạn đến với hệ thống quản lý hồ sơ kỹ thuật số.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-950/70 border border-red-500/60 text-red-300 text-xs p-3 rounded-xl flex items-center gap-2.5 animate-fade-in shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                <div className="w-2 h-2 rounded-full bg-red-400 animate-ping shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-cyan-200 tracking-wide ml-1">
                Tài khoản
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cyan-400/80 group-focus-within:text-cyan-300">
                  <UserIcon size={18} />
                </div>
                <input
                  type="text"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-[#0d213d]/80 border border-cyan-500/40 rounded-xl text-sm font-medium text-white placeholder-cyan-500/50 outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/30 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
                  placeholder="Nhập tên đăng nhập"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-semibold text-cyan-200 tracking-wide">
                  Mật khẩu
                </label>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-cyan-400/80 group-focus-within:text-cyan-300">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full pl-10 pr-24 py-3 bg-[#0d213d]/80 border border-cyan-500/40 rounded-xl text-sm font-medium text-white placeholder-cyan-500/50 outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-400/30 transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]"
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-cyan-300/80 hover:text-cyan-200 transition-colors z-10 py-1 px-1.5 rounded"
                  title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  <span className="text-[11px] font-mono">{showPassword ? "Ẩn" : "Hiện/Ẩn"}</span>
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-cyan-500/60 bg-[#0d213d] transition-all checked:border-cyan-400 checked:bg-cyan-500 hover:border-cyan-300 focus:ring-2 focus:ring-cyan-400/30"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-950 opacity-0 peer-checked:opacity-100">
                    <CheckCircle2 size={12} strokeWidth={4} />
                  </div>
                </div>
                <span className="text-xs font-medium text-cyan-200/90 group-hover:text-cyan-100 transition-colors">
                  Ghi nhớ đăng nhập
                </span>
              </label>

              <button
                type="button"
                onClick={() => alert("Vui lòng liên hệ Quản trị viên (Admin) để được cấp lại hoặc đặt lại mật khẩu.")}
                className="text-xs font-medium text-cyan-400 hover:text-cyan-200 hover:underline transition-colors"
              >
                Quên mật khẩu?
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-3 py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-600 hover:from-blue-600 hover:to-cyan-500 text-white font-bold text-sm tracking-wide shadow-[0_0_25px_rgba(0,180,255,0.5)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 border border-cyan-300/40"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw size={16} className="animate-spin text-cyan-200" />
                  <span>Đang xác thực hệ thống...</span>
                </span>
              ) : (
                <span>Đăng nhập hệ thống</span>
              )}
            </button>
          </form>

          {/* Footer Info inside card */}
          <div className="mt-6 pt-4 border-t border-cyan-500/20 flex justify-between items-center text-[10px] font-mono text-cyan-400/70">
            <span>VERSION {APP_VERSION}</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              CADASTRE GATEWAY
            </span>
          </div>
        </div>
      </div>

      {/* POPUP CẢNH BÁO MÁY CHỦ CHƯA KHỞI ĐỘNG / MẤT KẾT NỐI KHI ĐĂNG NHẬP */}
      {isServerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
          <div className="w-full max-w-md bg-[#091527] rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-cyan-500/40 overflow-hidden text-white animate-scale-up">
            <div className="h-1.5 w-full bg-gradient-to-r from-red-500 via-amber-400 to-red-500 animate-pulse" />
            
            <div className="p-6 text-center flex flex-col items-center">
              <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400 mb-3 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                <ServerOff size={28} />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-red-950/80 text-red-400 border border-red-500/30 text-xs font-black uppercase tracking-wider mb-2">
                <AlertTriangle size={13} /> Máy chủ chưa sẵn sàng
              </div>

              <h3 className="text-lg font-extrabold text-white mb-2">
                MÁY CHỦ CHƯA ĐƯỢC BẬT
              </h3>

              <p className="text-slate-300 text-xs leading-relaxed mb-4">
                Hệ thống máy chủ dữ liệu (<span className="font-mono font-bold text-cyan-300">api.qlhsct.info.vn</span>) hiện chưa được Quản trị viên khởi động hoặc đang bảo trì.
              </p>

              <div className="w-full bg-amber-950/30 border border-amber-500/40 rounded-xl p-3 text-left text-xs text-amber-200 space-y-1 mb-5">
                <p className="font-bold text-amber-300 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-amber-400" /> Hướng dẫn xử lý:
                </p>
                <ul className="list-disc list-inside space-y-0.5 pl-1 text-slate-300 text-[11px]">
                  <li>Vui lòng liên hệ Admin để bật <strong>Docker Desktop / Server</strong>.</li>
                  <li>Nếu bạn là Admin: Hãy kiểm tra các container Docker đã chạy chưa.</li>
                </ul>
              </div>

              {serverCheckResult?.isOnline ? (
                <div className="w-full p-2.5 bg-emerald-950/60 text-emerald-300 font-bold text-xs rounded-xl border border-emerald-500/40 mb-4 flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} />
                  Máy chủ đã hoạt động! Bạn có thể đăng nhập ngay.
                </div>
              ) : null}

              <div className="w-full flex gap-2">
                <button
                  type="button"
                  onClick={handleCheckServer}
                  disabled={isCheckingServer}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                >
                  <RefreshCw size={15} className={isCheckingServer ? 'animate-spin' : ''} />
                  {isCheckingServer ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsServerModalOpen(false)}
                  className="py-2.5 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors border border-slate-700"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
