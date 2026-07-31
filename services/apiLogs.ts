import { supabase, isConfigured } from './supabaseClient';
import { AuditLog, AuditActionType, AuditTargetType, User } from '../types';
import { getFromCache, saveToCache } from './apiCore';
import * as XLSX from 'xlsx-js-style';

const CACHE_KEY_LOGS = 'offline_audit_logs';

export interface FieldDiff {
  fieldKey: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
}

export const FIELD_LABEL_MAP: Record<string, string> = {
  // Hồ sơ đất đai / LandRecord
  code: 'Mã hồ sơ',
  customerName: 'Tên khách hàng',
  phone: 'Số điện thoại',
  commune: 'Xã/Phường',
  ward: 'Xã/Phường',
  landAddress: 'Địa chỉ thửa đất',
  address: 'Địa chỉ',
  mapSheetNumber: 'Tờ bản đồ',
  toBando: 'Tờ bản đồ',
  landPlotNumber: 'Thửa đất số',
  soThua: 'Thửa đất số',
  area: 'Diện tích (m²)',
  dientich: 'Diện tích (m²)',
  recordType: 'Loại hồ sơ',
  status: 'Trạng thái',
  assignedTo: 'Cán bộ xử lý',
  assignedDate: 'Ngày phân công',
  receivedDate: 'Ngày tiếp nhận',
  appointmentDate: 'Ngày hẹn trả',
  returnDate: 'Ngày trả thực tế',
  receiptNumber: 'Số biên lai',
  note: 'Ghi chú',
  price: 'Phí dịch vụ',
  paidAmount: 'Số tiền đã trả',
  paymentStatus: 'Thanh toán',
  documentCount: 'Số lượng bộ',
  soBo: 'Số bộ',

  // Nhân sự / Tài khoản
  name: 'Họ và tên',
  username: 'Tên đăng nhập',
  role: 'Vai trò / Quyền',
  department: 'Phòng ban',
  position: 'Chức vụ',
  email: 'Email',
  active: 'Trạng thái',
  employeeId: 'Mã nhân sự',

  // Cấu hình / Hệ thống
  title: 'Tiêu đề',
  key: 'Khóa cấu hình',
  value: 'Giá trị'
};

function formatValForDiff(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'boolean') return val ? 'Bật / Hoạt động' : 'Tắt / Khóa';
  if (typeof val === 'object') {
    if (Array.isArray(val)) return val.length > 0 ? val.map(x => (typeof x === 'object' ? JSON.stringify(x) : x)).join(', ') : '---';
    return JSON.stringify(val);
  }
  return String(val).trim();
}

/**
 * So sánh 2 đối tượng và trả về danh sách các trường đã thay đổi
 */
export function computeFieldDifferences(oldData: any, newData: any): FieldDiff[] {
  if (!oldData && !newData) return [];
  
  const diffs: FieldDiff[] = [];
  const o = oldData || {};
  const n = newData || {};
  
  const keys = new Set([...Object.keys(o), ...Object.keys(n)]);
  const ignoreKeys = new Set(['id', 'created_at', 'updated_at', 'history', 'attached_files', 'unblock_attached_files', 'files']);

  keys.forEach(key => {
    if (ignoreKeys.has(key)) return;

    const valOld = o[key];
    const valNew = n[key];

    const strOld = formatValForDiff(valOld);
    const strNew = formatValForDiff(valNew);

    if (strOld !== strNew) {
      const fieldLabel = FIELD_LABEL_MAP[key] || key;
      diffs.push({
        fieldKey: key,
        fieldLabel,
        oldValue: strOld || '---',
        newValue: strNew || '---'
      });
    }
  });

  return diffs;
}

/**
 * Ghi log thao tác người dùng vào hệ thống
 */
