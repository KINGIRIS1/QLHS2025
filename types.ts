
// Định nghĩa trạng thái của hồ sơ theo quy trình
export enum RecordStatus {
  RECEIVED = 'RECEIVED',         // Tiếp nhận
  ASSIGNED = 'ASSIGNED',         // Giao nhân viên
  IN_PROGRESS = 'IN_PROGRESS',   // Đang thực hiện
  PENDING_SIGN = 'PENDING_SIGN', // Chờ ký kiểm tra
  SIGNED = 'SIGNED',             // Đã ký (Lập danh sách ký)
  HANDOVER = 'HANDOVER'          // Giao 1 cửa (Hoàn thành)
}

export enum UserRole {
  ADMIN = 'ADMIN',
  SUBADMIN = 'SUBADMIN', // Phó quản trị (Quyền như Admin trừ quản lý User)
  EMPLOYEE = 'EMPLOYEE'
}

export interface User {
  username: string;
  password?: string; // Trong thực tế nên hash, ở đây demo lưu plain text hoặc bỏ qua
  name: string;
  role: UserRole;
  employeeId?: string; // Liên kết với Employee nếu là nhân viên
}

export interface Employee {
  id: string;
  name: string;
  department: string;
  managedWards: string[]; // Danh sách các xã/phường phụ trách
}

export interface RecordFile {
  id: string;
  code: string;           // Mã hồ sơ
  customerName: string;   // Chủ sử dụng
  phoneNumber?: string;   // Số điện thoại
  
  // Thông tin địa chính
  ward?: string;          // Xã/Phường
  group?: string;         // Nhóm (Khu vực)
  landPlot?: string;      // Thửa
  mapSheet?: string;      // Tờ
  
  content: string;        // Nội dung hồ sơ
  recordType?: string;    // Loại hồ sơ
  
  // Thông tin kỹ thuật
  measurementNumber?: string; // Số trích đo
  excerptNumber?: string;     // Số trích lục

  // Thời gian & Quy trình
  receivedDate: string;   // Ngày tiếp nhận
  deadline: string;       // Ngày hẹn trả
  assignedDate?: string;  // Ngày giao nhân viên
  completedDate?: string; // Ngày giao một cửa (Hoàn thành)
  
  status: RecordStatus;   // Trạng thái hiện tại
  assignedTo?: string;    // ID nhân viên được giao
  notes?: string;         // Ghi chú thêm
  privateNotes?: string;  // Ghi chú riêng tư (Chỉ nội bộ)
  
  // Xuất danh sách
  exportBatch?: number;   // Danh sách số (Đợt xuất)
  exportDate?: string;    // Thời điểm xuất danh sách
}

export interface ReportData {
  total: number;
  completed: number;
  processing: number;
  overdue: number;
  weeklySummary: string;
}