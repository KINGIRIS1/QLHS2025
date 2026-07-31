import { User, UserRole } from '../types';
import { CACHE_KEYS, getFromCache, saveToCache } from '../services/apiCore';
import { supabase, isConfigured } from '../services/supabaseClient';

export interface PermissionDefinition {
  key: string;
  label: string;
  category: string;
  categoryLabel: string;
  description?: string;
  defaultRoles: UserRole[];
}

// 1. ALL SYSTEM PERMISSION DEFINITIONS
export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // --- TỔNG QUAN & BÁO CÁO ---
  {
    key: 'dashboard.view',
    label: 'Xem Trang Tổng quan & Nhắc nhở',
    category: 'dashboard_reports',
    categoryLabel: 'Trang chủ & Báo cáo',
    description: 'Cho phép truy cập màn hình Dashboard thống kê chung',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.ONEDOOR]
  },
  {
    key: 'reports.view',
    label: 'Xem Báo cáo & Thống kê chi tiết',
    category: 'dashboard_reports',
    categoryLabel: 'Trang chủ & Báo cáo',
    description: 'Cho phép truy cập mục Báo cáo theo ngày, tuần, tháng, nhân viên, xã phường',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER]
  },
  {
    key: 'reports.export',
    label: 'Xuất Báo cáo Excel',
    category: 'dashboard_reports',
    categoryLabel: 'Trang chủ & Báo cáo',
    description: 'Cho phép tải xuất dữ liệu báo cáo thống kê ra file Excel',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER]
  },
  {
    key: 'reports.ai',
    label: 'Sử dụng Trợ lý AI Phân tích Báo cáo',
    category: 'dashboard_reports',
    categoryLabel: 'Trang chủ & Báo cáo',
    description: 'Sử dụng AI tổng hợp và phân tích dữ liệu xử lý hồ sơ',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER]
  },

  // --- TIẾP NHẬN HỒ SƠ ---
  {
    key: 'receive_record.create',
    label: 'Tiếp nhận Hồ sơ 1 Cửa mới',
    category: 'receive',
    categoryLabel: 'Bộ phận Tiếp nhận',
    description: 'Tạo phiếu tiếp nhận hồ sơ mới từ bộ phận 1 cửa',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.ONEDOOR]
  },
  {
    key: 'receive_contract.create',
    label: 'Tiếp nhận Hợp đồng Dịch vụ',
    category: 'receive',
    categoryLabel: 'Bộ phận Tiếp nhận',
    description: 'Tạo mới hợp đồng dịch vụ đo đạc / cắm mốc / trích lục',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.ONEDOOR]
  },

  // --- QUẢN LÝ HỒ SƠ ĐO ĐẠC & ĐĂNG KÝ ---
  {
    key: 'records.view',
    label: 'Xem Danh sách Hồ sơ Đo đạc',
    category: 'records',
    categoryLabel: 'Quản lý Hồ sơ',
    description: 'Xem màn hình danh sách hồ sơ đo đạc',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.ONEDOOR]
  },
  {
    key: 'records.create',
    label: 'Thêm Hồ sơ mới',
    category: 'records',
    categoryLabel: 'Quản lý Hồ sơ',
    description: 'Cho phép nhập tạo hồ sơ thủ công',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.ONEDOOR]
  },
  {
    key: 'records.edit',
    label: 'Chỉnh sửa Thông tin Hồ sơ',
    category: 'records',
    categoryLabel: 'Quản lý Hồ sơ',
    description: 'Sửa các trường thông tin của hồ sơ đã tiếp nhận',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER]
  },
  {
    key: 'records.delete',
    label: 'Xóa Hồ sơ',
    category: 'records',
    categoryLabel: 'Quản lý Hồ sơ',
    description: 'Cho phép xóa hồ sơ khỏi hệ thống',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN]
  },
  {
    key: 'records.assign',
    label: 'Phân công / Giao xử lý cho Nhân viên',
    category: 'records',
    categoryLabel: 'Quản lý Hồ sơ',
    description: 'Giao hồ sơ cho nhân viên phụ trách địa bàn / chuyên môn',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER]
  },
  {
    key: 'records.complete_work',
    label: 'Chuyển trạng thái "Đã thực hiện"',
    category: 'records',
    categoryLabel: 'Quản lý Hồ sơ',
    description: 'Cán bộ đo đạc cập nhật đã đo vẽ xong chờ trình ký',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE]
  },
  {
    key: 'records.submit_sign',
    label: 'Trình ký duyệt Hồ sơ',
    category: 'records',
    categoryLabel: 'Quản lý Hồ sơ',
    description: 'Chuyển hồ sơ vào danh sách chờ lãnh đạo ký',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE]
  },
  {
    key: 'records.sign',
    label: 'Lập Danh sách Ký duyệt',
    category: 'records',
    categoryLabel: 'Quản lý Hồ sơ',
    description: 'Duyệt ký hồ sơ và cập nhật trạng thái Đã ký',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER]
  },
  {
    key: 'records.handover',
    label: 'Lập Danh sách Giao 1 Cửa',
    category: 'records',
    categoryLabel: 'Quản lý Hồ sơ',
    description: 'Xuất đợt bàn giao kết quả về Bộ phận 1 cửa',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.ONEDOOR]
  },
  {
    key: 'records.return_result',
    label: 'Cập nhật Trả kết quả cho Dân',
    category: 'records',
    categoryLabel: 'Quản lý Hồ sơ',
    description: 'Ghi nhận số biên lai, ngày giờ dân tới nhận kết quả',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.ONEDOOR]
  },
  {
    key: 'records.withdraw',
    label: 'Rút / Hủy Hồ sơ',
    category: 'records',
    categoryLabel: 'Quản lý Hồ sơ',
    description: 'Ghi nhận người dân rút hồ sơ',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER]
  },
  {
    key: 'records.forward',
    label: 'Chuyển tiếp Hồ sơ liên phòng',
    category: 'records',
    categoryLabel: 'Quản lý Hồ sơ',
    description: 'Luân chuyển hồ sơ sang bộ phận khác xử lý',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE]
  },
  {
    key: 'records.map_correction',
    label: 'Lập Danh sách Chỉnh lý Bản đồ',
    category: 'records',
    categoryLabel: 'Quản lý Hồ sơ',
    description: 'Đánh dấu và lập danh sách hồ sơ cần chỉnh lý bản đồ địa chính',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE]
  },
  {
    key: 'records.export_excel',
    label: 'Xuất Excel Danh sách Hồ sơ',
    category: 'records',
    categoryLabel: 'Quản lý Hồ sơ',
    description: 'Tải dữ liệu danh sách hồ sơ ra file Excel',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.ONEDOOR]
  },
  {
    key: 'records.import_excel',
    label: 'Nhập Hồ sơ từ File Excel',
    category: 'records',
    categoryLabel: 'Quản lý Hồ sơ',
    description: 'Import hàng loạt hồ sơ từ tệp Excel',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN]
  },
  {
    key: 'records.print',
    label: 'In Phiếu biên nhận / Phiếu chuyển / Biểu mẫu',
    category: 'records',
    categoryLabel: 'Quản lý Hồ sơ',
    description: 'In phiếu biên nhận, danh sách bàn giao và biểu mẫu nghiệp vụ',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.ONEDOOR]
  },

  // --- HỒ SƠ KHÁC & HỢP ĐỒNG ---
  {
    key: 'other_records.view',
    label: 'Xem Hồ sơ Dịch vụ / Khác',
    category: 'other_records',
    categoryLabel: 'Hồ sơ Khác & Hợp đồng',
    description: 'Xem các hồ sơ dịch vụ đo đạc tòa án, cắm mốc, tài sản...',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE]
  },
  {
    key: 'other_records.manage',
    label: 'Thêm / Sửa / Xóa Hồ sơ Khác',
    category: 'other_records',
    categoryLabel: 'Hồ sơ Khác & Hợp đồng',
    description: 'Quản lý các hồ sơ dịch vụ khác',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER]
  },
  {
    key: 'contracts.manage',
    label: 'Quản lý Hợp đồng & Thanh lý',
    category: 'other_records',
    categoryLabel: 'Hồ sơ Khác & Hợp đồng',
    description: 'Tạo, sửa, tính tiền thuế VAT, tiền cọc và thanh lý hợp đồng',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.ONEDOOR]
  },

  // --- TRÍCH LỤC & KHO LƯU TRỮ ---
  {
    key: 'excerpt.view',
    label: 'Xem Sổ Trích lục / Trích đo',
    category: 'excerpt_archive',
    categoryLabel: 'Trích lục & Lưu trữ',
    description: 'Tra cứu sổ cấp số trích lục và trích đo địa chính',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE]
  },
  {
    key: 'excerpt.manage',
    label: 'Cấp số & Quản lý Sổ Trích lục',
    category: 'excerpt_archive',
    categoryLabel: 'Trích lục & Lưu trữ',
    description: 'Cho phép cấp số, sửa số trích lục / trích đo',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER]
  },
  {
    key: 'archive.view',
    label: 'Xem Danh mục Hồ sơ Lưu trữ',
    category: 'excerpt_archive',
    categoryLabel: 'Trích lục & Lưu trữ',
    description: 'Tra cứu hồ sơ lưu trữ sao lục, vào sổ, công văn',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE]
  },
  {
    key: 'archive.manage',
    label: 'Quản lý & Thêm mới Hồ sơ Lưu trữ',
    category: 'excerpt_archive',
    categoryLabel: 'Trích lục & Lưu trữ',
    description: 'Thêm, sửa, chuyển kho hồ sơ lưu trữ',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER]
  },
  {
    key: 'warehouse.view',
    label: 'Tra cứu Kho Bản đồ & Dữ liệu đất',
    category: 'excerpt_archive',
    categoryLabel: 'Trích lục & Lưu trữ',
    description: 'Xem kho dữ liệu thông tin đất đai, bản đồ địa chính',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE]
  },

  // --- CÔNG CỤ & NHẬT KÝ ---
  {
    key: 'blocking.manage',
    label: 'Quản lý Danh sách Ngăn chặn',
    category: 'tools_schedule',
    categoryLabel: 'Công cụ & Lịch trình',
    description: 'Tra cứu và thêm mới văn bản ngăn chặn giao dịch đất đai',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER]
  },
  {
    key: 'work_schedule.view',
    label: 'Xem Lịch công tác',
    category: 'tools_schedule',
    categoryLabel: 'Công cụ & Lịch trình',
    description: 'Xem lịch đi công tác ngoại hiện của đơn vị',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE]
  },
  {
    key: 'work_schedule.manage',
    label: 'Đăng ký & Cập nhật Lịch công tác',
    category: 'tools_schedule',
    categoryLabel: 'Công cụ & Lịch trình',
    description: 'Đăng ký địa bàn, nội dung và phối hợp đi công tác',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE]
  },
  {
    key: 'device_schedule.manage',
    label: 'Đăng ký Máy đo & Thiết bị',
    category: 'tools_schedule',
    categoryLabel: 'Công cụ & Lịch trình',
    description: 'Đăng ký lịch sử dụng máy kinh vĩ, máy GPS, thiết bị đo đạc',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE]
  },
  {
    key: 'measurement_logs.view',
    label: 'Xem File & Nhật ký Đo đạc',
    category: 'tools_schedule',
    categoryLabel: 'Công cụ & Lịch trình',
    description: 'Xem danh sách tệp đo vẽ, tọa độ đã được gửi lên hệ thống',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE]
  },
  {
    key: 'measurement_logs.upload',
    label: 'Gửi File Đo đạc & Tọa độ',
    category: 'tools_schedule',
    categoryLabel: 'Công cụ & Lịch trình',
    description: 'Tải tệp bản vẽ đo đạc, số liệu máy đo lên kho lưu trữ',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE]
  },
  {
    key: 'chat.use',
    label: 'Sử dụng Chat nội bộ & Trao đổi',
    category: 'tools_schedule',
    categoryLabel: 'Công cụ & Lịch trình',
    description: 'Nhắn tin, tạo nhóm chat trao đổi nghiệp vụ',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.ONEDOOR]
  },
  {
    key: 'utilities.view',
    label: 'Tra cứu Tiện ích & Bảng giá Dịch vụ',
    category: 'tools_schedule',
    categoryLabel: 'Công cụ & Lịch trình',
    description: 'Tra cứu bảng giá dịch vụ, tính tiền đo đạc, tra cứu mã',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.ONEDOOR]
  },

  // --- QUẢN TRỊ HỆ THỐNG ---
  {
    key: 'users.manage',
    label: 'Quản lý Tài khoản Đăng nhập',
    category: 'system',
    categoryLabel: 'Quản trị Hệ thống',
    description: 'Thêm, sửa, đổi mật khẩu, xóa tài khoản người dùng',
    defaultRoles: [UserRole.ADMIN]
  },
  {
    key: 'employees.manage',
    label: 'Quản lý Danh sách Cán bộ / Nhân sự',
    category: 'system',
    categoryLabel: 'Quản trị Hệ thống',
    description: 'Quản lý danh sách cán bộ, chức vụ, tổ công tác và địa bàn quản lý',
    defaultRoles: [UserRole.ADMIN, UserRole.SUBADMIN]
  },
  {
    key: 'permissions.manage',
    label: 'Cấu hình Phân quyền động',
    category: 'system',
    categoryLabel: 'Quản trị Hệ thống',
    description: 'Cấu hình quyền chi tiết theo vai trò, tổ công tác và từng người dùng',
    defaultRoles: [UserRole.ADMIN]
  },
  {
    key: 'system_settings.manage',
    label: 'Cấu hình Hệ thống & Sao lưu Dữ liệu',
    category: 'system',
    categoryLabel: 'Quản trị Hệ thống',
    description: 'Cấu hình chung, ngày nghỉ lễ, sao lưu và khôi phục cơ sở dữ liệu',
    defaultRoles: [UserRole.ADMIN]
  }
];

