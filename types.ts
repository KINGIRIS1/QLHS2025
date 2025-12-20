
// Định nghĩa trạng thái của hồ sơ theo quy trình
export enum RecordStatus {
  RECEIVED = 'RECEIVED',         // Tiếp nhận
  ASSIGNED = 'ASSIGNED',         // Giao nhân viên
  IN_PROGRESS = 'IN_PROGRESS',   // Đang thực hiện
  PENDING_SIGN = 'PENDING_SIGN', // Chờ ký kiểm tra
  SIGNED = 'SIGNED',             // Đã ký (Lập danh sách ký)
  HANDOVER = 'HANDOVER',         // Giao 1 cửa (Hoàn thành)
  WITHDRAWN = 'WITHDRAWN'        // CSD rút hồ sơ (Kết thúc)
}

export enum UserRole {
  ADMIN = 'ADMIN',
  SUBADMIN = 'SUBADMIN', // Phó quản trị (Quyền như Admin trừ quản lý User)
  TEAM_LEADER = 'TEAM_LEADER', // Nhóm trưởng (Quyền quản lý tác vụ, xem báo cáo, trích lục)
  EMPLOYEE = 'EMPLOYEE',
  ONEDOOR = 'ONEDOOR'    // Bộ phận một cửa (Chỉ tiếp nhận và xem)
}

export interface User {
  username: string;
  password?: string;
  name: string;
  role: UserRole;
  employeeId?: string;
}

export interface Employee {
  id: string;
  name: string;
  department: string;
  managedWards: string[];
}

export interface RecordFile {
  id: string;
  code: string;           
  customerName: string;   
  phoneNumber?: string;   
  cccd?: string;          
  
  ward?: string;          
  landPlot?: string;      
  mapSheet?: string;      
  area?: number;          
  address?: string;       
  group?: string;         

  content: string;        
  recordType?: string;    
  
  receivedDate: string;   
  deadline: string;       
  assignedDate?: string;  
  
  submissionDate?: string; // Ngày trình ký
  approvalDate?: string;   // Ngày ký duyệt
  completedDate?: string; 
  
  status: RecordStatus;   
  assignedTo?: string;    
  notes?: string;         
  privateNotes?: string;  
  personalNotes?: string; // Ghi chú cá nhân của nhân viên
  
  authorizedBy?: string;  
  authDocType?: string;   
  otherDocs?: string;     

  exportBatch?: number;   
  exportDate?: string;    
  
  measurementNumber?: string; 
  excerptNumber?: string;
  
  // Tính năng nhắc nhở
  reminderDate?: string;      // Thời gian đặt lịch nhắc
  lastRemindedAt?: string;    // Thời gian đã thông báo lần cuối
}

// Interface cho Item tách thửa
export interface SplitItem {
  serviceName: string; // Loại sản phẩm (VD: Tách thửa < 100m2)
  quantity: number;
  price: number;
}

// Interface riêng cho Hợp Đồng (Lưu table khác)
export interface Contract {
  id: string;
  code: string;           
  customerName: string;
  phoneNumber?: string;
  ward?: string;
  address?: string;
  landPlot?: string;
  mapSheet?: string;
  area?: number;
  
  // Phân loại logic
  contractType: 'Đo đạc' | 'Tách thửa' | 'Cắm mốc'; // Tab đang chọn
  serviceType: string;    // Tên dịch vụ chi tiết (VD: Đo đạc tòa án)
  areaType: string;       // Khu vực (Đất đô thị / Nông thôn)

  // Số lượng đặc thù
  plotCount?: number;     // Số thửa (cho Đo đạc)
  markerCount?: number;   // Số mốc (cho Cắm mốc)
  splitItems?: SplitItem[]; // Danh sách tách thửa (lưu JSON)

  // Tài chính
  quantity: number;       // Số lượng chung (để tính tiền cơ bản)
  unitPrice: number;      
  vatRate: number;        // % Thuế
  vatAmount: number;      // Tiền thuế
  totalAmount: number;    
  deposit: number;        
  content?: string;       
  
  createdDate: string;    
  status: 'PENDING' | 'COMPLETED';
}

// Interface cho Bảng giá (Cập nhật theo hình ảnh)
export interface PriceItem {
  id: string;
  serviceGroup?: string;  // Loại HS (VD: Đo đạc tòa án)
  areaType?: string;      // Khu vực (Đất đô thị/nông thôn)
  serviceName: string;    // Tên sản phẩm
  minArea: number;        // DTMin
  maxArea: number;        // DTMax
  unit: string;           // Đơn vị
  price: number;          // Giá sản phẩm
  vatRate: number;        // VAT
  vatIsPercent: boolean;  // VAT_IS_PERCENT
}

export interface ReportData {
  total: number;
  completed: number;
  processing: number;
  overdue: number;
  weeklySummary: string;
}

// Interface cho Nhóm Chat
export interface ChatGroup {
  id: string;
  name: string;
  type: 'CUSTOM' | 'SYSTEM'; // SYSTEM là nhóm mặc định nếu cần
  created_by?: string;
  created_at?: string;
  members?: string[];
}

// Interface cho Tin nhắn Chat
export interface Message {
  id: string;
  group_id?: string; // ID nhóm chat, nếu null hoặc 'GENERAL' là nhóm chung
  sender_username: string;
  sender_name: string;
  content: string;
  file_url?: string;
  file_name?: string;
  file_type?: string; // 'image' | 'document' | 'other'
  created_at: string;
  
  // Tính năng mới
  reply_to_id?: string | null;       // ID tin nhắn gốc
  reply_to_content?: string | null; // Nội dung tin nhắn gốc (snapshot)
  reply_to_sender?: string | null;  // Người gửi tin nhắn gốc
  reactions?: Record<string, string>; // { "username": "❤️", "username2": "👍" }
}

// Interface cho Ngày nghỉ lễ
export interface Holiday {
  id: string;
  name: string;       // Tên ngày lễ (VD: Tết Nguyên Đán)
  day: number;        // Ngày
  month: number;      // Tháng
  isLunar: boolean;   // true = Âm lịch, false = Dương lịch
}
