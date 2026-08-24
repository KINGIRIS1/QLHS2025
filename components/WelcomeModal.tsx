import React, { useEffect, useState } from 'react';
import { User, Employee, UserRole, RecordFile, WorkSchedule, DeviceSchedule, RecordStatus } from '../types';
import { 
  Sparkles, Sun, Moon, Sunrise, Sunset, X, Check, Calendar, 
  Building2, Award, HeartHandshake, CloudSun, Flame, Clock,
  AlertTriangle, CalendarDays, FileText, ChevronRight, Car,
  Ruler, ShieldAlert, CheckCircle2, ArrowRight
} from 'lucide-react';
import { fetchWorkSchedules } from '../services/apiWorkSchedule';
import { fetchDeviceSchedules } from '../services/apiDeviceSchedule';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  employees?: Employee[];
  records?: RecordFile[];
  onSelectRecord?: (record: RecordFile) => void;
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

// Chuyển đổi định dạng ngày về chuẩn YYYY-MM-DD
const formatDateKey = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      const parts = dateStr.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      return '';
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return '';
  }
};

// Format ngày hiển thị dạng DD/MM/YYYY
const formatDisplayDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  const key = formatDateKey(dateStr);
  if (!key) return dateStr;
  const parts = key.split('-');
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ 
  isOpen, 
  onClose, 
  user,
  employees = [],
  records = [],
  onSelectRecord
}) => {
  const [theme, setTheme] = useState<TimeTheme | null>(null);
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [deviceSchedules, setDeviceSchedules] = useState<DeviceSchedule[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [activeTab, setActiveTab] = useState<'due_today' | 'upcoming' | 'extended' | 'work_schedule' | 'device_schedule'>('due_today');

  // Tìm thông tin Nhân viên tương ứng với User (qua employeeId hoặc tên)
  const matchedEmployee = user ? employees.find(emp => 
    (emp.id && user.employeeId && emp.id === user.employeeId) ||
    (emp.name && user.name && emp.name.trim().toLowerCase() === user.name.trim().toLowerCase())
  ) : null;

  // Chức vụ & Tổ
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
      case UserRole.RECEPTION_HANDOVER:
        return 'Cán bộ Tiếp nhận & Bàn giao';
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

  // Tính toán các mốc ngày
  const todayObj = new Date();
  const todayStr = formatDateKey(todayObj.toISOString());
  const tomorrowStr = formatDateKey(new Date(Date.now() + 86400000).toISOString());
  const day2Str = formatDateKey(new Date(Date.now() + 2 * 86400000).toISOString());
  const day3Str = formatDateKey(new Date(Date.now() + 3 * 86400000).toISOString());
  const validExtensionDates = [todayStr, tomorrowStr, day2Str, day3Str];

  // Kiểm tra tên / username của cán bộ có khớp không
  const userName = user?.name?.trim().toLowerCase() || '';
  const userUsername = user?.username?.trim().toLowerCase() || '';
  const empId = matchedEmployee?.id?.toLowerCase() || user?.employeeId?.toLowerCase() || '';
  const empName = matchedEmployee?.name?.trim().toLowerCase() || '';

  const isAssignedToUser = (assignedTo?: string | null): boolean => {
    if (!assignedTo) return false;
    const target = assignedTo.trim().toLowerCase();
    return (
      target === userUsername ||
      target === userName ||
      (empId !== '' && target === empId) ||
      (empName !== '' && target === empName) ||
      target.includes(userName) ||
      userName.includes(target)
    );
  };

  const isExecutorMatch = (execStr?: string | null): boolean => {
    if (!execStr) return false;
    const target = execStr.trim().toLowerCase();
    return (
      target.includes(userUsername) ||
      target.includes(userName) ||
      (empName !== '' && target.includes(empName))
    );
  };

  // Lọc danh sách hồ sơ chưa hoàn thành của cán bộ
  const activeRecords = (records || []).filter(r => 
    r.status !== RecordStatus.RETURNED && 
    r.status !== RecordStatus.WITHDRAWN
  );

  const myRecords = activeRecords.filter(r => isAssignedToUser(r.assignedTo));

  // 1. Hồ sơ tới hạn hôm nay
  const dueTodayRecords = myRecords.filter(r => formatDateKey(r.deadline) === todayStr);

  // 2. Hồ sơ sắp tới hạn (1 - 2 ngày tới)
  const upcomingDueRecords = myRecords.filter(r => {
    const d = formatDateKey(r.deadline);
    return d === tomorrowStr || d === day2Str;
  });

  // 3. Hồ sơ có gia hạn trả trong 4 ngày (Hôm nay + 3 ngày tới)
  const extensionRecords = myRecords.filter(r => {
    const d = formatDateKey(r.extendedDeadline);
    return validExtensionDates.includes(d);
  });

  // 4. Lịch công tác hôm nay
  const todayWorkSchedules = workSchedules.filter(s => 
    formatDateKey(s.date) === todayStr && isExecutorMatch(s.executors)
  );

  // 5. Lịch máy đo hôm nay
  const todayDeviceSchedules = deviceSchedules.filter(s => 
    formatDateKey(s.date) === todayStr && (isExecutorMatch(s.executors) || isExecutorMatch(s.created_by))
  );

  const totalTaskCount = dueTodayRecords.length + upcomingDueRecords.length + extensionRecords.length + todayWorkSchedules.length + todayDeviceSchedules.length;

  // Lấy dữ liệu Lịch công tác và Máy đo khi Modal mở
  useEffect(() => {
    if (!isOpen) return;

    setIsLoadingSchedules(true);
    let isMounted = true;

    Promise.all([
      fetchWorkSchedules().catch(() => []),
      fetchDeviceSchedules().catch(() => [])
    ]).then(([workRes, deviceRes]) => {
      if (isMounted) {
        setWorkSchedules(workRes || []);
        setDeviceSchedules(deviceRes || []);
        setIsLoadingSchedules(false);
      }
    });

    return () => { isMounted = false; };
  }, [isOpen]);

  // Tự động chọn Tab đầu tiên có công việc
  useEffect(() => {
    if (!isOpen) return;

    if (dueTodayRecords.length > 0) {
      setActiveTab('due_today');
    } else if (upcomingDueRecords.length > 0) {
      setActiveTab('upcoming');
    } else if (extensionRecords.length > 0) {
      setActiveTab('extended');
    } else if (todayWorkSchedules.length > 0) {
      setActiveTab('work_schedule');
    } else if (todayDeviceSchedules.length > 0) {
      setActiveTab('device_schedule');
    }
  }, [isOpen, dueTodayRecords.length, upcomingDueRecords.length, extensionRecords.length, todayWorkSchedules.length, todayDeviceSchedules.length]);

  // Thiết lập chủ đề thời gian sinh động (Theme)
  useEffect(() => {
    if (!isOpen) return;

    const hour = new Date().getHours();
    let currentTheme: TimeTheme;

    if (hour >= 5 && hour < 8) {
      currentTheme = {
        period: 'dawn',
        greeting: 'CHÀO BÌNH MINH RẠNG RỠ!',
        subGreeting: 'Sáng sớm thanh khiết, khởi đầu ngày mới tràn đầy năng lượng',
        wishingText: 'Mặt trời mọc mang theo khởi đầu tươi mới! Chúc bạn một ngày làm việc tràn ngập niềm vui, tập trung cao độ và gặt hái nhiều kết quả xuất sắc.',
        headerBg: 'bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600',
        badgeBg: 'bg-amber-100/90 text-amber-800 border-amber-300',
        badgeTextColor: 'text-amber-200',
        icon: <Sunrise className="text-amber-300 animate-bounce" size={32} />,
        skyDecor: (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-36 h-36 bg-amber-300/40 rounded-full blur-xl animate-pulse" />
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-20 h-20 bg-gradient-to-t from-amber-200 to-amber-400 rounded-full shadow-[0_0_35px_rgba(251,191,36,0.9)] border-2 border-amber-100 flex items-center justify-center">
              <div className="w-24 h-24 border border-amber-200/50 rounded-full animate-ping opacity-75" />
            </div>
            <div className="absolute top-2 left-10 w-2 h-14 bg-amber-200/30 rotate-45 blur-xs animate-pulse" />
            <div className="absolute top-4 right-20 w-2 h-16 bg-rose-200/30 -rotate-30 blur-xs animate-pulse" />
            <div className="absolute bottom-2 left-6 w-28 h-6 bg-white/20 rounded-full blur-xs" />
            <div className="absolute bottom-3 right-10 w-36 h-8 bg-white/25 rounded-full blur-xs" />
          </div>
        )
      };
    } else if (hour >= 8 && hour < 11.5) {
      currentTheme = {
        period: 'morning',
        greeting: 'CHÀO BUỔI SÁNG RỰC RỠ!',
        subGreeting: 'Năng lượng tràn đầy cho ngày làm việc hanh thông',
        wishingText: 'Chúc bạn một buổi sáng làm việc tập trung, hăng hái, hoàn thành nhanh chóng mọi mục tiêu hồ sơ và nhiệm vụ trong ngày!',
        headerBg: 'bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600',
        badgeBg: 'bg-sky-100/90 text-sky-800 border-sky-300',
        badgeTextColor: 'text-sky-200',
        icon: <CloudSun className="text-amber-300 animate-pulse" size={32} />,
        skyDecor: (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1 right-16 w-24 h-24 bg-amber-400/30 rounded-full blur-xl animate-pulse" />
            <div className="absolute top-2 right-20 w-16 h-16 bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-500 rounded-full shadow-[0_0_30px_rgba(245,158,11,0.85)] border-2 border-yellow-200">
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-yellow-100/70 animate-spin-slow" />
            </div>
            <div className="absolute top-5 left-10 w-24 h-8 bg-white/30 rounded-full blur-xs animate-pulse" />
            <div className="absolute top-10 left-28 w-16 h-6 bg-white/20 rounded-full blur-xs" />
          </div>
        )
      };
    } else if (hour >= 11.5 && hour < 13.5) {
      currentTheme = {
        period: 'midday',
        greeting: 'CHÀO BUỔI TRƯA TỐT LÀNH!',
        subGreeting: 'Thời gian nghỉ ngơi thư thái & tái tạo năng lượng',
        wishingText: 'Một nửa ngày làm việc đã trôi qua xuất sắc! Chúc bạn có thời gian nghỉ trưa an lành, sảng khoái và dùng bữa ngon miệng.',
        headerBg: 'bg-gradient-to-r from-amber-500 via-yellow-500 to-sky-600',
        badgeBg: 'bg-yellow-100/90 text-yellow-800 border-yellow-300',
        badgeTextColor: 'text-yellow-100',
        icon: <Flame className="text-yellow-200 animate-pulse" size={32} />,
        skyDecor: (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-yellow-300/40 rounded-full blur-2xl animate-pulse" />
            <div className="absolute top-1 left-1/2 -translate-x-1/2 w-18 h-18 bg-gradient-to-br from-yellow-200 via-amber-400 to-orange-400 rounded-full shadow-[0_0_40px_rgba(251,191,36,0.95)] border-2 border-white/80 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full border border-yellow-100/90 animate-ping opacity-60" />
            </div>
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-yellow-100/25 to-transparent" />
          </div>
        )
      };
    } else if (hour >= 13.5 && hour < 18) {
      currentTheme = {
        period: 'afternoon',
        greeting: 'CHÀO BUỔI CHIỀU HANH THÔNG!',
        subGreeting: 'Ánh chiều tà dịu nhẹ, chúc công việc thuận lợi vẹn toàn',
        wishingText: 'Buổi chiều là thời điểm tuyệt vời để tăng tốc và hoàn thiện trọn vẹn các công việc còn lại trong ngày. Chúc bạn làm việc hiệu quả và vui vẻ!',
        headerBg: 'bg-gradient-to-r from-orange-500 via-amber-600 to-purple-700',
        badgeBg: 'bg-orange-100/90 text-orange-800 border-orange-300',
        badgeTextColor: 'text-orange-200',
        icon: <Sunset className="text-amber-200 animate-bounce" size={32} />,
        skyDecor: (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute bottom-1 right-16 w-28 h-28 bg-orange-400/40 rounded-full blur-xl animate-pulse" />
            <div className="absolute bottom-2 right-20 w-18 h-18 bg-gradient-to-t from-rose-500 via-orange-400 to-amber-300 rounded-full shadow-[0_0_35px_rgba(249,115,22,0.85)] border-2 border-amber-200" />
            <div className="absolute top-3 left-8 w-32 h-7 bg-purple-300/25 rounded-full blur-xs" />
            <div className="absolute bottom-4 left-16 w-40 h-8 bg-rose-300/20 rounded-full blur-xs" />
          </div>
        )
      };
    } else {
      currentTheme = {
        period: 'night',
        greeting: 'CHÀO BUỔI TỐI THƯ THÁI!',
        subGreeting: 'Không gian yên bình, chúc bạn buổi tối an lành',
        wishingText: 'Cảm ơn sự cống hiến của bạn hôm nay. Chúc bạn một buổi tối thật thư thái, ấm áp bên gia đình hoặc giải quyết nốt công việc một cách nhẹ nhàng nhất!',
        headerBg: 'bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-900',
        badgeBg: 'bg-indigo-950/80 text-indigo-200 border-indigo-700',
        badgeTextColor: 'text-indigo-300',
        icon: <Moon className="text-amber-200 animate-pulse" size={32} />,
        skyDecor: (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-1 right-16 w-20 h-20 bg-amber-200/20 rounded-full blur-md animate-pulse" />
            <div className="absolute top-2 right-18 w-14 h-14 bg-gradient-to-br from-amber-100 to-amber-300 rounded-full shadow-[0_0_25px_rgba(253,230,138,0.8)] flex items-center justify-center">
              <div className="w-10 h-10 bg-indigo-950 rounded-full translate-x-2.5 -translate-y-1" />
            </div>
            <Sparkles className="absolute top-3 left-12 text-amber-200/90 animate-ping" size={18} />
            <Sparkles className="absolute top-12 left-1/3 text-purple-200/80 animate-pulse" size={15} />
            <Sparkles className="absolute bottom-4 left-20 text-sky-200/70 animate-pulse" size={13} />
            <Sparkles className="absolute top-6 right-36 text-amber-100/90 animate-bounce" size={16} />
          </div>
        )
      };
    }

    setTheme(currentTheme);
  }, [isOpen]);

  // Logic đếm ngược TỰ ĐỘNG TẮT SAU 10S nếu KHÔNG CÓ CÔNG VIỆC
  // Nếu CÓ CÔNG VIỆC -> KHÔNG TỰ ĐỘNG TẮT, bắt buộc tắt thủ công
  useEffect(() => {
    if (!isOpen) return;

    if (totalTaskCount === 0) {
      setCountdown(10);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            onClose();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isOpen, totalTaskCount, onClose]);

  if (!isOpen || !user || !theme) return null;

  const todayDisplayStr = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const handleRecordClick = (record: RecordFile) => {
    if (onSelectRecord) {
      onSelectRecord(record);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      {/* Tăng kích thước popup rộng rãi: max-w-4xl cho trường hợp có việc và max-w-xl cho tiêu chuẩn */}
      <div className={`relative w-full ${totalTaskCount > 0 ? 'max-w-4xl' : 'max-w-xl'} bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200/90 transform transition-all animate-scale-up my-auto max-h-[92vh] flex flex-col`}>
        
        {/* Banner trang trí Top theo thời gian trong ngày */}
        <div className={`h-36 ${theme.headerBg} p-6 flex justify-between items-start relative overflow-hidden transition-all duration-700 shrink-0`}>
          {theme.skyDecor}

          {/* Tiêu đề & Thông điệp theo buổi */}
          <div className="flex items-center gap-3.5 relative z-10 text-white mt-0.5">
            <div className="p-3 bg-white/20 backdrop-blur-xl rounded-2xl ring-1 ring-white/40 shadow-lg shrink-0">
              {theme.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold uppercase tracking-wider px-3 py-0.5 rounded-full backdrop-blur-md border ${theme.badgeBg}`}>
                  {theme.greeting}
                </span>
              </div>
              <h3 className="text-xl font-extrabold leading-tight mt-1 text-white drop-shadow-sm">
                Đăng nhập hệ thống thành công
              </h3>
              <p className="text-xs text-white/85 font-medium mt-0.5 drop-shadow-2xs">
                {theme.subGreeting}
              </p>
            </div>
          </div>

          {/* Nút đóng góc phải (Luôn nổi trên cùng, không bị che) */}
          <button
            onClick={onClose}
            className="p-2 text-white/90 hover:text-white hover:bg-white/20 rounded-full transition-all relative z-30 hover:scale-110 active:scale-95 shadow-2xs"
            title={totalTaskCount === 0 ? `Đóng (Tự động đóng sau ${countdown}s)` : "Đóng cửa sổ"}
          >
            <X size={22} />
          </button>
        </div>

        {/* Khối Avatar & Ngày tháng đè nhẹ lên viền Banner */}
        <div className="px-6 -mt-9 relative z-20 flex justify-between items-end shrink-0">
          <div className="relative">
            <div className="w-18 h-18 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 border-4 border-white shadow-xl flex items-center justify-center text-white font-black text-2xl tracking-wider uppercase ring-2 ring-blue-500/20">
              {user.name ? user.name.charAt(0) : 'U'}
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-5 w-5 bg-emerald-500 border-2 border-white"></span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-100/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200/80 shadow-sm shrink-0">
            <Calendar size={14} className="text-blue-600 shrink-0" />
            <span className="capitalize">{todayDisplayStr}</span>
          </div>
        </div>

        {/* Tên cán bộ & Tài khoản (Nằm hoàn toàn ở nền trắng phía dưới banner, KHÔNG BAO GIỜ BỊ CHE!) */}
        <div className="px-6 pt-2 pb-1 shrink-0">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>{user.name}</span>
            <Sparkles className="text-amber-500 shrink-0 animate-pulse" size={20} />
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Tài khoản hệ thống: <span className="font-bold text-slate-700">@{user.username}</span>
          </p>
        </div>

        {/* Nội dung chính bên trong Modal (Cho phép cuộn mượt nếu màn hình nhỏ) */}
        <div className="p-6 pt-3 space-y-4 overflow-y-auto custom-scrollbar flex-1">

          {/* ĐẦY ĐỦ CÁC NỘI DUNG CHÀO MỪNG (Tổ / Chức vụ & Lời chúc công việc) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            
            {/* Khối Tổ / Bộ phận */}
            <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="p-2.5 bg-blue-100/80 text-blue-700 rounded-xl shrink-0">
                <Building2 size={20} />
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

            {/* Khối Chức vụ */}
            <div className="flex items-center gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <div className="p-2.5 bg-indigo-100/80 text-indigo-700 rounded-xl shrink-0">
                <Award size={20} />
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

            {/* Khối Lời chúc ngày làm việc */}
            <div className="flex items-center gap-3 bg-gradient-to-r from-blue-50 via-indigo-50 to-sky-50 p-3.5 rounded-2xl border border-blue-200/70 shadow-2xs">
              <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/30 shrink-0">
                <HeartHandshake size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 block">
                  Lời chúc ngày làm việc
                </span>
                <p className="text-xs font-medium text-slate-700 leading-snug line-clamp-2" title={theme.wishingText}>
                  {theme.wishingText}
                </p>
              </div>
            </div>

          </div>

          {/* TRƯỜNG HỢP CÓ CÔNG VIỆC: BẢNG TỔNG HỢP NHẮC VIỆC CÁ NHÂN RỘNG RÃI */}
          {totalTaskCount > 0 ? (
            <div className="space-y-4 pt-1 border-t border-slate-100">
              
              {/* Header thông báo có việc */}
              <div className="p-4 bg-gradient-to-r from-amber-50 via-rose-50 to-orange-50 rounded-2xl border border-amber-200/90 shadow-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-rose-500 text-white rounded-xl shadow-md shadow-rose-500/25 animate-pulse shrink-0">
                    <ShieldAlert size={22} />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                      BẢNG TỔNG HỢP NHẮC VIỆC CÁ NHÂN HÔM NAY
                      <span className="px-2.5 py-0.5 bg-rose-600 text-white text-xs font-black rounded-full shadow-xs">
                        {totalTaskCount} nội dung cần chú ý
                      </span>
                    </h4>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">
                      Hệ thống đã tự động lọc các công việc cần ưu tiên xử lý của bạn trong ngày.
                    </p>
                  </div>
                </div>

                <span className="text-xs font-bold text-rose-700 bg-rose-100 px-3 py-1.5 rounded-full border border-rose-300 shrink-0 hidden md:inline-block">
                  ⚠️ Yêu cầu đóng thủ công
                </span>
              </div>

              {/* Thanh Tab Chuyển đổi danh mục */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200/80">
                {dueTodayRecords.length > 0 && (
                  <button
                    onClick={() => setActiveTab('due_today')}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                      activeTab === 'due_today' 
                        ? 'bg-rose-600 text-white shadow-md shadow-rose-500/30 ring-2 ring-rose-400/30' 
                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                    }`}
                  >
                    <AlertTriangle size={15} />
                    <span>Tới hạn hôm nay</span>
                    <span className={`px-2 py-0.2 rounded-full text-[11px] font-black ${activeTab === 'due_today' ? 'bg-white/20 text-white' : 'bg-rose-200 text-rose-800'}`}>
                      {dueTodayRecords.length}
                    </span>
                  </button>
                )}

                {upcomingDueRecords.length > 0 && (
                  <button
                    onClick={() => setActiveTab('upcoming')}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                      activeTab === 'upcoming' 
                        ? 'bg-amber-600 text-white shadow-md shadow-amber-500/30 ring-2 ring-amber-400/30' 
                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                    }`}
                  >
                    <Clock size={15} />
                    <span>Sắp tới hạn (1-2 ngày)</span>
                    <span className={`px-2 py-0.2 rounded-full text-[11px] font-black ${activeTab === 'upcoming' ? 'bg-white/20 text-white' : 'bg-amber-200 text-amber-800'}`}>
                      {upcomingDueRecords.length}
                    </span>
                  </button>
                )}

                {extensionRecords.length > 0 && (
                  <button
                    onClick={() => setActiveTab('extended')}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                      activeTab === 'extended' 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-400/30' 
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                    }`}
                  >
                    <CalendarDays size={15} />
                    <span>Gia hạn trả (Hôm nay & 3 ngày)</span>
                    <span className={`px-2 py-0.2 rounded-full text-[11px] font-black ${activeTab === 'extended' ? 'bg-white/20 text-white' : 'bg-blue-200 text-blue-800'}`}>
                      {extensionRecords.length}
                    </span>
                  </button>
                )}

                {todayWorkSchedules.length > 0 && (
                  <button
                    onClick={() => setActiveTab('work_schedule')}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                      activeTab === 'work_schedule' 
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/30 ring-2 ring-emerald-400/30' 
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                    }`}
                  >
                    <Car size={15} />
                    <span>Lịch công tác hôm nay</span>
                    <span className={`px-2 py-0.2 rounded-full text-[11px] font-black ${activeTab === 'work_schedule' ? 'bg-white/20 text-white' : 'bg-emerald-200 text-emerald-800'}`}>
                      {todayWorkSchedules.length}
                    </span>
                  </button>
                )}

                {todayDeviceSchedules.length > 0 && (
                  <button
                    onClick={() => setActiveTab('device_schedule')}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                      activeTab === 'device_schedule' 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30 ring-2 ring-indigo-400/30' 
                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                    }`}
                  >
                    <Ruler size={15} />
                    <span>Lịch máy đo</span>
                    <span className={`px-2 py-0.2 rounded-full text-[11px] font-black ${activeTab === 'device_schedule' ? 'bg-white/20 text-white' : 'bg-indigo-200 text-indigo-800'}`}>
                      {todayDeviceSchedules.length}
                    </span>
                  </button>
                )}
              </div>

              {/* Khối danh sách nội dung công việc theo Tab (Độ cao rộng rãi max-h-72) */}
              <div className="max-h-72 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
                
                {/* 1. Hồ sơ tới hạn hôm nay */}
                {activeTab === 'due_today' && (
                  dueTodayRecords.map(r => (
                    <div key={r.id} className="p-3.5 bg-rose-50/80 hover:bg-rose-100/80 rounded-2xl border border-rose-200/90 shadow-2xs transition-all flex justify-between items-center gap-3 group">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-rose-900 bg-white px-2.5 py-0.5 rounded-lg border border-rose-300 shadow-2xs font-mono">
                            {r.code}
                          </span>
                          <span className="text-sm font-extrabold text-slate-800 truncate">
                            {r.customerName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 truncate">
                          {r.ward || 'Chưa phân xã'} {r.landPlot ? `• Thửa ${r.landPlot}` : ''} {r.mapSheet ? `• Tờ ${r.mapSheet}` : ''} {r.content ? `• Nội dung: ${r.content}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-xs font-bold text-rose-700 bg-rose-100/90 px-3 py-1 rounded-xl border border-rose-200">
                          Hạn: Hôm nay ({formatDisplayDate(r.deadline)})
                        </span>
                        {onSelectRecord && (
                          <button
                            onClick={() => handleRecordClick(r)}
                            className="p-2 text-rose-700 hover:text-white hover:bg-rose-600 rounded-xl transition-all shadow-2xs group-hover:scale-105 flex items-center gap-1 text-xs font-bold"
                            title="Xem hồ sơ"
                          >
                            <span>Xem</span>
                            <ChevronRight size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {/* 2. Hồ sơ sắp tới hạn (1 - 2 ngày tới) */}
                {activeTab === 'upcoming' && (
                  upcomingDueRecords.map(r => (
                    <div key={r.id} className="p-3.5 bg-amber-50/80 hover:bg-amber-100/80 rounded-2xl border border-amber-200/90 shadow-2xs transition-all flex justify-between items-center gap-3 group">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-amber-900 bg-white px-2.5 py-0.5 rounded-lg border border-amber-300 shadow-2xs font-mono">
                            {r.code}
                          </span>
                          <span className="text-sm font-extrabold text-slate-800 truncate">
                            {r.customerName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 truncate">
                          {r.ward || 'Chưa phân xã'} {r.landPlot ? `• Thửa ${r.landPlot}` : ''} {r.mapSheet ? `• Tờ ${r.mapSheet}` : ''} {r.content ? `• Nội dung: ${r.content}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-xs font-bold text-amber-800 bg-amber-100/90 px-3 py-1 rounded-xl border border-amber-200">
                          Hạn trả: {formatDisplayDate(r.deadline)}
                        </span>
                        {onSelectRecord && (
                          <button
                            onClick={() => handleRecordClick(r)}
                            className="p-2 text-amber-700 hover:text-white hover:bg-amber-600 rounded-xl transition-all shadow-2xs group-hover:scale-105 flex items-center gap-1 text-xs font-bold"
                            title="Xem hồ sơ"
                          >
                            <span>Xem</span>
                            <ChevronRight size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {/* 3. Hồ sơ có gia hạn trả */}
                {activeTab === 'extended' && (
                  extensionRecords.map(r => (
                    <div key={r.id} className="p-3.5 bg-blue-50/80 hover:bg-blue-100/80 rounded-2xl border border-blue-200/90 shadow-2xs transition-all flex justify-between items-center gap-3 group">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-blue-900 bg-white px-2.5 py-0.5 rounded-lg border border-blue-300 shadow-2xs font-mono">
                            {r.code}
                          </span>
                          <span className="text-sm font-extrabold text-slate-800 truncate">
                            {r.customerName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 truncate">
                          {r.ward || 'Chưa phân xã'} {r.landPlot ? `• Thửa ${r.landPlot}` : ''} {r.mapSheet ? `• Tờ ${r.mapSheet}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-xs font-bold text-blue-800 bg-blue-100/90 px-3 py-1 rounded-xl border border-blue-200">
                          Gia hạn đến: {formatDisplayDate(r.extendedDeadline)}
                        </span>
                        {onSelectRecord && (
                          <button
                            onClick={() => handleRecordClick(r)}
                            className="p-2 text-blue-700 hover:text-white hover:bg-blue-600 rounded-xl transition-all shadow-2xs group-hover:scale-105 flex items-center gap-1 text-xs font-bold"
                            title="Xem hồ sơ"
                          >
                            <span>Xem</span>
                            <ChevronRight size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {/* 4. Lịch công tác */}
                {activeTab === 'work_schedule' && (
                  todayWorkSchedules.map(s => (
                    <div key={s.id} className="p-3.5 bg-emerald-50/80 hover:bg-emerald-100/80 rounded-2xl border border-emerald-200/90 shadow-2xs transition-all space-y-1.5">
                      <div className="flex justify-between items-start gap-2">
                        <h5 className="font-extrabold text-sm text-emerald-950 flex items-center gap-2">
                          <Car size={18} className="text-emerald-600 shrink-0" />
                          <span>{s.content || 'Lịch công tác trong ngày'}</span>
                        </h5>
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 shrink-0">
                          {s.location || 'Địa bàn công tác'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold text-slate-700">Người thực hiện:</span> {s.executors} {s.partner ? `• Đơn vị phối hợp: ${s.partner}` : ''}
                      </p>
                    </div>
                  ))
                )}

                {/* 5. Lịch máy đo */}
                {activeTab === 'device_schedule' && (
                  todayDeviceSchedules.map(s => (
                    <div key={s.id} className="p-3.5 bg-indigo-50/80 hover:bg-indigo-100/80 rounded-2xl border border-indigo-200/90 shadow-2xs transition-all flex justify-between items-center gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs text-indigo-900 bg-indigo-200/80 px-2.5 py-0.5 rounded-lg border border-indigo-300">
                            Buổi {s.session}
                          </span>
                          <span className="text-sm font-bold text-slate-800">
                            {s.device_name || 'Thiết bị đo đạc'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 truncate">
                          {s.note ? `Ghi chú: ${s.note}` : 'Đăng ký sử dụng máy đo đạc ngoài thực địa'}
                        </p>
                      </div>

                      <span className="text-xs font-bold text-indigo-800 bg-indigo-100/90 px-3 py-1 rounded-xl border border-indigo-200 shrink-0">
                        Cán bộ: {s.executors}
                      </span>
                    </div>
                  ))
                )}

              </div>

              {/* Nút Khóa xác nhận & Đóng thủ công */}
              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:via-indigo-700 hover:to-sky-700 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-indigo-500/25 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 group"
                >
                  <CheckCircle2 size={20} className="group-hover:scale-110 transition-transform" />
                  <span>Đã hiểu & Bắt đầu làm việc ngay</span>
                </button>
              </div>

            </div>
          ) : (
            
            /* TRƯỜNG HỢP KHÔNG CÓ CÔNG VIỆC: THÔNG BÁO THỎA MÁI & TỰ TẮT SAU 10S */
            <div className="space-y-4 pt-1 border-t border-slate-100">
              
              {/* Thông báo không có hồ sơ quá hạn */}
              <div className="bg-emerald-50/90 rounded-2xl p-4 border border-emerald-200/90 flex items-center gap-3.5 shadow-2xs">
                <div className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-xs shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <p className="text-xs font-bold text-emerald-950 leading-relaxed">
                  Hôm nay bạn không có hồ sơ quá hạn, hồ sơ gia hạn hay lịch công tác đột xuất cần xử lý khẩn cấp. Chúc bạn một ngày làm việc thật vui vẻ và hanh thông!
                </p>
              </div>

              {/* Nút hành động chính + Đếm ngược tự đóng */}
              <div className="pt-2 space-y-2.5">
                <button
                  onClick={onClose}
                  className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-700 hover:via-indigo-700 hover:to-sky-700 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-indigo-500/25 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 group"
                >
                  <Check size={20} className="group-hover:scale-125 transition-transform" />
                  <span>Bắt đầu làm việc ngay</span>
                </button>

                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 font-medium pt-1">
                  <Clock size={14} className="text-slate-400 animate-spin-slow" />
                  <span>Cửa sổ sẽ tự động đóng sau <strong className="text-blue-600 font-bold text-sm">{countdown}s</strong></span>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
