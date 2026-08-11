import { ThemeConfig } from '../types';

export const DEFAULT_THEME_ID = 'THEME_DEFAULT_OFFICE';

export const BUILT_IN_THEMES: ThemeConfig[] = [
  {
    id: 'THEME_DEFAULT_OFFICE',
    code: 'DEFAULT_OFFICE',
    name: 'Mặc định Hành chính (Chuẩn Đơn vị)',
    description: 'Giao diện Xanh dương công sở trang nhã, đúng chuẩn nhận diện ngành.',
    isSystemDefault: true,
    priority: 0,
    schedule: {
      enabled: true,
      calendarType: 'SOLAR',
      startMonth: 1,
      startDay: 1,
      endMonth: 12,
      endDay: 31,
      yearSpecific: null
    },
    colors: {
      primary: '#1e40af',        // blue-800
      primaryHover: '#1d4ed8',   // blue-700
      headerBg: '#1e3a8a',       // blue-900
      headerText: '#ffffff',
      sidebarBg: '#0f172a',      // slate-900
      sidebarText: '#f8fafc',
      accent: '#2563eb',         // blue-600
      background: '#f8fafc',
      cardBg: '#ffffff',
      textColor: '#0f172a',
      borderRadius: 'md'
    },
    branding: {
      showEventBadge: false,
      greetingText: 'Hệ thống Quản lý Hồ sơ Administrative',
    },
    effect: {
      type: 'NONE',
      intensity: 'STANDARD',
      disableOnMobile: true
    }
  },
  {
    id: 'THEME_TET_LUNAR_NEW_YEAR',
    code: 'TET_AM_LICH',
    name: 'Mừng Xuân Tết Nguyên Đán',
    description: 'Rực rỡ sắc Xuân với tone Đỏ Tết & Vàng Hoàng Kim, câu chúc Mừng Năm Mới và hoa đào/mai rơi nhẹ.',
    priority: 50,
    schedule: {
      enabled: true,
      calendarType: 'LUNAR',
      startMonth: 12,
      startDay: 20, // Từ 20 Tháng Chạp
      endMonth: 1,
      endDay: 10,   // Đến mùng 10 Tết
      yearSpecific: null
    },
    colors: {
      primary: '#b91c1c',        // red-700
      primaryHover: '#991b1b',   // red-800
      headerBg: '#991b1b',       // Đỏ cờ
      headerText: '#fef08a',     // Vàng nhạt
      sidebarBg: '#450a0a',      // Đỏ thẫm
      sidebarText: '#fef08a',
      accent: '#eab308',         // Vàng may mắn
      background: '#fffbf5',
      cardBg: '#ffffff',
      textColor: '#450a0a',
      borderRadius: 'md'
    },
    branding: {
      showEventBadge: true,      eventBadgeText: '🌸 Mừng Xuân Ất Tỵ 2025',
      greetingText: '🧧 Kính chúc Quý khách & Cán bộ Năm Mới An Khang Thịnh Vượng!',
    },
    effect: {
      type: 'PEACH_BLOSSOM',
      intensity: 'MINIMAL_OFFICE',
      disableOnMobile: true
    }
  },
  {
    id: 'THEME_NATIONAL_DAY_2_9',
    code: 'QUOC_KHANH_2_9',
    name: 'Mừng Lễ Quốc Khánh 2/9 & 30/4',
    description: 'Trang trọng sắc đỏ cờ sao vàng, chào mừng các ngày lễ lớn của Đất nước.',
    priority: 80,
    schedule: {
      enabled: true,
      calendarType: 'SOLAR',
      startMonth: 8,
      startDay: 28,
      endMonth: 9,
      endDay: 5,
      yearSpecific: null
    },
    colors: {
      primary: '#dc2626',        // red-600
      primaryHover: '#b91c1c',
      headerBg: '#991b1b',
      headerText: '#fef08a',
      sidebarBg: '#1f2937',
      sidebarText: '#ffffff',
      accent: '#eab308',
      background: '#fef2f2',
      cardBg: '#ffffff',
      textColor: '#111827',
      borderRadius: 'md'
    },
    branding: {
      showEventBadge: true,
      eventBadgeText: '🇻🇳 Nhiệt liệt Chào mừng Ngày Quốc Khánh 2/9!',
      greetingText: '🇻🇳 Nước Cộng Hòa Xã Hội Chủ Nghĩa Việt Nam Muôn Năm!',
    },
    effect: {
      type: 'RED_FLAGS',
      intensity: 'MINIMAL_OFFICE',
      disableOnMobile: true
    }
  },
  {
    id: 'THEME_CHRISTMAS_NEW_YEAR',
    code: 'GIANG_SINH_NAM_MOI',
    name: 'Giáng Sinh & Chào Năm Mới (Dương Lịch)',
    description: 'Tone Xanh thông & Đỏ rượu ấm áp, không khí lễ hội Giáng Sinh & New Year.',
    priority: 40,
    schedule: {
      enabled: true,
      calendarType: 'SOLAR',
      startMonth: 12,
      startDay: 20,
      endMonth: 1,
      endDay: 3,
      yearSpecific: null
    },
    colors: {
      primary: '#15803d',        // green-700
      primaryHover: '#166534',
      headerBg: '#14532d',       // Xanh thông
      headerText: '#ffffff',
      sidebarBg: '#052e16',
      sidebarText: '#f0fdf4',
      accent: '#dc2626',         // Đỏ Noel
      background: '#f0fdf4',
      cardBg: '#ffffff',
      textColor: '#0f172a',
      borderRadius: 'md'
    },
    branding: {
      showEventBadge: true,
      eventBadgeText: '🎄 Merry Christmas & Happy New Year!',
      greetingText: '🎄 Chúc Quý vị một Mùa Giáng Sinh An Lành & Năm Mới An Khang!',
    },
    effect: {
      type: 'SNOW',
      intensity: 'MINIMAL_OFFICE',
      disableOnMobile: true
    }
  },
  {
    id: 'THEME_MID_AUTUMN',
    code: 'TET_TRUNG_THU',
    name: 'Mừng Tết Trung Thu (15/8 Âm lịch)',
    description: 'Tone Vàng Cam ấm áp, lồng đèn rực rỡ chào đón Tết Trung Thu.',
    priority: 45,
    schedule: {
      enabled: true,
      calendarType: 'LUNAR',
      startMonth: 8,
      startDay: 10,
      endMonth: 8,
      endDay: 18,
      yearSpecific: null
    },
    colors: {
      primary: '#c2410c',        // orange-700
      primaryHover: '#9a3412',
      headerBg: '#7c2d12',
      headerText: '#ffedd5',
      sidebarBg: '#1c1917',
      sidebarText: '#ffedd5',
      accent: '#f59e0b',
      background: '#fff7ed',
      cardBg: '#ffffff',
      textColor: '#1c1917',
      borderRadius: 'md'
    },
    branding: {
      showEventBadge: true,
      eventBadgeText: '🌕 Tết Trung Thu Đoàn Viên',
      greetingText: '🥮 Chúc Quý vị & Gia đình Tết Trung Thu Ấm Áp, Tròn Đầy!',
    },
    effect: {
      type: 'LANTERNS',
      intensity: 'MINIMAL_OFFICE',
      disableOnMobile: true
    }
  }
];