// 2. GENERATE DEFAULT ROLE PERMISSIONS MAP
export const getDefaultRolePermissions = (): Record<UserRole, string[]> => {
  const result: Record<UserRole, string[]> = {
    [UserRole.ADMIN]: PERMISSION_DEFINITIONS.map(p => p.key),
    [UserRole.SUBADMIN]: PERMISSION_DEFINITIONS.filter(p => p.defaultRoles.includes(UserRole.SUBADMIN)).map(p => p.key),
    [UserRole.TEAM_LEADER]: PERMISSION_DEFINITIONS.filter(p => p.defaultRoles.includes(UserRole.TEAM_LEADER)).map(p => p.key),
    [UserRole.EMPLOYEE]: PERMISSION_DEFINITIONS.filter(p => p.defaultRoles.includes(UserRole.EMPLOYEE)).map(p => p.key),
    [UserRole.ONEDOOR]: PERMISSION_DEFINITIONS.filter(p => p.defaultRoles.includes(UserRole.ONEDOOR)).map(p => p.key),
  };
  return result;
};

// 3. USER OVERRIDE STRUCTURE
export interface UserPermissionOverride {
  username: string;
  department?: string; // Tổ công tác (Tổ Đo đạc, Tổ Đăng ký, Tổ Lưu trữ...)
  grantedPermissions?: string[]; // Quyền được bổ sung riêng
  deniedPermissions?: string[];  // Quyền bị thu hồi riêng
  notes?: string;
  updatedAt?: string;
}

