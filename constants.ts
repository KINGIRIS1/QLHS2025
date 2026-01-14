
import { RecordStatus, Employee, RecordFile, User, UserRole, Contract } from './types';

// CẤU HÌNH KẾT NỐI
// QUAN TRỌNG: Để dùng Cloud (Supabase), hãy dán URL dự án vào đây.
// Nếu dùng Mạng LAN (Local), đổi lại thành 'http://localhost:3005'
export const API_BASE_URL = 'https://dajjhubrhybodggbqapt.supabase.co'; 

// PHIÊN BẢN HIỆN TẠI CỦA ỨNG DỤNG
export const APP_VERSION = '1.9.6';

export const STATUS_LABELS: Record<RecordStatus, string> = {
  [RecordStatus.RECEIVED]: 'Tiếp nhận mới',
  [RecordStatus.ASSIGNED]: 'Đã giao việc',
  [RecordStatus.IN_PROGRESS]: 'Đang thực hiện',
  [RecordStatus.PENDING_SIGN]: 'Chờ ký kiểm tra',
  [RecordStatus.SIGNED]: 'Đã ký duyệt',
  [RecordStatus.HANDOVER]: 'Đã giao 1 cửa',
  [RecordStatus.RETURNED]: 'Đã trả kết quả',
  [RecordStatus.WITHDRAWN]: 'CSD rút hồ sơ',
};

export const STATUS_COLORS: Record<RecordStatus, string> = {
  [RecordStatus.RECEIVED]: 'bg-gray-100 text-gray-800',
  [RecordStatus.ASSIGNED]: 'bg-blue-100 text-blue-800',
  [RecordStatus.IN_PROGRESS]: 'bg-yellow-100 text-yellow-800',
  [RecordStatus.PENDING_SIGN]: 'bg-purple-100 text-purple-800',
  [RecordStatus.SIGNED]: 'bg-indigo-100 text-indigo-800',
  [RecordStatus.HANDOVER]: 'bg-green-100 text-green-800',
  [RecordStatus.RETURNED]: 'bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold',
  [RecordStatus.WITHDRAWN]: 'bg-slate-600 text-white',
};

export const GROUPS = ['Chơn Thành', 'Minh Hưng', 'Nha Bích'];

export const DEFAULT_WARDS = [
  'Chơn Thành',
  'Minh Hưng',
  'Nha Bích'
];

export const WARDS = DEFAULT_WARDS;

// Danh sách loại hồ sơ CƠ BẢN (Dùng cho form Tiếp nhận hồ sơ thường xuyên)
export const RECORD_TYPES = [
  'Trích đo chỉnh lý bản đồ địa chính',
  'Trích đo bản đồ địa chính',
  'Trích lục bản đồ địa chính',
  'Đo đạc',     
  'Cắm mốc'
];

// Danh sách loại hồ sơ MỞ RỘNG (Dùng cho form Thêm mới trong "Tất cả hồ sơ" - Admin/Nội bộ)
export const EXTENDED_RECORD_TYPES = [
  ...RECORD_TYPES,
  'Cung cấp thông tin',
  'Thi hành án',
  'Tòa án'
];