export async function logUserActivity(params: {
  action: AuditActionType;
  targetType: AuditTargetType;
  details: string;
  targetId?: string;
  targetCode?: string;
  user?: User | { id?: string; name?: string; username?: string; role?: string } | null;
  oldData?: any;
  newData?: any;
}): Promise<boolean> {
  try {
    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const createdAt = new Date().toISOString();
    
    const userObj = params.user;
    const userName = userObj?.name || (userObj as any)?.username || 'Hệ thống';
    const userId = (userObj as any)?.employeeId || (userObj as any)?.id || (userObj as any)?.username || 'system';
    const userRole = userObj?.role || 'SYSTEM';

    let finalDetails = params.details;

    // Nếu là thao tác UPDATE và có oldData + newData, tự động bổ sung danh sách thay đổi vào details
    if (params.action === 'UPDATE' && params.oldData && params.newData) {
      const diffs = computeFieldDifferences(params.oldData, params.newData);
      if (diffs.length > 0) {
        const diffText = diffs.map(d => `${d.fieldLabel}: "${d.oldValue}" ➔ "${d.newValue}"`).join('; ');
        if (!finalDetails.includes('Thay đổi:')) {
          finalDetails = `${finalDetails} [Thay đổi: ${diffText}]`;
        }
      }
    }

    const logEntry: AuditLog = {
      id,
      createdAt,
      userId,
      userName,
      userRole,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId || '',
      targetCode: params.targetCode || '',
      details: finalDetails,
      oldData: params.oldData ? JSON.parse(JSON.stringify(params.oldData)) : null,
      newData: params.newData ? JSON.parse(JSON.stringify(params.newData)) : null,
    };

    // 1. Lưu vào Local Cache trước tiên để giao diện cập nhật ngay
    const cachedLogs = getFromCache<AuditLog[]>(CACHE_KEY_LOGS, []);
    const updatedCache = [logEntry, ...cachedLogs].slice(0, 500); // Giữ tối đa 500 log ở cache local
    saveToCache(CACHE_KEY_LOGS, updatedCache);

    // Bắn event để UI cập nhật realtime nếu đang xem trang Log
    window.dispatchEvent(new CustomEvent('audit_log_added', { detail: logEntry }));

    // 2. Đồng bộ lên Supabase nếu có kết nối
    if (isConfigured) {
      const { error } = await supabase.from('audit_logs').insert([{
        id: logEntry.id,
        created_at: logEntry.createdAt,
        user_id: logEntry.userId,
        user_name: logEntry.userName,
        user_role: logEntry.userRole,
        action: logEntry.action,
        target_type: logEntry.targetType,
        target_id: logEntry.targetId,
        target_code: logEntry.targetCode,
        details: logEntry.details,
        old_data: logEntry.oldData,
        new_data: logEntry.newData
      }]);

      if (error) {
        console.warn('Lỗi ghi audit log vào Supabase (đã lưu local):', error.message);
      }
    }

    return true;
  } catch (err) {
    console.error('Lỗi khi ghi vết thao tác (logUserActivity):', err);
    return false;
  }
}

/**
 * Lấy danh sách lịch sử thao tác với các bộ lọc
 */