export interface SystemPermissionsState {
  rolePermissions: Record<UserRole, string[]>;
  userOverrides: Record<string, UserPermissionOverride>; // Key: username
  departmentPresets?: Record<string, string[]>; // Key: department name -> list of permission keys
}

// 4. DEPARTMENT PRESETS (Default recommended permissions for specific teams / tổ công tác)
export const DEFAULT_DEPARTMENT_PRESETS: Record<string, string[]> = {
  'Tổ Đo đạc': [
    'dashboard.view', 'records.view', 'records.complete_work', 'records.submit_sign', 
    'records.forward', 'records.map_correction', 'records.export_excel', 'records.print',
    'other_records.view', 'excerpt.view', 'archive.view', 'warehouse.view',
    'work_schedule.view', 'work_schedule.manage', 'device_schedule.manage',
    'measurement_logs.view', 'measurement_logs.upload', 'chat.use', 'utilities.view'
  ],
  'Tổ Đăng ký': [
    'dashboard.view', 'records.view', 'records.edit', 'records.submit_sign',
    'records.export_excel', 'records.print', 'archive.view',
    'work_schedule.view', 'chat.use', 'utilities.view'
  ],
  'Tổ Lưu trữ': [
    'dashboard.view', 'records.view', 'archive.view', 'archive.manage',
    'warehouse.view', 'warehouse.manage', 'excerpt.view', 'excerpt.manage',
    'work_schedule.view', 'chat.use', 'utilities.view'
  ],
  'Bộ phận 1 cửa': [
    'dashboard.view', 'receive_record.create', 'receive_contract.create',
    'records.view', 'records.create', 'records.handover', 'records.return_result',
    'records.print', 'contracts.manage', 'chat.use', 'utilities.view'
  ]
};

