import React, { useEffect, useState } from 'react';
import { User, Employee, UserRole } from '../types';
import { 
  Sparkles, Sun, Moon, Sunrise, Sunset, X, Check, Calendar, 
  Building2, Briefcase, Award, HeartHandshake, ShieldCheck, 
  UserCheck, CloudSun, Flame, Clock
} from 'lucide-react';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  employees?: Employee[];
}

interface TimeTheme {
  period: 'dawn' | 'morning' | 'midday' | 'afternoon' | 'night';
  greeting: string;
  subGreeting: string;
  wishingText: string;
  headerBg: string;
  badgeBg: string;
  badgeTextColor: string;
  icon: React.ReactNode;
  skyDecor: React.ReactNode;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ 
  isOpen, 
  onClose, 
  user,
  employees = []
}) => {
  const [theme, setTheme] = useState<TimeTheme | null>(null);

  // Tìm thông tin Nhân viên tương ứng với User (qua employeeId hoặc tên)
  const matchedEmployee = user ? employees.find(emp => 
    (emp.id && user.employeeId && emp.id === user.employeeId) ||
    (emp.name && user.name && emp.name.trim().toLowerCase() === user.name.trim().toLowerCase())
  ) : null;

  // Xử lý Chức vụ & Tên tổ
  const getRoleTitle = (role?: UserRole, customPosition?: string): string => {
    if (customPosition && customPosition.trim() !== '') {
      return customPosition;
    }
    switch (role) {
      case UserRole.ADMIN:
        return 'Quản trị viên Hệ thống';
      case UserRole.SUBADMIN:
        return 'Phó Quản trị Hệ thống';
      case UserRole.TEAM_LEADER:
        return 'Nhóm trưởng / Tổ trưởng';
      case UserRole.ONEDOOR:
        return 'Cán bộ Bộ phận Một cửa';
      case UserRole.EMPLOYEE:
      default:
        return 'Chuyên viên Xử lý Hồ sơ';
    }
  };

  const departmentName = matchedEmployee?.department || (
    user?.role === UserRole.ADMIN ? 'Ban Quản trị Hệ thống' :
    user?.role === UserRole.ONEDOOR ? 'Bộ phận Tiếp nhận & Trả kết quả' :
    'Tổ Chuyên môn & Kỹ thuật'
  );

  const positionName = getRoleTitle(user?.role, matchedEmployee?.position);

  // Tính toán thời gian và chủ đề (Theme) theo giờ trong ngày
  useEffect(() => {
    if (!isOpen) return;

    const hour = new Date().getHours();

    let currentTheme: TimeTheme;

    if (hour >= 5 && hour < 8) {
      // Sáng sớm / Bình minh (05:00 - 08:00)
      currentTheme = {
        period: 'dawn',
        greeting: 'Chào Bình Minh Rạng Rỡ!',
        subGreeting: 'Sáng sớm thanh khiết, khởi đầu ngày mới tràn đầy năng lượng',
        wishingText: 'Mặt trời mọc mang theo khởi đầu tươi mới! Chúc bạn có một ngày làm việc tràn ngập niềm vui và gặt hái nhiều kết quả tốt đẹp.',
        headerBg: 'bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600',
        badgeBg: 'bg-amber-100/90 text-amber-800 border-amber-300',
        badgeTextColor: 'text-amber-200',
        icon: <Sunrise className="text-amber-300 animate-bounce" size={32} />,
        skyDecor: (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Mặt trời mọc ở đường chân trời */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-28 h-28 bg-amber-300/40 rounded-full blur-xl animate-pulse" />
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-16 bg-gradient-to-t from-amber-200 to-amber-400 rounded-full shadow-[0_0_30px_rgba(251,191,36,0.8)] border-2 border-amber-100 flex items-center justify-center">
              <div className="w-20 h-20 border border-amber-200/40 rounded-full animate-ping opacity-75" />
            </div>
            {/* Tia nắng rạng đông */}
            <div className="absolute top-2 left-8 w-1.5 h-12 bg-amber-200/30 rotate-45 blur-xs animate-pulse" />
            <div className="absolute top-4 right-12 w-2 h-16 bg-rose-200/30 -rotate-30 blur-xs animate-pulse" />
            {/* Lớp mây sáng sớm */}
            <div className="absolute bottom-1 left-4 w-24 h-6 bg-white/20 rounded-full blur-sm" />
            <div className="absolute bottom-3 right-6 w-32 h-8 bg-white/25 rounded-full blur-sm" />
          </div>
        )
      };
    } else if (hour >= 8 && hour < 11.5) {
      // Buổi sáng rực rỡ (08:00 - 11:30)
      currentTheme = {
        period: 'morning',
        greeting: 'Chào Buổi Sáng Rực Rỡ!',
        subGreeting: 'Năng lượng tràn đầy cho ngày làm việc hanh thông',
        wishingText: 'Chúc bạn một buổi sáng làm việc tập trung, hăng hái, hoàn thành nhanh chóng mọi mục tiêu hồ sơ trong ngày!',
        headerBg: 'bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600',
        badgeBg: 'bg-sky-100/90 text-sky-800 border-sky-300',
        badgeTextColor: 'text-sky-200',
        icon: <CloudSun className="text-amber-300 animate-pulse" size={32} />,
        skyDecor: (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Mặt trời tỏa sáng góc phải */}
            <div className="absolute top-2 right-6 w-20 h-20 bg-amber-400/30 rounded-full blur-lg animate-pulse" />
            <div className="absolute top-3 right-8 w-14 h-14 bg-gradient-to-br from-amber-300 to-yellow-500 rounded-full shadow-[0_0_25px_rgba(245,158,11,0.8)] border border-yellow-200">
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-yellow-200/60 animate-spin-slow" />
            </div>
            {/* Đám mây trắng trôi */}
            <div className="absolute top-6 left-6 w-20 h-7 bg-white/30 rounded-full blur-[1px] animate-pulse" />
            <div className="absolute top-10 left-20 w-14 h-5 bg-white/20 rounded-full blur-[1px]" />
          </div>
        )
      };
    } else if (hour >= 11.5 && hour < 13.5) {
      // Buổi trưa (11:30 - 13:30)
      currentTheme = {
        period: 'midday',
        greeting: 'Chào Buổi Trưa Tốt Lành!',
        subGreeting: 'Thời gian nghỉ ngơi thư thái & tái tạo năng lượng',
        wishingText: 'Một nửa ngày làm việc đã trôi qua xuất sắc! Chúc bạn có thời gian nghỉ trưa an lành, sảng khoái và dùng bữa ngon miệng.',
        headerBg: 'bg-gradient-to-r from-amber-500 via-yellow-500 to-sky-600',
        badgeBg: 'bg-yellow-100/90 text-yellow-800 border-yellow-300',
        badgeTextColor: 'text-yellow-100',
        icon: <Flame className="text-yellow-200 animate-pulse" size={32} />,
        skyDecor: (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Mặt trời đứng bóng đỉnh đầu */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-24 h-24 bg-yellow-300/40 rounded-full blur-xl animate-pulse" />
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-16 bg-gradient-to-br from-yellow-200 via-amber-400 to-orange-400 rounded-full shadow-[0_0_35px_rgba(251,191,36,0.9)] border-2 border-white/60 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full border border-yellow-100/80 animate-ping opacity-60" />
            </div>
            {/* Vầng hào quang chói lóa */}
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-yellow-200/20 to-transparent" />
          </div>
        )
      };
    } else if (hour >= 13.5 && hour < 18) {
      // Buổi chiều / Hoàng hôn (13:30 - 18:00)
      currentTheme = {
        period: 'afternoon',
        greeting: 'Chào Buổi Chiều Hanh Thông!',
        subGreeting: 'Ánh chiều tà dịu nhẹ, chúc công việc thuận lợi vẹn toàn',
        wishingText: 'Buổi chiều là thời điểm tuyệt vời để tăng tốc và hoàn thiện trọn vẹn các công việc còn lại trong ngày. Chúc bạn làm việc hiệu quả và vui vẻ!',
        headerBg: 'bg-gradient-to-r from-orange-500 via-amber-600 to-purple-700',
        badgeBg: 'bg-orange-100/90 text-orange-800 border-orange-300',
        badgeTextColor: 'text-orange-200',
        icon: <Sunset className="text-amber-200 animate-bounce" size={32} />,
        skyDecor: (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Mặt trời ngả về tây / hoàng hôn */}
            <div className="absolute bottom-1 right-10 w-24 h-24 bg-orange-400/40 rounded-full blur-xl animate-pulse" />
            <div className="absolute bottom-2 right-12 w-16 h-16 bg-gradient-to-t from-rose-500 via-orange-400 to-amber-300 rounded-full shadow-[0_0_30px_rgba(249,115,22,0.8)] border border-amber-200" />
            {/* Mây tím hoàng hôn */}
            <div className="absolute top-4 left-6 w-28 h-6 bg-purple-300/25 rounded-full blur-xs" />
            <div className="absolute bottom-4 left-12 w-36 h-7 bg-rose-300/20 rounded-full blur-xs" />
          </div>
        )
      };
    } else {
      // Buổi tối / Ban đêm (18:00 - 05:00)
      currentTheme = {
        period: 'night',
        greeting: 'Chào Buổi Tối Thư Thái!',
        subGreeting: 'Không gian yên bình, chúc bạn buổi tối an lành',
        wishingText: 'Cảm ơn sự cống hiến của bạn hôm nay. Chúc bạn một buổi tối thật thư thái, ấm áp bên gia đình hoặc giải quyết nốt hồ sơ một cách nhẹ nhàng nhất!',
        headerBg: 'bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-900',
        badgeBg: 'bg-indigo-950/80 text-indigo-200 border-indigo-700',
        badgeTextColor: 'text-indigo-300',
        icon: <Moon className="text-amber-200 animate-pulse" size={32} />,
        skyDecor: (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Trăng lưỡi liềm phát sáng */}
            <div className="absolute top-2 right-8 w-16 h-16 bg-amber-200/20 rounded-full blur-md animate-pulse" />
            <div className="absolute top-3 right-10 w-12 h-12 bg-gradient-to-br from-amber-100 to-amber-300 rounded-full shadow-[0_0_20px_rgba(253,230,138,0.7)] flex items-center justify-center">
              <div className="w-9 h-9 bg-indigo-950 rounded-full translate-x-2 -translate-y-1" />
            </div>
            {/* Các vì sao lấp lánh */}
            <Sparkles className="absolute top-4 left-10 text-amber-200/90 animate-ping" size={16} />
            <Sparkles className="absolute top-12 left-1/3 text-purple-200/80 animate-pulse" size={14} />
            <Sparkles className="absolute bottom-6 left-16 text-sky-200/70 animate-pulse" size={12} />
            <Sparkles className="absolute top-6 right-28 text-amber-100/90 animate-bounce" size={15} />
          </div>
        )
      };
    }

    setTheme(currentTheme);
  }, [isOpen]);

  // Tự động đóng sau 8 giây nếu không ấn đóng
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 8500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !user || !theme) return null;

  const todayStr = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200/80 transform transition-all animate-scale-up">
        
        {/* Banner trang trí theo thời gian trong ngày */}
        <div className={`h-36 ${theme.headerBg} p-6 flex justify-between items-start relative overflow-hidden transition-all duration-700`}>
          {/* Sân khấu hiệu ứng thời gian */}
          {theme.skyDecor}

          {/* Tiêu đề chính trong Banner */}
          <div className="flex items-center gap-3.5 relative z-10 text-white mt-1">
            <div className="p-3 bg-white/20 backdrop-blur-xl rounded-2xl ring-1 ring-white/40 shadow-lg shrink-0">
              {theme.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full backdrop-blur-md border ${theme.badgeBg}`}>
                  {theme.greeting}
                </span>
              </div>
              <h3 className="text-xl font-extrabold leading-tight mt-1 text-white drop-shadow-sm">
                Đăng nhập thành công
              </h3>
            </div>
          </div>

          {/* Nút đóng */}
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-all relative z-10 hover:scale-110 active:scale-95"
            title="Đóng (Tự đóng sau 8s)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Khối Avatar & Ngày tháng đè lên viền Banner */}
        <div className="px-6 -mt-9 relative z-20 flex justify-between items-end">
          <div className="relative">
            <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 border-4 border-white shadow-xl flex items-center justify-center text-white font-black text-2xl tracking-wider uppercase ring-2 ring-blue-500/20">
              {user.name ? user.name.charAt(0) : 'U'}
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-5 w-5 bg-emerald-500 border-2 border-white"></span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200/80 shadow-sm">
            <Calendar size={14} className="text-blue-600 shrink-0" />
            <span className="capitalize">{todayStr}</span>
          </div>
        </div>

        {/* Nội dung chi tiết hồ sơ & Chức danh người dùng */}
        <div className="p-6 pt-4 space-y-4">
          
          {/* Tên người dùng & Tài khoản */}
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>{user.name}</span>
              <Sparkles className="text-amber-500 animate-spin-slow shrink-0" size={22} />
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Tài khoản hệ thống: <span className="font-semibold text-slate-700">@{user.username}</span>
            </p>
          </div>

          {/* Khối Thông tin TỔ & CHỨC VỤ (Theo yêu cầu người dùng) */}
          <div className="grid grid-cols-2 gap-3 bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200/80">
            {/* Tên Tổ / Bộ phận */}
            <div className="flex items-start gap-2.5">
              <div className="p-2 bg-blue-100/80 text-blue-700 rounded-xl shrink-0 mt-0.5">
                <Building2 size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Tổ / Bộ phận
                </span>
                <p className="text-sm font-bold text-slate-800 truncate leading-snug" title={departmentName}>
                  {departmentName}
                </p>
              </div>
            </div>

            {/* Chức vụ / Vai trò */}
            <div className="flex items-start gap-2.5">
              <div className="p-2 bg-indigo-100/80 text-indigo-700 rounded-xl shrink-0 mt-0.5">
                <Award size={18} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Chức vụ
                </span>
                <p className="text-sm font-bold text-slate-800 truncate leading-snug" title={positionName}>
                  {positionName}
                </p>
              </div>
            </div>
          </div>

          {/* Lời chúc ngày làm việc sinh động */}
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50/80 to-sky-50 rounded-2xl p-4 border border-blue-200/60 shadow-sm flex gap-3.5 items-start">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/30 shrink-0 mt-0.5">
              <HeartHandshake size={22} />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-slate-900 text-sm leading-snug">
                Lời chúc công việc:
              </p>
              <p className="text-xs font-medium text-slate-700 leading-relaxed">
                {theme.wishingText}
              </p>
            </div>
          </div>

          {/* Nút hành động chính */}
          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-3.5 px-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:via-indigo-700 hover:to-sky-700 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-indigo-500/25 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 group"
            >
              <Check size={18} className="group-hover:scale-125 transition-transform" />
              <span>Bắt đầu làm việc ngay</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
