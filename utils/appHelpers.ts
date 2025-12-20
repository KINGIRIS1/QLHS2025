
import { RecordFile, RecordStatus } from '../types';

// --- HÀM TIỆN ÍCH XỬ LÝ CHUỖI TIẾNG VIỆT ---
export function removeVietnameseTones(str: string): string {
    if (!str) return '';
    str = str.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); 
    str = str.replace(/\u02C6|\u0306|\u031B/g, ""); 
    str = str.replace(/ + /g, " ");
    str = str.trim();
    return str;
}

// Hàm chuyển đổi Title Case (Nguyễn Văn A)
export function toTitleCase(str: string | undefined): string {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

// --- CONFIRM ACTION WRAPPER ---
// Sử dụng Native Dialog của Electron nếu có, ngược lại dùng window.confirm
export const confirmAction = async (message: string, title: string = 'Xác nhận'): Promise<boolean> => {
    if ((window as any).electronAPI && (window as any).electronAPI.showConfirmDialog) {
        // Chờ kết quả từ Main Process (không block renderer)
        return await (window as any).electronAPI.showConfirmDialog(message, title);
    }
    // Fallback cho trình duyệt web
    return window.confirm(message);
};

// --- ĐỊNH NGHĨA CÁC CỘT HIỂN THỊ ---
export const COLUMN_DEFS = [
  { key: 'code', label: 'Mã Hồ Sơ', sortKey: 'code' },
  { key: 'customer', label: 'Chủ Sử Dụng', sortKey: 'customerName' },
  { key: 'phone', label: 'Số Điện Thoại', sortKey: 'phoneNumber' },
  { key: 'received', label: 'Ngày Tiếp Nhận', sortKey: 'receivedDate' },
  { key: 'deadline', label: 'Ngày Hẹn Trả', sortKey: 'deadline' },
  { key: 'ward', label: 'Xã Phường', sortKey: 'ward' },
  { key: 'group', label: 'Nhóm (Khu vực)', sortKey: 'group' },
  { key: 'mapSheet', label: 'Tờ BĐ', sortKey: 'mapSheet' }, // Mới
  { key: 'landPlot', label: 'Thửa đất', sortKey: 'landPlot' }, // Mới
  { key: 'assigned', label: 'Ngày Giao NV', sortKey: 'assignedDate' },
  { key: 'completed', label: 'Ngày Giao 1 Cửa', sortKey: 'completedDate' },
  { key: 'type', label: 'Loại Hồ Sơ', sortKey: 'recordType' },
  { key: 'tech', label: 'Trích Đo / Lục', sortKey: 'measurementNumber' },
  { key: 'batch', label: 'Danh Sách Xuất', sortKey: 'exportBatch' },
  { key: 'status', label: 'Trạng Thái', sortKey: 'status' },
];

export const DEFAULT_VISIBLE_COLUMNS = {
    code: true, customer: true, phone: false, received: true, deadline: true,
    ward: true, group: false, mapSheet: true, landPlot: true, assigned: true, completed: false,
    type: true, tech: false, batch: false, status: true
};

// --- CÁC HÀM CHECK LOGIC ---
export const isRecordOverdue = (record: RecordFile): boolean => {
  // Hồ sơ đã xong (Handover) hoặc đã rút (Withdrawn) thì không tính trễ
  if (record.status === RecordStatus.HANDOVER || record.status === RecordStatus.WITHDRAWN) return false;
  
  if (!record.deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(record.deadline);
  deadline.setHours(0, 0, 0, 0);
  return deadline < today;
};

export const isRecordApproaching = (record: RecordFile): boolean => {
  if (record.status === RecordStatus.HANDOVER || record.status === RecordStatus.WITHDRAWN) return false;
  if (isRecordOverdue(record)) return false;
  if (!record.deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(record.deadline);
  deadline.setHours(0, 0, 0, 0);
  const diffTime = deadline.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 3;
};