// CACHE KEYS FOR PERMISSIONS
const SYSTEM_PERMISSIONS_CACHE_KEY = 'offline_system_permissions_v1';

// 5. FETCH SYSTEM PERMISSIONS FROM SUPABASE OR LOCAL STORAGE
export const fetchSystemPermissions = async (): Promise<SystemPermissionsState> => {
  const defaultState: SystemPermissionsState = {
    rolePermissions: getDefaultRolePermissions(),
    userOverrides: {},
    departmentPresets: DEFAULT_DEPARTMENT_PRESETS
  };

  if (!isConfigured) {
    return getFromCache<SystemPermissionsState>(SYSTEM_PERMISSIONS_CACHE_KEY, defaultState);
  }

  try {
    const { data, error } = await supabase.from('system_config').select('*').eq('key', 'system_permissions').single();
    if (error || !data?.value) {
      // Try local cache
      return getFromCache<SystemPermissionsState>(SYSTEM_PERMISSIONS_CACHE_KEY, defaultState);
    }
    const state: SystemPermissionsState = data.value;
    saveToCache(SYSTEM_PERMISSIONS_CACHE_KEY, state);
    return state;
  } catch (err) {
    console.warn('fetchSystemPermissions error:', err);
    return getFromCache<SystemPermissionsState>(SYSTEM_PERMISSIONS_CACHE_KEY, defaultState);
  }
};