// Hàm chuẩn hóa hiển thị tên Xã/Phường (Xóa Xã/Phường/TT)
export const getNormalizedWard = (ward: string | null | undefined): string => {
  if (!ward) return '';
  let w = ward.trim();
  
  // Xóa các tiền tố hành chính thông dụng (không phân biệt hoa thường)
  w = w.replace(/^(xã|phường|thị trấn|tt\.|p\.|x\.)\s+/yi, '');

  const lower = w.toLowerCase();

  // 1. Xử lý các mã viết tắt đặc biệt
  if (lower === 'ct' || lower === 'chơn thành') return 'Chơn Thành';
  if (lower === 'nb' || lower === 'nha bích') return 'Nha Bích';
  if (lower === 'mh' || lower === 'minh hưng') return 'Minh Hưng';

  // 2. Xử lý Title Case (Viết hoa chữ cái đầu mỗi từ)
  return w.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

// Hàm rút gọn tên loại hồ sơ để hiển thị trong Danh sách (Table)
export const getShortRecordType = (type: string | null | undefined): string => {
  if (!type) return '---';
  const t = type.toLowerCase();
  
  // Ưu tiên kiểm tra các từ khóa dài trước
  if (t.includes('chỉnh lý') || t.includes('hiến đường') || t.includes('thay đổi hlbv')) return 'Chỉnh lý';
  if (t.includes('trích lục')) return 'Trích lục';
  // Kiểm tra "trích đo" sau "chỉnh lý" vì "trích đo chỉnh lý" chứa "trích đo"
  if (t.includes('trích đo')) return 'Trích đo';
  
  if (t.includes('cắm mốc')) return 'Cắm mốc';
  if (t.includes('đo đạc')) return 'Đo đạc';
  if (t.includes('tách thửa')) return 'Tách thửa';
  if (t.includes('hợp thửa')) return 'Hợp thửa';
  if (t.includes('chuyển mục đích')) return 'Chuyển MĐ';
  if (t.includes('cấp đổi')) return 'Cấp đổi';
  if (t.includes('cấp mới')) return 'Cấp mới';
  
  // Các loại mới thêm
  if (t.includes('cung cấp thông tin')) return 'CCTT';
  if (t.includes('thi hành án')) return 'Thi hành án';
  if (t.includes('tòa án')) return 'Tòa án';
  
  return type; // Trả về nguyên bản nếu không khớp quy tắc rút gọn
};

export const MOCK_EMPLOYEES: Employee[] = [
  { 
    id: 'emp1', 
    name: 'Nguyễn Văn A', 
    department: 'Phòng Kỹ thuật', 
    managedWards: ['Minh Hưng'] 
  },
  { 
    id: 'emp2', 
    name: 'Trần Thị B', 
    department: 'Phòng Pháp chế', 
    managedWards: ['Nha Bích', 'Chơn Thành'] 
  },
  { 
    id: 'emp3', 
    name: 'Lê Văn C', 
    department: 'Ban Lãnh đạo', 
    managedWards: [] 
  },
];

export const MOCK_USERS: User[] = [
  {
    username: 'admin',
    password: '123',
    name: 'Administrator',
    role: UserRole.ADMIN
  },
  {
    username: 'manager',
    password: '123',
    name: 'Phó Giám Đốc',
    role: UserRole.SUBADMIN
  },
  {
    username: 'nv_a',
    password: '123',
    name: 'Nguyễn Văn A',
    role: UserRole.EMPLOYEE,
    employeeId: 'emp1'
  },
  {
    username: 'nv_b',
    password: '123',
    name: 'Trần Thị B',
    role: UserRole.EMPLOYEE,
    employeeId: 'emp2'
  }
];

// Dữ liệu mẫu ban đầu nếu Server chưa có gì
const getRelativeDate = (daysOffset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
};

export const MOCK_RECORDS: RecordFile[] = [
  {
    id: '1',
    code: 'HS-2024-001',
    customerName: 'DỮ LIỆU MẪU (OFFLINE)',
    phoneNumber: '0909123456',
    recordType: 'Trích lục bản đồ địa chính',
    content: 'Vui lòng kết nối Server để xem dữ liệu thực',
    receivedDate: getRelativeDate(0), 
    deadline: getRelativeDate(5),      
    status: RecordStatus.RECEIVED,
    group: 'Minh Hưng',
    ward: 'Minh Hưng'
  }
];

export const MOCK_CONTRACTS: Contract[] = [
  {
    id: 'c1',
    code: 'HĐ-2024-001',
    customerName: 'Nguyễn Văn A (Mẫu)',
    phoneNumber: '0909123456',
    ward: 'Minh Hưng',
    contractType: 'Đo đạc',
    serviceType: 'Đo đạc diện tích dưới 500m2',
    areaType: 'Đất đô thị',
    quantity: 1,
    unitPrice: 1200000,
    vatRate: 8,
    vatAmount: 96000,
    totalAmount: 1296000,
    deposit: 0,
    createdDate: getRelativeDate(-1),
    status: 'PENDING'
  }
];