export async function fetchAuditLogs(filters?: {
  searchTerm?: string;
  action?: string;
  targetType?: string;
  userName?: string;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}): Promise<AuditLog[]> {
  const maxLimit = filters?.limit || 200;
  let logs: AuditLog[] = [];

  if (isConfigured) {
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(maxLimit);

      if (filters?.action && filters.action !== 'ALL') {
        query = query.eq('action', filters.action);
      }
      if (filters?.targetType && filters.targetType !== 'ALL') {
        query = query.eq('target_type', filters.targetType);
      }
      if (filters?.fromDate) {
        query = query.gte('created_at', `${filters.fromDate}T00:00:00`);
      }
      if (filters?.toDate) {
        query = query.lte('created_at', `${filters.toDate}T23:59:59`);
      }

      const { data, error } = await query;
      if (!error && data) {
        logs = data.map((item: any) => ({
          id: item.id,
          createdAt: item.created_at,
          userId: item.user_id,
          userName: item.user_name,
          userRole: item.user_role,
          action: item.action,
          targetType: item.target_type,
          targetId: item.target_id,
          targetCode: item.target_code,
          details: item.details,
          oldData: item.old_data,
          newData: item.new_data,
          ipAddress: item.ip_address
        }));
      } else {
        console.warn('Sử dụng cache log offline do lỗi kết nối Supabase:', error?.message);
        logs = getFromCache<AuditLog[]>(CACHE_KEY_LOGS, []);
      }
    } catch (e) {
      console.error('Lỗi fetch audit logs tu Supabase:', e);
      logs = getFromCache<AuditLog[]>(CACHE_KEY_LOGS, []);
    }
  } else {
    logs = getFromCache<AuditLog[]>(CACHE_KEY_LOGS, []);
  }

  // Lọc nâng cao client-side
  if (filters?.searchTerm && filters.searchTerm.trim() !== '') {
    const term = filters.searchTerm.toLowerCase().trim();
    logs = logs.filter(l => 
      (l.details && l.details.toLowerCase().includes(term)) ||
      (l.userName && l.userName.toLowerCase().includes(term)) ||
      (l.targetCode && l.targetCode.toLowerCase().includes(term)) ||
      (l.action && l.action.toLowerCase().includes(term))
    );
  }

  if (filters?.userName && filters.userName !== 'ALL') {
    logs = logs.filter(l => l.userName === filters.userName);
  }

  return logs;
}

/**
 * Xóa toàn bộ nhật ký thao tác (Chỉ Admin)
 */
export async function clearAuditLogs(): Promise<boolean> {
  saveToCache(CACHE_KEY_LOGS, []);
  if (isConfigured) {
    try {
      const { error } = await supabase.from('audit_logs').delete().neq('id', '');
      if (error) {
        console.error('Lỗi xóa audit logs trên Supabase:', error);
        return false;
      }
    } catch (e) {
      console.error('Lỗi xóa audit logs:', e);
      return false;
    }
  }
  window.dispatchEvent(new CustomEvent('audit_log_added'));
  return true;
}

/**
 * Xuất danh sách nhật ký thao tác ra Excel
 */
export function exportAuditLogsToExcel(logs: AuditLog[]) {
  const rows = logs.map((log, index) => {
    const dateObj = new Date(log.createdAt);
    const timeFormatted = isNaN(dateObj.getTime()) ? log.createdAt : dateObj.toLocaleString('vi-VN');
    return {
      'STT': index + 1,
      'Thời gian': timeFormatted,
      'Người thực hiện': log.userName || 'N/A',
      'Vai trò': log.userRole || 'N/A',
      'Hành động': getActionText(log.action),
      'Đối tượng': getTargetText(log.targetType),
      'Mã hồ sơ/đối tượng': log.targetCode || log.targetId || '',
      'Chi tiết thao tác': log.details
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Lịch sử thao tác");

  const todayStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Lich_su_thao_tac_${todayStr}.xlsx`);
}

export function getActionText(action: AuditActionType): string {
  switch (action) {
    case 'CREATE': return 'Thêm mới';
    case 'UPDATE': return 'Cập nhật';
    case 'DELETE': return 'Xóa';
    case 'LOGIN': return 'Đăng nhập';
    case 'ASSIGN': return 'Phân công';
    case 'EXPORT': return 'Xuất dữ liệu';
    case 'RESTORE': return 'Khôi phục';
    case 'RETURN': return 'Trả kết quả';
    case 'SYSTEM': return 'Cấu hình';
    default: return action;
  }
}

export function getTargetText(target: AuditTargetType): string {
  switch (target) {
    case 'RECORD': return 'Hồ sơ';
    case 'CONTRACT': return 'Hợp đồng';
    case 'USER': return 'Tài khoản';
    case 'EMPLOYEE': return 'Nhân sự';
    case 'SETTINGS': return 'Cấu hình';
    case 'EXCERPT': return 'Trích lục/Đo';
    case 'ARCHIVE': return 'Lưu trữ';
    case 'BLOCKING': return 'Ngăn chặn';
    case 'SYSTEM': return 'Hệ thống';
    default: return target;
  }
}
