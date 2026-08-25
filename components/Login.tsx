
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { ShieldCheck, LogIn, User as UserIcon, Lock, CheckCircle2, Eye, EyeOff, ServerOff, RefreshCw, AlertTriangle, Play, FastForward, FolderKanban } from 'lucide-react';
import { checkServerHealth, ServerHealthResult } from '../services/apiSystem';
import { fetchUsers } from '../services/apiPeople';
import { APP_VERSION } from '../constants';
import VietnamMapIntro from './VietnamMapIntro';

interface LoginProps {
  onLogin: (user: User) => void;
  users: User[]; 
}

type IntroPhase = 'map_in' | 'dongnai_glow' | 'login_ready';

const Login: React.FC<LoginProps> = ({ onLogin, users }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Animation Intro Phases: 'map_in' -> 'dongnai_glow' -> 'login_ready'
  const [introPhase, setIntroPhase] = useState<IntroPhase>('map_in');

  // Server Offline Warning Modal state for Login
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [serverCheckResult, setServerCheckResult] = useState<ServerHealthResult | null>(null);
  const [isCheckingServer, setIsCheckingServer] = useState(false);
  const [currentUsersList, setCurrentUsersList] = useState<User[]>(users);

  // Run the Intro Animation Timeline
  const runIntroSequence = () => {
    setIntroPhase('map_in');
    
    // Giai đoạn 1: Bản đồ hiện ra (0s - 1.1s)
    const t1 = setTimeout(() => {
      setIntroPhase('dongnai_glow'); // Giai đoạn 2: Tỉnh Đồng Nai sáng rực lên & phát sóng radar
    }, 1100);

    // Giai đoạn 2 -> 3: Ô đăng nhập trượt vào mượt mà (2.4s trở đi)
    const t2 = setTimeout(() => {
      setIntroPhase('login_ready');
    }, 2400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  };

  useEffect(() => {
    const cleanup = runIntroSequence();
    return cleanup;
  }, []);

  const handleSkipIntro = () => {
    setIntroPhase('login_ready');
  };

  const handleReplayIntro = () => {
    runIntroSequence();
  };

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
    <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-[#050a14] font-sans overflow-hidden text-slate-100 select-none">
      {/* 8K Ultra High Definition Cyber Map Wallpaper */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          src="./login_clean_bg.jpg"
          alt="Bản đồ Việt Nam 3D Hologram"
          className={`w-full h-full object-cover object-center filter transition-all duration-1000 ${
            introPhase === 'login_ready' ? 'scale-100 brightness-105' : 'scale-105 brightness-110'
          }`}
        />
        {/* Subtle Vignette Shadows */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#050a14]/60 via-transparent to-[#050a14]/40 pointer-events-none" />
      </div>

      {/* Dynamic Animated Laser Pulse on Dong Nai */}
      <VietnamMapIntro phase={introPhase} />

      {/* Top Header Bar / Brand */}
      <div className="absolute top-6 left-8 z-30 flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-slate-900/80 p-2 border border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-center backdrop-blur-md">
          <img src="./logo.png" alt="Logo" className="w-full h-full object-contain" />
        </div>
        <div>
          <h1 className="text-base font-extrabold tracking-wide text-white flex items-center gap-2">
            HỆ THỐNG QUẢN LÝ HỒ SƠ
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono border border-cyan-500/30">
              v{APP_VERSION}
            </span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">Chi nhánh Văn phòng Đăng ký Đất đai</p>
        </div>
      </div>

      {/* Top Right Quick Controls: Skip Intro & Replay Demo */}
      <div className="absolute top-6 right-8 z-30 flex items-center gap-2">
        {introPhase !== 'login_ready' ? (
          <button
            onClick={handleSkipIntro}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700/60 backdrop-blur-md shadow-lg transition-all active:scale-95"
            title="Bỏ qua hiệu ứng và vào đăng nhập ngay"
          >
            <FastForward size={14} className="text-cyan-400" />
            <span>Bỏ qua hiệu ứng</span>
          </button>
        ) : (
          <button
            onClick={handleReplayIntro}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 hover:text-cyan-300 text-xs font-medium border border-slate-700/50 backdrop-blur-md shadow transition-all active:scale-95"
            title="Xem lại hiệu ứng bản đồ và điểm sáng Đồng Nai"
          >
            <Play size={13} className="text-amber-400" />
            <span>Xem lại hiệu ứng</span>
          </button>
        )}
      </div>

      {/* Main Interactive Stage Container */}
      <div className="relative z-20 w-full max-w-[1400px] h-full mx-auto px-8 flex items-center justify-between">
        
        {/* Left Side: Space for sharp 8K Vietnam map */}
        <div className="hidden lg:flex w-1/2 h-full" />

        {/* Right Side: Glassmorphism Login Card (Matching the Mockup Exactly) */}
        <div 
          className={`w-full lg:w-1/2 flex items-center justify-end transition-all duration-700 ease-out ${
            introPhase === 'login_ready'
              ? 'opacity-100 translate-x-0 pointer-events-auto'
              : 'opacity-0 translate-x-20 pointer-events-none'
          }`}
        >
          <div className="w-full max-w-[460px] bg-slate-900/85 backdrop-blur-2xl border-2 border-cyan-400/50 rounded-[32px] p-8 sm:p-10 shadow-[0_0_50px_rgba(6,182,212,0.35),inset_0_0_20px_rgba(6,182,212,0.1)] text-slate-100 relative overflow-hidden animate-fade-in-up">
            
            {/* Top Glowing Ambient Light */}
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-cyan-500/20 rounded-full blur-[50px] pointer-events-none" />

            {/* Header with High-Tech Folder Icon matching Mockup */}
            <div className="mb-8 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-cyan-400/40 flex items-center justify-center text-cyan-400 mb-4 shadow-[0_0_25px_rgba(6,182,212,0.4)]">
                <FolderKanban size={36} className="text-cyan-300 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
              </div>

              <h2 className="text-2xl sm:text-[26px] font-black text-white tracking-tight uppercase">
                HỆ THỐNG QUẢN LÝ HỒ SƠ
              </h2>
              <p className="text-slate-300/80 text-xs sm:text-sm mt-2 max-w-xs leading-relaxed">
                Chào mừng bạn đến với hệ thống quản lý hồ sơ kỹ thuật số.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-950/70 text-red-300 text-sm p-3.5 rounded-xl border border-red-500/40 font-medium flex items-center gap-3 mb-6 animate-fade-in shadow-inner">
                <div className="w-2 h-2 rounded-full bg-red-400 shrink-0 animate-ping"></div>
                {error}
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 ml-1">Tài khoản</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <UserIcon size={19} className="text-slate-400 group-focus-within:text-cyan-400 transition-colors" />
                  </div>
                  <input
                    type="text"
                    required
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-950/70 border border-slate-700/90 rounded-2xl focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-400 outline-none transition-all text-white placeholder-slate-500 text-sm font-medium shadow-inner"
                    placeholder="Nhập tên đăng nhập"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 ml-1">Mật khẩu</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock size={19} className="text-slate-400 group-focus-within:text-cyan-400 transition-colors" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full pl-11 pr-24 py-3.5 bg-slate-950/70 border border-slate-700/90 rounded-2xl focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-400 outline-none transition-all text-white placeholder-slate-500 text-sm font-medium shadow-inner"
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-cyan-300 transition-colors z-10 flex items-center gap-1 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700"
                    title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    <span>{showPassword ? "Ẩn" : "Hiện"}</span>
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer group select-none">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      className="peer h-5 w-5 cursor-pointer appearance-none rounded-lg border border-slate-600 bg-slate-900 transition-all checked:border-cyan-400 checked:bg-cyan-500 hover:border-slate-500 focus:ring-2 focus:ring-cyan-500/30"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-950 opacity-0 peer-checked:opacity-100">
                      <CheckCircle2 size={13} strokeWidth={4} />
                    </div>
                  </div>
                  <span className="text-xs font-medium text-slate-300 group-hover:text-cyan-300 transition-colors">
                    Ghi nhớ đăng nhập
                  </span>
                </label>

                <span className="text-xs text-cyan-400/80 hover:text-cyan-300 cursor-pointer font-medium">
                  Quên mật khẩu?
                </span>
              </div>

              {/* Submit Button (Deep Blue Glowing Button matching Mockup) */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-4 bg-gradient-to-r from-[#003884] via-[#0055b8] to-[#003884] hover:from-[#0048aa] hover:via-[#006bd6] hover:to-[#0048aa] text-white py-4 rounded-2xl font-extrabold text-base shadow-[0_0_30px_rgba(0,102,230,0.5)] border border-blue-400/30 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <img src="./logo.png" alt="Logo" className="w-5 h-5 object-contain animate-spin shrink-0" />
                    <span>Đang xác thực hệ thống...</span>
                  </span>
                ) : (
                  <span>Đăng nhập hệ thống</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* POPUP CẢNH BÁO MÁY CHỦ CHƯA KHỞI ĐỘNG / MẤT KẾT NỐI KHI ĐĂNG NHẬP */}
      {isServerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 text-slate-100 rounded-3xl shadow-2xl border border-slate-700/80 overflow-hidden animate-scale-up">
            <div className="h-2 w-full bg-gradient-to-r from-red-500 via-amber-500 to-red-500 animate-pulse" />
            
            <div className="p-6 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-red-950/60 border-2 border-red-500/40 flex items-center justify-center text-red-400 mb-4 shadow-sm">
                <ServerOff size={32} />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/80 text-red-300 text-xs font-black uppercase tracking-wider mb-2 border border-red-500/30">
                <AlertTriangle size={13} /> Máy chủ chưa sẵn sàng
              </div>

              <h3 className="text-xl font-extrabold text-white mb-2">
                MÁY CHỦ CHƯA ĐƯỢC BẬT
              </h3>

              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                Hệ thống máy chủ dữ liệu (<span className="font-mono font-bold text-cyan-400">api.qlhsct.info.vn</span>) hiện chưa được Quản trị viên (Admin) khởi động hoặc đang bảo trì.
              </p>

              <div className="w-full bg-amber-950/40 border border-amber-500/30 rounded-2xl p-3 text-left text-xs text-amber-200 space-y-1 mb-5">
                <p className="font-bold text-amber-400 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-amber-400" /> Hướng dẫn xử lý:
                </p>
                <ul className="list-disc list-inside space-y-0.5 pl-1 text-slate-300">
                  <li>Vui lòng liên hệ Admin để bật <strong>Docker Desktop / Server</strong>.</li>
                  <li>Nếu bạn là Admin: Hãy kiểm tra các container Docker đã chạy chưa.</li>
                </ul>
              </div>

              {serverCheckResult?.isOnline ? (
                <div className="w-full p-3 bg-emerald-950/60 text-emerald-300 font-bold text-sm rounded-xl border border-emerald-500/30 mb-4 flex items-center justify-center gap-2">
                  <CheckCircle2 size={18} />
                  Máy chủ đã hoạt động trở lại! Bạn có thể đăng nhập ngay.
                </div>
              ) : null}

              <div className="w-full flex gap-2">
                <button
                  type="button"
                  onClick={handleCheckServer}
                  disabled={isCheckingServer}
                  className="flex-1 py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                >
                  <RefreshCw size={16} className={isCheckingServer ? 'animate-spin' : ''} />
                  {isCheckingServer ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsServerModalOpen(false)}
                  className="py-3 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-colors"
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


