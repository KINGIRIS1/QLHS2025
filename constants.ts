import { RecordStatus, Employee, RecordFile, User, UserRole } from './types';

// CẤU HÌNH KẾT NỐI MẠNG LAN
// ĐÂY LÀ ĐỊA CHỈ QUAN TRỌNG NHẤT
// Nếu chạy Server trên máy này: 'http://localhost:3000'
// Nếu Server là máy khác: 'http://192.168.1.X:3000'
export const API_BASE_URL = 'http://localhost:3000'; 

export const STATUS_LABELS: Record<RecordStatus, string> = {
  [RecordStatus.RECEIVED]: 'Tiếp nhận mới',
  [RecordStatus.ASSIGNED]: 'Đã giao việc',
  [RecordStatus.IN_PROGRESS]: 'Đang thực hiện',
  [RecordStatus.PENDING_SIGN]: 'Chờ ký kiểm tra',
  [RecordStatus.SIGNED]: 'Đã ký duyệt',
  [RecordStatus.HANDOVER]: 'Đã giao 1 cửa',
};

export const STATUS_COLORS: Record<RecordStatus, string> = {
  [RecordStatus.RECEIVED]: 'bg-gray-100 text-gray-800',
  [RecordStatus.ASSIGNED]: 'bg-blue-100 text-blue-800',
  [RecordStatus.IN_PROGRESS]: 'bg-yellow-100 text-yellow-800',
  [RecordStatus.PENDING_SIGN]: 'bg-purple-100 text-purple-800',
  [RecordStatus.SIGNED]: 'bg-indigo-100 text-indigo-800',
  [RecordStatus.HANDOVER]: 'bg-green-100 text-green-800',
};

export const GROUPS = ['Chơn Thành', 'Minh Hưng', 'Nha Bích'];

export const WARDS = [
  'Chơn Thành',
  'Minh Hưng',
  'Nha Bích'
];

// Danh sách loại hồ sơ đầy đủ (Hiển thị trong Form Thêm/Sửa)
// Đã xóa 'Chỉnh lại' và giữ nguyên tên đầy đủ
export const RECORD_TYPES = [
  'Trích đo chỉnh lý bản đồ địa chính',
  'Trích đo bản đồ địa chính',
  'Trích lục bản đồ địa chính',
  'Đo đạc',     
  'Cắm mốc'
];

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