// 6. SAVE SYSTEM PERMISSIONS TO SUPABASE OR LOCAL STORAGE
export const saveSystemPermissionsApi = async (state: SystemPermissionsState): Promise<boolean> => {
  saveToCache(SYSTEM_PERMISSIONS_CACHE_KEY, state);

  if (!isConfigured) return true;

  try {
    const { error } = await supabase.from('system_config').upsert({
      key: 'system_permissions',
      value: state,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

    if (error) {
      console.warn('Supabase upsert system_permissions failed, saved locally:', error);
    }
    return true;
  } catch (err) {
    console.warn('saveSystemPermissionsApi error:', err);
    return true;
  }
};

// 7. CHECK PERMISSION HELPER
export const hasPermission = (
  user: User | null | undefined,
  permissionKey: string,
  userDepartment?: string,
  permissionsState?: SystemPermissionsState | null
): boolean => {
  if (!user) return false;

  // ADMIN always has full access
  if (user.role === UserRole.ADMIN) return true;

  const state = permissionsState || getFromCache<SystemPermissionsState>(SYSTEM_PERMISSIONS_CACHE_KEY, {
    rolePermissions: getDefaultRolePermissions(),
    userOverrides: {},
    departmentPresets: DEFAULT_DEPARTMENT_PRESETS
  });

  const override = state.userOverrides?.[user.username];

  // Check explicit User Denied
  if (override?.deniedPermissions?.includes(permissionKey)) {
    return false;
  }

  // Check explicit User Granted
  if (override?.grantedPermissions?.includes(permissionKey)) {
    return true;
  }

  // Check Role Defaults
  const rolePerms = state.rolePermissions?.[user.role] || getDefaultRolePermissions()[user.role] || [];
  if (rolePerms.includes(permissionKey)) {
    return true;
  }

  // Check Department Presets if provided
  if (userDepartment && state.departmentPresets?.[userDepartment]) {
    if (state.departmentPresets[userDepartment].includes(permissionKey)) {
      return true;
    }
  }

  return false;
};

// 8. GET ALL EFFECTIVE PERMISSIONS FOR A USER
export const getUserEffectivePermissions = (
  user: User,
  userDepartment?: string,
  permissionsState?: SystemPermissionsState | null
): Set<string> => {
  const result = new Set<string>();

  if (user.role === UserRole.ADMIN) {
    PERMISSION_DEFINITIONS.forEach(p => result.add(p.key));
    return result;
  }

  const state = permissionsState || getFromCache<SystemPermissionsState>(SYSTEM_PERMISSIONS_CACHE_KEY, {
    rolePermissions: getDefaultRolePermissions(),
    userOverrides: {},
    departmentPresets: DEFAULT_DEPARTMENT_PRESETS
  });

  // Base role permissions
  const rolePerms = state.rolePermissions?.[user.role] || getDefaultRolePermissions()[user.role] || [];
  rolePerms.forEach(p => result.add(p));

  // Department preset permissions
  if (userDepartment && state.departmentPresets?.[userDepartment]) {
    state.departmentPresets[userDepartment].forEach(p => result.add(p));
  }

  // User overrides
  const override = state.userOverrides?.[user.username];
  if (override?.grantedPermissions) {
    override.grantedPermissions.forEach(p => result.add(p));
  }
  if (override?.deniedPermissions) {
    override.deniedPermissions.forEach(p => result.delete(p));
  }

  return result;
};
