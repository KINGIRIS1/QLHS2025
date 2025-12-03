
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { RecordFile, RecordStatus, Employee, User, UserRole } from './types';
import { STATUS_LABELS, WARDS as DEFAULT_WARDS } from './constants';
import Sidebar from './components/Sidebar';
import RecordModal from './components/RecordModal';
import ImportModal from './components/ImportModal';
import AssignModal from './components/AssignModal';
import SettingsModal from './components/SettingsModal';
import SystemSettingsModal from './components/SystemSettingsModal';
import DetailModal from './components/DetailModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import StatusBadge from './components/StatusBadge';
import Login from './components/Login'; 
import UserManagement from './components/UserManagement'; 
import ExportModal from './components/ExportModal'; 
import PersonalProfile from './components/PersonalProfile'; 
import ExcerptManagement from './components/ExcerptManagement';
import { generateReport } from './services/geminiService';
import { 
    fetchRecords, createRecordApi, updateRecordApi, deleteRecordApi, deleteAllDataApi, createRecordsBatchApi,
    fetchEmployees, saveEmployeeApi, deleteEmployeeApi,
    fetchUsers, saveUserApi, deleteUserApi
} from './services/api';
import XLSX from 'xlsx-js-style';
import { 
  Plus, Search, ArrowRight, FileCheck, CheckCircle, 
  RefreshCw, Calendar, FileOutput, Loader2,
  BarChart3, FileText, CheckSquare, Square, Users, FileSpreadsheet,
  SlidersHorizontal, AlertTriangle, AlertCircle, Filter, Pencil, RotateCcw, Eye, Trash2, CalendarRange, Clock, FileDown, Lock, Download, WifiOff, Wifi,
  ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, BellRing, MapPin, PenTool, Sparkles, X, FileSignature
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// --- HÀM TIỆN ÍCH XỬ LÝ CHUỖI TIẾNG VIỆT ---
function removeVietnameseTones(str: string): string {
    if (!str) return '';
    str = str.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); // ̀ ́ ̃ ̉ ̣  huyền, sắc, ngã, hỏi, nặng
    str = str.replace(/\u02C6|\u0306|\u031B/g, ""); // ˆ ̆ ̛  Â, Ê, Ă, Ơ, Ư
    // Remove extra spaces
    str = str.replace(/ + /g, " ");
    str = str.trim();
    return str;
}

// --- ĐỊNH NGHĨA CÁC CỘT HIỂN THỊ ---
const COLUMN_DEFS = [
  { key: 'code', label: 'Mã Hồ Sơ', sortKey: 'code' },
  { key: 'customer', label: 'Chủ Sử Dụng', sortKey: 'customerName' },
  { key: 'phone', label: 'Số Điện Thoại', sortKey: 'phoneNumber' },
  { key: 'received', label: 'Ngày Tiếp Nhận', sortKey: 'receivedDate' },
  { key: 'deadline', label: 'Ngày Hẹn Trả', sortKey: 'deadline' },
  { key: 'ward', label: 'Xã Phường', sortKey: 'ward' },
  { key: 'group', label: 'Nhóm (Khu vực)', sortKey: 'group' },
  { key: 'landInfo', label: 'Thửa / Tờ', sortKey: 'landPlot' }, 
  { key: 'assigned', label: 'Ngày Giao NV', sortKey: 'assignedDate' },
  { key: 'completed', label: 'Ngày Giao 1 Cửa', sortKey: 'completedDate' },
  { key: 'type', label: 'Loại Hồ Sơ', sortKey: 'recordType' },
  { key: 'tech', label: 'Trích Đo / Lục', sortKey: 'measurementNumber' },
  { key: 'batch', label: 'Danh Sách Xuất', sortKey: 'exportBatch' },
  { key: 'status', label: 'Trạng Thái', sortKey: 'status' },
];

// --- CÁC HÀM TIỆN ÍCH ---
const isRecordOverdue = (record: RecordFile): boolean => {
  if (record.status === RecordStatus.HANDOVER) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (!record.deadline) return false;
  const deadline = new Date(record.deadline);
  deadline.setHours(0, 0, 0, 0);

  return deadline < today;
};

const isRecordApproaching = (record: RecordFile): boolean => {
  if (record.status === RecordStatus.HANDOVER) return false;
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

// --- HÀM GỬI THÔNG BÁO HỆ THỐNG ---
const sendDeadlineNotification = (records: RecordFile[], user: User, onClickCallback: () => void) => {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") Notification.requestPermission();
  if (Notification.permission !== "granted") return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const urgentRecords = records.filter(r => {
    if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.SIGNED) return false;
    if (user.role === UserRole.EMPLOYEE && r.assignedTo !== user.employeeId) return false;
    if (!r.deadline) return false;
    const deadline = new Date(r.deadline);
    deadline.setHours(0, 0, 0, 0);
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 2;
  });

  if (urgentRecords.length > 0) {
    const overdueCount = urgentRecords.filter(r => isRecordOverdue(r)).length;
    const approachingCount = urgentRecords.length - overdueCount;

    let bodyMsg = "";
    if (overdueCount > 0) bodyMsg += `🔴 ${overdueCount} hồ sơ ĐÃ QUÁ HẠN.\n`;
    if (approachingCount > 0) bodyMsg += `⚠️ ${approachingCount} hồ sơ đến hạn trong 2 ngày tới.`;
    bodyMsg += "\n[Nhấn để xem chi tiết]";

    const notification = new Notification("Nhắc nhở hạn trả hồ sơ", {
      body: bodyMsg || "Bạn có hồ sơ cần xử lý gấp!",
      icon: '/vite.svg', 
      tag: 'deadline-notification', 
      requireInteraction: true 
    });

    notification.onclick = () => {
        window.focus();
        onClickCallback();
        notification.close();
    };
  }
};

// --- COMPONENT BIỂU ĐỒ ---
const DashboardChart = ({ data }: { data: RecordFile[] }) => {
  const statusData = useMemo(() => {
    const counts = data.reduce((acc, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.keys(STATUS_LABELS).map(key => ({
      name: STATUS_LABELS[key as RecordStatus],
      count: counts[key as any] || 0
    }));
  }, [data]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Thống kê theo trạng thái</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" hide />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="Số lượng hồ sơ" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Tỷ lệ hoàn thành</h3>
        <div className="h-64">
           <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
                label={({name, percent}) => `${(percent * 100).toFixed(0)}%`}
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT BÁO CÁO (ReportSection) ---
const ReportSection = ({ records, currentUser }: { records: RecordFile[], currentUser: User }) => {
    const [reportContent, setReportContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [range, setRange] = useState<'week' | 'month' | 'last_month'>('week');

    const handleGenerate = async () => {
        setLoading(true);
        setReportContent(''); // Reset

        // 1. Lọc dữ liệu theo thời gian
        const now = new Date();
        const filtered = records.filter(r => {
            if(!r.receivedDate) return false;
            const rDate = new Date(r.receivedDate);
            
            if (range === 'week') {
                const sevenDaysAgo = new Date(now);
                sevenDaysAgo.setDate(now.getDate() - 7);
                return rDate >= sevenDaysAgo && rDate <= now;
            } else if (range === 'month') {
                return rDate.getMonth() === now.getMonth() && rDate.getFullYear() === now.getFullYear();
            } else if (range === 'last_month') {
                const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                return rDate.getMonth() === prevMonth.getMonth() && rDate.getFullYear() === prevMonth.getFullYear();
            }
            return false;
        });

        // 2. Tạo nhãn thời gian
        let timeLabel = '';
        if (range === 'week') timeLabel = '7 ngày qua';
        else if (range === 'month') timeLabel = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
        else timeLabel = `Tháng ${now.getMonth() === 0 ? 12 : now.getMonth()}/${now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()}`;

        // 3. Gọi API
        try {
            const scope = currentUser.role === UserRole.EMPLOYEE ? 'personal' : 'general';
            const result = await generateReport(filtered, timeLabel, scope, currentUser.name);
            setReportContent(result);
        } catch (error) {
            setReportContent("Không thể tạo báo cáo. Vui lòng kiểm tra API Key.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] gap-4">
            {/* Toolbar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="text-purple-600" />
                    <h2 className="font-bold text-gray-800">Trợ lý AI Báo cáo</h2>
                </div>
                
                <div className="flex items-center gap-3">
                    <select 
                        value={range}
                        onChange={(e) => setRange(e.target.value as any)}
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-purple-500 focus:border-purple-500 outline-none"
                    >
                        <option value="week">7 ngày qua</option>
                        <option value="month">Tháng này</option>
                        <option value="last_month">Tháng trước</option>
                    </select>

                    <button 
                        onClick={handleGenerate}
                        disabled={loading}
                        className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm font-medium text-sm"
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                        {loading ? 'Đang viết báo cáo...' : 'Tạo báo cáo ngay'}
                    </button>
                </div>
            </div>

            {/* Result Area */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 p-8 overflow-y-auto">
                {reportContent ? (
                    <div className="prose max-w-none text-gray-800 leading-relaxed whitespace-pre-wrap font-serif">
                        {reportContent}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                        <FileText size={64} className="mb-4 text-gray-300" />
                        <p className="text-lg">Chọn thời gian và nhấn "Tạo báo cáo ngay"</p>
                        <p className="text-sm">AI sẽ phân tích dữ liệu hồ sơ và viết báo cáo cho bạn.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- MAIN APP COMPONENT ---
function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  
  const [records, setRecords] = useState<RecordFile[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'offline'>('connected');
  
  // Dữ liệu Nhân viên và Users tải từ API, không dùng Mock nữa
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  const [wards, setWards] = useState<string[]>(() => {
    const saved = localStorage.getItem('wards_list');
    return saved ? JSON.parse(saved) : DEFAULT_WARDS;
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const [sortConfig, setSortConfig] = useState<{ key: keyof RecordFile | string; direction: 'asc' | 'desc' }>({
    key: 'receivedDate',
    direction: 'desc'
  });

  const hasNotifiedRef = useRef(false);
  const [showApproachingOnly, setShowApproachingOnly] = useState(false);

  // LOAD DATA
  useEffect(() => {
    const loadData = async () => {
      // 1. Records
      const recordData = await fetchRecords();
      setRecords(recordData || []);

      // 2. Employees
      const empData = await fetchEmployees();
      setEmployees(empData || []);

      // 3. Users
      const userData = await fetchUsers();
      setUsers(userData || []);

      if (recordData) setConnectionStatus('connected');
      else setConnectionStatus('offline');
    };
    loadData();
    
    // Polling hồ sơ
    const interval = setInterval(async () => {
        const data = await fetchRecords();
        if (data) setRecords(data);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('wards_list', JSON.stringify(wards));
  }, [wards]);

  // Handle Employee CRUD
  const handleSaveEmployee = async (emp: Employee) => {
      // Check if update or create based on ID existence in current list
      const isUpdate = employees.some(e => e.id === emp.id);
      const savedEmp = await saveEmployeeApi(emp, isUpdate);
      if (savedEmp) {
          if (isUpdate) {
              setEmployees(prev => prev.map(e => e.id === emp.id ? savedEmp : e));
          } else {
              setEmployees(prev => [...prev, savedEmp]);
          }
      }
  };

  const handleDeleteEmployee = async (id: string) => {
      const success = await deleteEmployeeApi(id);
      if (success) {
          setEmployees(prev => prev.filter(e => e.id !== id));
      }
  };

  // Handle User CRUD
  const handleAddUser = async (newUser: User) => {
      const saved = await saveUserApi(newUser, false);
      if(saved) setUsers(prev => [...prev, saved]);
  };
  
  const handleUpdateUser = async (updatedUser: User) => {
      const saved = await saveUserApi(updatedUser, true);
      if(saved) setUsers(prev => prev.map(u => u.username === updatedUser.username ? saved : u));
  };
  
  const handleDeleteUser = async (username: string) => {
      const success = await deleteUserApi(username);
      if(success) setUsers(prev => prev.filter(u => u.username !== username));
  };

  // ... (Các logic phân trang, sort, filter giữ nguyên)
  useEffect(() => { setCurrentPage(1); }, [currentView, sortConfig, showApproachingOnly]);

  const handleNotificationClick = () => { setCurrentView('all_records'); setShowApproachingOnly(true); };

  useEffect(() => {
    if (currentUser && records.length > 0 && !hasNotifiedRef.current) {
        sendDeadlineNotification(records, currentUser, handleNotificationClick);
        hasNotifiedRef.current = true;
    }
  }, [records, currentUser]);

  useEffect(() => { hasNotifiedRef.current = false; }, [currentUser]);

  const handleAddWard = (newWard: string) => {
    if (!wards.includes(newWard)) setWards(prev => [newWard, ...prev]);
  };

  const handleDeleteWard = (wardToDelete: string) => {
    setWards(prev => prev.filter(w => w !== wardToDelete));
  };
  
  const handleResetWards = () => {
    if (confirm('Khôi phục danh sách Xã/Phường mặc định?')) setWards(DEFAULT_WARDS);
  };

  const handleDeleteAllData = async () => {
    const success = await deleteAllDataApi();
    if (success) {
      setRecords([]);
      alert("Đã xóa sạch dữ liệu hồ sơ và lịch sử.");
      setIsSystemSettingsOpen(false);
    } else {
      alert("Lỗi khi xóa dữ liệu.");
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSystemSettingsOpen, setIsSystemSettingsOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  
  const [editingRecord, setEditingRecord] = useState<RecordFile | null>(null);
  const [viewingRecord, setViewingRecord] = useState<RecordFile | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<RecordFile | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [assignTargetRecords, setAssignTargetRecords] = useState<RecordFile[]>([]);
  const [filterWard, setFilterWard] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  // STATE MỚI CHO BỘ LỌC NGÀY
  const [filterSpecificDate, setFilterSpecificDate] = useState<string>(''); // Lọc 1 ngày cụ thể
  const [filterFromDate, setFilterFromDate] = useState<string>(''); // Từ ngày
  const [filterToDate, setFilterToDate] = useState<string>(''); // Đến ngày
  const [showAdvancedDateFilter, setShowAdvancedDateFilter] = useState<boolean>(false);

  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);

  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    COLUMN_DEFS.forEach(col => defaults[col.key] = true);
    try {
      const saved = localStorage.getItem('visibleColumns');
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch (e) {}
    return defaults;
  });

  const columnSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
        setShowColumnSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => { localStorage.setItem('visibleColumns', JSON.stringify(visibleColumns)); }, [visibleColumns]);

  const toggleColumn = (key: string) => { setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] })); };
  const resetColumns = () => {
    const defaults: Record<string, boolean> = {};
    COLUMN_DEFS.forEach(col => defaults[col.key] = true);
    setVisibleColumns(defaults);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'desc'; 
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
  };

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isSubadmin = currentUser?.role === UserRole.SUBADMIN;
  const isEmployee = currentUser?.role === UserRole.EMPLOYEE;
  const hasAdminRights = isAdmin || isSubadmin;

  const canPerformAction = useMemo(() => {
    if (isAdmin) return true;
    if (isSubadmin) return true; // Cấp quyền full cho Subadmin ở mọi nơi
    return false;
  }, [isAdmin, isSubadmin]);

  const overdueCount = useMemo(() => records.filter(isRecordOverdue).length, [records]);
  const approachingCount = useMemo(() => records.filter(isRecordApproaching).length, [records]);

  const filteredRecords = useMemo(() => {
    let result = [...records]; 

    if (currentView === 'check_list') {
      result = result.filter(r => r.status === RecordStatus.PENDING_SIGN || r.status === RecordStatus.SIGNED);
    } else if (currentView === 'handover_list') {
      result = result.filter(r => r.status === RecordStatus.SIGNED || r.status === RecordStatus.HANDOVER);
      if (filterDate) {
         result = result.filter(r => {
             const expDate = r.exportDate ? r.exportDate.split('T')[0] : null;
             return expDate === filterDate || (!r.exportBatch && r.status === RecordStatus.SIGNED);
         });
      }
    } else if (currentView === 'assign_tasks') {
        result = result.filter(r => (!r.assignedTo || r.assignedTo.trim() === '') && r.status !== RecordStatus.HANDOVER);
    }

    // --- LOGIC LỌC NGÀY (THAY THẾ FILTER TIMERANGE CŨ) ---
    if (currentView !== 'handover_list') {
         // Nếu là handover_list thì dùng logic riêng ở trên (filterDate cho exportBatch)
         // Còn lại dùng bộ lọc ngày chung cho receivedDate
        if (showAdvancedDateFilter) {
            // Lọc nâng cao: Từ ngày - Đến ngày
            if (filterFromDate || filterToDate) {
                result = result.filter(r => {
                    if (!r.receivedDate) return false;
                    const rDate = r.receivedDate;
                    if (filterFromDate && rDate < filterFromDate) return false;
                    if (filterToDate && rDate > filterToDate) return false;
                    return true;
                });
            }
        } else {
            // Lọc cơ bản: 1 ngày cụ thể
            if (filterSpecificDate) {
                result = result.filter(r => r.receivedDate === filterSpecificDate);
            }
        }
    }

    // Đã bỏ lọc khu vực (Group)

    if (filterWard !== 'all') {
         // Áp dụng normalize cho bộ lọc ward luôn
        const wardSearch = removeVietnameseTones(filterWard);
        result = result.filter(r => removeVietnameseTones(r.ward || '').includes(wardSearch));
    }
    
    if (filterStatus !== 'all') result = result.filter(r => r.status === filterStatus);
    
    if (currentView !== 'assign_tasks' && filterEmployee !== 'all') {
        if (filterEmployee === 'unassigned') result = result.filter(r => !r.assignedTo);
        else result = result.filter(r => r.assignedTo === filterEmployee);
    }
    
    if (showApproachingOnly) result = result.filter(r => isRecordApproaching(r));
    else if (showOverdueOnly) result = result.filter(isRecordOverdue);

    // --- LOGIC TÌM KIẾM MỚI (ROBUST SEARCH) ---
    if (searchTerm) {
      const normalizedSearch = removeVietnameseTones(searchTerm);
      const rawSearch = searchTerm.toLowerCase().trim();

      result = result.filter(r => {
        // 1. Tìm chính xác (tương đối) với các trường không dấu (Mã, SĐT, Tờ, Thửa)
        if ((r.code || '').toLowerCase().includes(rawSearch)) return true;
        if ((r.phoneNumber || '').includes(rawSearch)) return true;
        if ((r.landPlot || '').toLowerCase().includes(rawSearch)) return true;
        if ((r.mapSheet || '').toLowerCase().includes(rawSearch)) return true;

        // 2. Tìm tương đối với các trường có dấu (Tên, Xã, Khu vực, Nội dung) -> Cần bỏ dấu
        const nameNorm = removeVietnameseTones(r.customerName || '');
        const wardNorm = removeVietnameseTones(r.ward || '');
        const groupNorm = removeVietnameseTones(r.group || '');
        const contentNorm = removeVietnameseTones(r.content || '');
        // Gộp chung trích đo/lục để tìm kiếm
        const techNorm = removeVietnameseTones((r.measurementNumber || '') + ' ' + (r.excerptNumber || ''));

        if (nameNorm.includes(normalizedSearch)) return true;
        if (wardNorm.includes(normalizedSearch)) return true;
        if (groupNorm.includes(normalizedSearch)) return true;
        if (contentNorm.includes(normalizedSearch)) return true;
        if (techNorm.includes(normalizedSearch)) return true;

        return false;
      });
    }

    if (sortConfig.key) {
        result.sort((a, b) => {
            const aValue = a[sortConfig.key as keyof RecordFile];
            const bValue = b[sortConfig.key as keyof RecordFile];
            if (aValue === undefined || aValue === null) return 1;
            if (bValue === undefined || bValue === null) return -1;
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return result;
  }, [records, currentView, searchTerm, filterWard, filterDate, showOverdueOnly, showApproachingOnly, filterEmployee, filterStatus, sortConfig, filterSpecificDate, filterFromDate, filterToDate, showAdvancedDateFilter]);

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredRecords.slice(startIndex, endIndex);
  }, [filteredRecords, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);

  const advanceStatus = async (record: RecordFile, targetStatus?: RecordStatus) => {
    let nextStatus = targetStatus;
    if (!nextStatus) {
        switch (record.status) {
          case RecordStatus.RECEIVED: setAssignTargetRecords([record]); setIsAssignModalOpen(true); return; 
          case RecordStatus.ASSIGNED: nextStatus = RecordStatus.IN_PROGRESS; break;
          case RecordStatus.IN_PROGRESS: nextStatus = RecordStatus.PENDING_SIGN; break;
          case RecordStatus.PENDING_SIGN: nextStatus = RecordStatus.SIGNED; break;
          case RecordStatus.SIGNED: nextStatus = RecordStatus.HANDOVER; break;
          default: return;
        }
    }
    const updates: Partial<RecordFile> = {};
    const today = new Date().toISOString().split('T')[0];
    if (nextStatus === RecordStatus.HANDOVER) updates.completedDate = today;

    const updatedRecord = { ...record, status: nextStatus!, ...updates };
    setRecords(prev => prev.map(r => r.id === record.id ? updatedRecord : r));
    await updateRecordApi(updatedRecord);
  };

  const handleQuickUpdate = async (id: string, field: keyof RecordFile, value: string) => {
    if (!canPerformAction) return;
    const record = records.find(r => r.id === id);
    if (record) {
        const updated = { ...record, [field]: value };
        setRecords(prev => prev.map(r => r.id === id ? updated : r));
        await updateRecordApi(updated);
    }
  };

  const handleUpdateRecordExcerpt = async (recordId: string, newExcerptNumber: string) => {
      const record = records.find(r => r.id === recordId);
      if (record) {
          const updated = { ...record, excerptNumber: newExcerptNumber };
          setRecords(prev => prev.map(r => r.id === recordId ? updated : r));
          await updateRecordApi(updated);
      }
  };

  const handleAddOrUpdate = async (data: any) => {
    if (editingRecord) {
      const updated = { ...editingRecord, ...data };
      setRecords(prev => prev.map(r => r.id === editingRecord.id ? updated : r));
      await updateRecordApi(updated);
    } else {
      const newRecord: RecordFile = {
        ...data,
        id: Math.random().toString(36).substr(2, 9),
        status: RecordStatus.RECEIVED
      };
      const savedRecord = await createRecordApi(newRecord);
      if(savedRecord) setRecords(prev => [savedRecord, ...prev]);
      else alert("Lỗi khi lưu vào máy chủ.");
    }
    setEditingRecord(null);
  };

  const handleDeleteRecord = async () => {
    if (deletingRecord) {
        await deleteRecordApi(deletingRecord.id);
        setRecords(prev => prev.filter(r => r.id !== deletingRecord.id));
        if (selectedRecordIds.has(deletingRecord.id)) {
            const newSelected = new Set(selectedRecordIds);
            newSelected.delete(deletingRecord.id);
            setSelectedRecordIds(newSelected);
        }
        setDeletingRecord(null);
    }
  };

  const confirmDelete = (record: RecordFile) => { setDeletingRecord(record); setIsDeleteModalOpen(true); };

  const handleImportRecords = async (newRecords: RecordFile[]) => {
      const BATCH_SIZE = 500;
      const totalRecords = newRecords.length;
      const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);
      
      for (let i = 0; i < totalBatches; i++) {
          const batch = newRecords.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
          await createRecordsBatchApi(batch);
      }
      const freshData = await fetchRecords();
      setRecords(freshData);
      setCurrentPage(1);
      alert(`Đã nhập thành công ${totalRecords} hồ sơ!`);
  };

  const toggleSelectRecord = (id: string) => {
    if (!canPerformAction) return;
    const newSelected = new Set(selectedRecordIds);
    if (newSelected.has(id)) newSelected.delete(id); else newSelected.add(id);
    setSelectedRecordIds(newSelected);
  };

  const toggleSelectAll = () => {
      if (!canPerformAction) return;
      if (selectedRecordIds.size === filteredRecords.length && filteredRecords.length > 0) setSelectedRecordIds(new Set());
      else setSelectedRecordIds(new Set(filteredRecords.map(r => r.id)));
  };

  const openBulkAssignModal = () => {
      const selected = records.filter(r => selectedRecordIds.has(r.id));
      setAssignTargetRecords(selected);
      setIsAssignModalOpen(true);
  };

  const confirmAssign = async (employeeId: string) => {
      const today = new Date().toISOString().split('T')[0];
      const updates = assignTargetRecords.map(async (r) => {
          if (r.status === RecordStatus.RECEIVED || r.status === RecordStatus.ASSIGNED) {
              const updated = { ...r, assignedTo: employeeId, status: RecordStatus.ASSIGNED, assignedDate: today };
              await updateRecordApi(updated);
              return updated;
          }
          return r;
      });
      await Promise.all(updates);
      const freshData = await fetchRecords();
      setRecords(freshData);
      setIsAssignModalOpen(false);
      setSelectedRecordIds(new Set());
      setAssignTargetRecords([]);
      alert('Đã giao hồ sơ thành công!');
  };

  // Hàm xuất danh sách đơn giản (cho Danh sách trình ký)
  const handleExportSimple = () => {
      const header = ["STT", "Mã Hồ Sơ", "Chủ Sử Dụng", "Xã Phường", "Nội Dung", "Loại Hồ Sơ", "Số Tờ", "Số Thửa"];
      const data = filteredRecords.map((r, index) => [
          index + 1,
          r.code || '',
          r.customerName || '',
          r.ward || '',
          r.content || '',
          r.recordType || '',
          r.mapSheet || '',
          r.landPlot || ''
      ]);

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([
          ["DANH SÁCH HỒ SƠ TRÌNH KÝ"],
          [`Ngày xuất: ${new Date().toLocaleDateString('vi-VN')}`],
          [],
          header,
          ...data
      ]);

      // Định dạng đơn giản
      ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 10 }, { wch: 10 }];
      
      XLSX.utils.book_append_sheet(wb, ws, "Danh Sach");
      XLSX.writeFile(wb, "Danh_Sach_Trinh_Ky.xlsx");
  };

  // Chốt danh sách trình ký (Chuyển tất cả PENDING_SIGN -> SIGNED)
  const handleConfirmSignBatch = async () => {
    if (!canPerformAction) return;

    // Lọc ra các hồ sơ đang chờ ký trong danh sách hiển thị
    const recordsToUpdate = filteredRecords.filter(r => r.status === RecordStatus.PENDING_SIGN);

    if (recordsToUpdate.length === 0) {
        alert("Không có hồ sơ 'Chờ ký kiểm tra' nào trong danh sách để chốt.");
        return;
    }

    if (!confirm(`Bạn có chắc muốn chốt ${recordsToUpdate.length} hồ sơ này sang trạng thái ĐÃ KÝ (Chờ giao 1 cửa)?`)) return;

    const updates = recordsToUpdate.map(async (r) => {
        const updated = { ...r, status: RecordStatus.SIGNED };
        await updateRecordApi(updated);
        return updated;
    });

    await Promise.all(updates);
    const freshData = await fetchRecords();
    setRecords(freshData);
    alert(`Đã chốt thành công ${recordsToUpdate.length} hồ sơ!`);
  };

  const handleExportBatch = async () => {
    if (!canPerformAction) return;
    const todayStr = filterDate;
    // Lọc những hồ sơ cần xuất: Status SIGNED hoặc HANDOVER nhưng chưa có batch
    // Sửa logic: Chốt danh sách ở giao 1 cửa -> Đánh dấu hồ sơ thành HANDOVER luôn
    const recordsToExport = filteredRecords.filter(r => {
        const isExportedToday = r.exportDate?.split('T')[0] === todayStr && r.exportBatch;
        return !isExportedToday;
    });

    if (recordsToExport.length === 0) {
        alert(`Không có hồ sơ mới nào để xuất danh sách cho ngày ${todayStr}.`);
        return;
    }

    const existingBatches = records
        .filter(r => r.exportDate?.split('T')[0] === todayStr && r.exportBatch)
        .map(r => r.exportBatch || 0);
    
    const nextBatch = existingBatches.length > 0 ? Math.max(...existingBatches) + 1 : 1;
    const timestamp = new Date().toISOString();

    const updates = recordsToExport.map(async (r) => {
        const updated = { 
            ...r, 
            exportBatch: nextBatch, 
            exportDate: timestamp,
            status: RecordStatus.HANDOVER, // Tự động chuyển về trạng thái Đã giao 1 cửa (Hoàn thành)
            completedDate: r.completedDate || todayStr // Ghi nhận ngày hoàn thành nếu chưa có
        };
        await updateRecordApi(updated);
        return updated;
    });

    await Promise.all(updates);
    const freshData = await fetchRecords();
    setRecords(freshData);
    alert(`Đã chốt danh sách và hoàn thành hồ sơ: Đợt ${nextBatch} - Ngày ${todayStr}\nGồm ${recordsToExport.length} hồ sơ.`);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
  };

  const renderSortableHeader = (label: string, sortKey: string) => {
    const isSorted = sortConfig.key === sortKey;
    return (
        <div 
            className="flex items-center gap-1 cursor-pointer hover:text-blue-600 transition-colors select-none"
            onClick={() => handleSort(sortKey)}
        >
            {label}
            <span className="text-gray-400">
                {isSorted ? (
                    sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-blue-600" /> : <ArrowDown size={12} className="text-blue-600" />
                ) : <ArrowUpDown size={12} />}
            </span>
        </div>
    );
  };

  // --- LOGIC RENDER MAIN VIEW ---
  const renderMainContent = () => {
    if (currentView === 'reports' && currentUser) return <ReportSection records={records} currentUser={currentUser} />;
    
    if (currentView === 'user_management' && isAdmin) {
      return (
        <UserManagement 
          users={users}
          employees={employees}
          onAddUser={handleAddUser}
          onUpdateUser={handleUpdateUser}
          onDeleteUser={handleDeleteUser}
        />
      );
    }

    if (currentView === 'personal_profile' && currentUser) {
        return (
            <PersonalProfile 
                user={currentUser}
                records={records}
                onUpdateStatus={(r, status) => advanceStatus(r, status)}
                onViewRecord={(r) => setViewingRecord(r)}
            />
        );
    }

    if (currentView === 'excerpt_management' && currentUser) {
        return (
            <ExcerptManagement 
                currentUser={currentUser} 
                records={records}
                onUpdateRecord={handleUpdateRecordExcerpt}
                wards={wards}
                onAddWard={handleAddWard}
                onDeleteWard={handleDeleteWard}
                onResetWards={handleResetWards}
            />
        );
    }

    if (currentView === 'dashboard') {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Tổng hồ sơ</p>
                            <h3 className="text-3xl font-bold text-gray-800">{records.length}</h3>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg text-blue-600"><FileText size={24} /></div>
                    </div>
                    {/* ... (Các thẻ khác giữ nguyên) */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Đang xử lý</p>
                            <h3 className="text-3xl font-bold text-gray-800">
                                {records.filter(r => r.status === RecordStatus.IN_PROGRESS || r.status === RecordStatus.ASSIGNED).length}
                            </h3>
                        </div>
                        <div className="p-3 bg-yellow-50 rounded-lg text-yellow-600"><RefreshCw size={24} /></div>
                    </div>
                     <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Chờ ký duyệt</p>
                            <h3 className="text-3xl font-bold text-gray-800">
                                {records.filter(r => r.status === RecordStatus.PENDING_SIGN).length}
                            </h3>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg text-purple-600"><FileCheck size={24} /></div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 mb-1">Quá hạn xử lý</p>
                            <h3 className={`text-3xl font-bold ${overdueCount > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                                {overdueCount}
                            </h3>
                        </div>
                        <div className={`p-3 rounded-lg ${overdueCount > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                           {overdueCount > 0 ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
                        </div>
                    </div>
                </div>
                <DashboardChart data={records} />
            </div>
        );
    }

    const isListView = currentView === 'check_list' || currentView === 'handover_list';

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col flex-1 h-full">
         {/* ... (Phần render List view giữ nguyên) */}
         {/* Banner quá hạn / sắp tới hạn */}
         {overdueCount > 0 && !showOverdueOnly && !showApproachingOnly && (
            <div className="bg-red-50 px-4 py-2 border-b border-red-100 flex items-center justify-between animate-fade-in">
                <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
                    <AlertTriangle size={16} />
                    <span>Cảnh báo: Có {overdueCount} hồ sơ đã quá hạn trả kết quả!</span>
                </div>
                <button 
                    onClick={() => { setShowOverdueOnly(true); setShowApproachingOnly(false); }}
                    className="text-xs bg-white border border-red-200 text-red-600 px-3 py-1 rounded-full hover:bg-red-100 transition-colors font-semibold"
                >
                    Xem danh sách quá hạn
                </button>
            </div>
        )}
        {approachingCount > 0 && !showApproachingOnly && !showOverdueOnly && (
             <div className="bg-yellow-50 px-4 py-2 border-b border-yellow-100 flex items-center justify-between animate-fade-in">
                <div className="flex items-center gap-2 text-yellow-800 text-sm font-medium">
                    <Clock size={16} />
                    <span>Chú ý: Có {approachingCount} hồ sơ sắp tới hạn trong 2 ngày tới.</span>
                </div>
                <button 
                    onClick={() => { setShowApproachingOnly(true); setShowOverdueOnly(false); }}
                    className="text-xs bg-white border border-yellow-200 text-yellow-700 px-3 py-1 rounded-full hover:bg-yellow-100 transition-colors font-semibold"
                >
                    Xem hồ sơ sắp tới hạn
                </button>
            </div>
        )}

        <div className="p-4 border-b border-gray-100 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    {currentView === 'check_list' ? 'Danh sách Trình Ký' : 
                    currentView === 'handover_list' ? 'Danh sách Trả Kết Quả' : 
                    currentView === 'assign_tasks' ? 'Giao Hồ Sơ Mới' :
                    'Danh sách Hồ sơ'}
                    {!canPerformAction && <span className="text-xs font-normal text-gray-500 px-2 py-0.5 bg-gray-100 rounded-full border">Chỉ xem</span>}
                </h2>
                <div className="flex w-full sm:w-auto gap-3">
                    <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Mã HS, Tên, SĐT, Xã/Phường, Tờ, Thửa..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-2 rounded-lg relative">
                 {/* ---------------- BỘ LỌC NGÀY MỚI (CHỈ HIỂN THỊ NẾU KHÔNG PHẢI LIST GIAO 1 CỬA) ---------------- */}
                 {currentView !== 'handover_list' && (
                     <>
                        {/* Lọc 1 ngày cơ bản */}
                        {!showAdvancedDateFilter && (
                             <div className="flex items-center gap-2 bg-white px-2 py-1.5 border border-gray-200 rounded-md shadow-sm">
                                <Calendar size={16} className="text-gray-500" />
                                <input 
                                    type="date" 
                                    value={filterSpecificDate}
                                    onChange={(e) => setFilterSpecificDate(e.target.value)}
                                    className="text-sm outline-none bg-transparent text-gray-700"
                                    title="Lọc theo ngày tiếp nhận"
                                />
                                {filterSpecificDate && (
                                    <button onClick={() => setFilterSpecificDate('')} className="text-gray-400 hover:text-red-500">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Lọc nâng cao: Khoảng thời gian */}
                        {showAdvancedDateFilter && (
                            <div className="flex items-center gap-2 bg-blue-50 px-2 py-1.5 border border-blue-200 rounded-md shadow-sm animate-fade-in">
                                <span className="text-xs font-semibold text-blue-700">Từ:</span>
                                <input 
                                    type="date" 
                                    value={filterFromDate}
                                    onChange={(e) => setFilterFromDate(e.target.value)}
                                    className="text-sm outline-none bg-transparent text-blue-800 w-32"
                                />
                                <span className="text-xs font-semibold text-blue-700">Đến:</span>
                                <input 
                                    type="date" 
                                    value={filterToDate}
                                    onChange={(e) => setFilterToDate(e.target.value)}
                                    className="text-sm outline-none bg-transparent text-blue-800 w-32"
                                />
                                 <button onClick={() => { setFilterFromDate(''); setFilterToDate(''); }} className="text-blue-400 hover:text-blue-600">
                                    <X size={14} />
                                </button>
                            </div>
                        )}

                        {/* Nút Toggle Lọc nâng cao */}
                        <button
                            onClick={() => setShowAdvancedDateFilter(!showAdvancedDateFilter)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm border ${
                                showAdvancedDateFilter 
                                ? 'bg-blue-600 text-white border-blue-600' 
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                            title="Lọc khoảng thời gian"
                        >
                            <CalendarRange size={16} /> 
                        </button>
                     </>
                 )}

                {/* Đã bỏ lọc khu vực */}

                <div className="flex items-center gap-2 bg-white px-2 py-1.5 border border-gray-200 rounded-md shadow-sm">
                    <MapPin size={16} className="text-gray-500" />
                    <select
                        value={filterWard}
                        onChange={(e) => setFilterWard(e.target.value)}
                        className="text-sm outline-none bg-transparent text-gray-700 font-medium cursor-pointer border-none focus:ring-0"
                    >
                        <option value="all">Tất cả Xã/Phường</option>
                        {wards.map(w => (
                           <option key={w} value={w}>{w}</option>
                        ))}
                    </select>
                </div>

                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="border border-gray-200 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
                >
                    <option value="all">Tất cả trạng thái</option>
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
                
                {currentView !== 'assign_tasks' && (
                    <select
                        value={filterEmployee}
                        onChange={(e) => setFilterEmployee(e.target.value)}
                        className="border border-gray-200 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
                    >
                        <option value="all">Tất cả nhân viên</option>
                        <option value="unassigned">Chưa giao việc</option>
                        {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                )}

                {isListView && (
                    <div className="flex items-center gap-2 bg-white px-2 py-1 border border-gray-200 rounded-md shadow-sm">
                        <Calendar size={14} className="text-gray-500" />
                        <input 
                            type="date" 
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="text-sm outline-none bg-transparent"
                            title="Ngày xuất danh sách"
                        />
                    </div>
                )}

                {/* Nút lọc Quá hạn/Sắp tới hạn ... */}
                <button
                    onClick={() => { setShowOverdueOnly(!showOverdueOnly); if(!showOverdueOnly) setShowApproachingOnly(false); }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm border ${
                        showOverdueOnly 
                        ? 'bg-red-100 text-red-700 border-red-200' 
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                >
                    <Filter size={16} /> {showOverdueOnly ? 'Đang lọc quá hạn' : 'Lọc quá hạn'}
                </button>

                 <button
                    onClick={() => { setShowApproachingOnly(!showApproachingOnly); if(!showApproachingOnly) setShowOverdueOnly(false); }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm border ${
                        showApproachingOnly 
                        ? 'bg-yellow-100 text-yellow-700 border-yellow-200' 
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                >
                    <Clock size={16} /> {showApproachingOnly ? 'Đang lọc sắp đến hạn' : 'Lọc sắp đến hạn'}
                </button>

                {/* Column Selector ... */}
                 <div className="relative" ref={columnSelectorRef}>
                    <button
                        onClick={() => setShowColumnSelector(!showColumnSelector)}
                        className="flex items-center gap-2 bg-white text-gray-700 px-3 py-1.5 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors text-sm font-medium shadow-sm"
                    >
                        <SlidersHorizontal size={16} /> Cột
                    </button>
                    {showColumnSelector && (
                        <div className="absolute top-full mt-2 left-0 w-60 bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-3 max-h-80 overflow-y-auto animate-fade-in-up">
                            <div className="flex justify-between items-center mb-3 border-b pb-2">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase">Hiển thị cột</h4>
                                <button onClick={resetColumns} className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded">
                                    <RotateCcw size={10} /> Mặc định
                                </button>
                            </div>
                            <div className="space-y-1">
                                {COLUMN_DEFS.map(col => (
                                    <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors select-none">
                                        <input type="checkbox" checked={visibleColumns[col.key]} onChange={() => toggleColumn(col.key)} className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 w-4 h-4" />
                                        <span className="text-sm text-gray-700">{col.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="h-6 w-px bg-gray-300 mx-1 hidden sm:block"></div>

                {canPerformAction && currentView === 'all_records' && (
                    <>
                        <button onClick={() => { setEditingRecord(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm">
                            <Plus size={16} /> Thêm mới
                        </button>
                        <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 transition-colors text-sm font-medium shadow-sm">
                            <FileSpreadsheet size={16} /> Nhập Excel
                        </button>
                    </>
                )}

                {canPerformAction && (currentView === 'all_records' || currentView === 'assign_tasks') && selectedRecordIds.size > 0 && (
                    <button onClick={openBulkAssignModal} className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm">
                        <Users size={16} /> Giao việc ({selectedRecordIds.size})
                    </button>
                )}

                {canPerformAction && isListView && (
                   <>
                    {/* Nút Xuất Excel (Danh sách đã chốt) */}
                    <button className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors text-sm font-medium shadow-sm ml-auto" onClick={() => setIsExportModalOpen(true)}>
                        <FileDown size={16} className="text-green-600" /> Xuất Excel
                    </button>
                    
                    {/* Nút Chốt danh sách (Chỉ hiện ở tab Giao 1 cửa) */}
                    {currentView === 'handover_list' && (
                        <button className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 transition-colors text-sm font-medium shadow-sm" onClick={handleExportBatch}>
                            <FileOutput size={16} /> Chốt danh sách
                        </button>
                    )}

                    {/* Nút Xuất danh sách trình ký (Chỉ hiện ở tab Ký kiểm tra) */}
                    {currentView === 'check_list' && (
                        <>
                            <button className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm" onClick={handleExportSimple}>
                                <FileSpreadsheet size={16} /> Xuất danh sách
                            </button>
                            <button className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1.5 rounded-md hover:bg-purple-700 transition-colors text-sm font-medium shadow-sm" onClick={handleConfirmSignBatch}>
                                <FileSignature size={16} /> Chốt danh sách trình ký
                            </button>
                        </>
                    )}
                   </>
                )}
            </div>
        </div>
        
        {/* Table Content */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
             <thead className="sticky top-0 bg-gray-100 z-10 text-xs font-semibold text-gray-600 uppercase tracking-wider shadow-sm">
              <tr>
                <th className="p-3 border-b w-10 text-center">
                    {canPerformAction ? (
                        <button onClick={toggleSelectAll} className="text-gray-500 hover:text-gray-700">
                            {paginatedRecords.length > 0 && selectedRecordIds.size >= paginatedRecords.length ? <CheckSquare size={16} /> : <Square size={16} />}
                        </button>
                    ) : <Lock size={14} className="text-gray-400 mx-auto" />}
                </th>
                {visibleColumns.code && <th className="p-3 border-b">{renderSortableHeader('Mã Hồ Sơ', 'code')}</th>}
                {visibleColumns.customer && <th className="p-3 border-b">{renderSortableHeader('Chủ Sử Dụng', 'customerName')}</th>}
                {visibleColumns.phone && <th className="p-3 border-b">{renderSortableHeader('Số Điện Thoại', 'phoneNumber')}</th>}
                {visibleColumns.received && <th className="p-3 border-b">{renderSortableHeader('Ngày TN', 'receivedDate')}</th>}
                {visibleColumns.deadline && <th className="p-3 border-b">{renderSortableHeader('Hẹn Trả', 'deadline')}</th>}
                {visibleColumns.ward && <th className="p-3 border-b">{renderSortableHeader('Xã Phường', 'ward')}</th>}
                {visibleColumns.group && <th className="p-3 border-b">{renderSortableHeader('Nhóm', 'group')}</th>}
                {visibleColumns.landInfo && <th className="p-3 border-b text-center">{renderSortableHeader('Thửa / Tờ', 'landPlot')}</th>}
                {visibleColumns.assigned && <th className="p-3 border-b text-center">{renderSortableHeader('Ngày Giao NV', 'assignedDate')}</th>}
                {visibleColumns.completed && <th className="p-3 border-b text-center">{renderSortableHeader('Ngày Giao 1 Cửa', 'completedDate')}</th>}
                {visibleColumns.type && <th className="p-3 border-b">{renderSortableHeader('Loại Hồ Sơ', 'recordType')}</th>}
                {visibleColumns.tech && <th className="p-3 border-b min-w-[120px]">{renderSortableHeader('Trích Đo/Lục', 'measurementNumber')}</th>}
                {visibleColumns.batch && <th className="p-3 border-b text-center">{renderSortableHeader('Danh Sách Xuất', 'exportBatch')}</th>}
                {visibleColumns.status && <th className="p-3 border-b text-center">{renderSortableHeader('Trạng Thái', 'status')}</th>}
                {canPerformAction && <th className="p-3 border-b sticky right-0 bg-gray-100 shadow-l">Thao Tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                {paginatedRecords.length > 0 ? (
                    paginatedRecords.map((record) => {
                        const employee = employees.find(e => e.id === record.assignedTo);
                        const isSelected = selectedRecordIds.has(record.id);
                        const isOverdue = isRecordOverdue(record);
                        const isApproaching = isRecordApproaching(record);
                        
                        return (
                             <tr key={record.id} 
                                className={`transition-all duration-200 group border-l-4 
                                ${isOverdue ? 'bg-red-50 border-l-red-500 hover:bg-red-100' : isApproaching ? 'bg-orange-50 border-l-orange-500 hover:bg-orange-100' : isSelected ? 'bg-blue-50 border-l-blue-500 hover:bg-blue-100' : 'border-l-transparent hover:bg-blue-50/60 hover:shadow-sm'}`}
                                onDoubleClick={() => setViewingRecord(record)}
                            >
                                {/* ... (Nội dung từng dòng giữ nguyên như cũ, chỉ thay đổi logic lấy employee ở trên) */}
                                <td className="p-3 text-center">
                                  {canPerformAction ? (
                                     <button onClick={() => toggleSelectRecord(record.id)} className={`${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>
                                        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                     </button>
                                  ) : <div className="w-4 h-4" />}
                                </td>
                                
                                {visibleColumns.code && (
                                    <td className="p-3 font-medium text-blue-600 cursor-pointer" onClick={() => { 
                                        if(canPerformAction) { setEditingRecord(record); setIsModalOpen(true); } 
                                        else { setViewingRecord(record); }
                                    }}>
                                        {record.code}
                                        {isOverdue && <span className="ml-2 inline-block px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] rounded border border-red-200 font-bold">Quá hạn</span>}
                                    </td>
                                )}
                                
                                {visibleColumns.customer && <td className="p-3 font-medium text-gray-900">{record.customerName}</td>}
                                {visibleColumns.phone && <td className="p-3 text-gray-500">{record.phoneNumber || '--'}</td>}
                                {visibleColumns.received && <td className="p-3 text-gray-600">{formatDate(record.receivedDate)}</td>}
                                {visibleColumns.deadline && (
                                    <td className="p-3">
                                        <div className="flex items-center gap-1">
                                            <span className={`font-medium ${isOverdue ? 'text-red-700' : isApproaching ? 'text-orange-700' : 'text-gray-600'}`}>
                                                {formatDate(record.deadline)}
                                            </span>
                                            {isOverdue && <span title="Quá hạn"><AlertCircle size={14} className="text-red-500 animate-pulse" /></span>}
                                            {isApproaching && <span title="Sắp tới hạn"><Clock size={14} className="text-orange-500 animate-pulse" /></span>}
                                        </div>
                                    </td>
                                )}
                                {visibleColumns.ward && <td className="p-3 text-gray-600">{record.ward || '--'}</td>}
                                {visibleColumns.group && <td className="p-3"><span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{record.group}</span></td>}
                                {visibleColumns.landInfo && (
                                    <td className="p-3 text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-xs font-semibold">T: {record.landPlot || '-'}</span>
                                            <span className="text-xs text-gray-500">TB: {record.mapSheet || '-'}</span>
                                        </div>
                                    </td>
                                )}
                                {visibleColumns.assigned && (
                                    <td className="p-3 text-center">
                                        {record.assignedDate ? (
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs">{formatDate(record.assignedDate)}</span>
                                                {employee && <span className="text-[10px] text-indigo-600 font-medium">({employee.name})</span>}
                                            </div>
                                        ) : '--'}
                                    </td>
                                )}
                                {visibleColumns.completed && <td className="p-3 text-center text-gray-600">{formatDate(record.completedDate) || '--'}</td>}
                                {visibleColumns.type && <td className="p-3 text-gray-600 truncate max-w-[150px]" title={record.recordType}>{record.recordType || 'Chưa phân loại'}</td>}
                                {visibleColumns.tech && (
                                    <td className="p-3">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] font-bold text-gray-500 w-6">TĐ:</span>
                                            {canPerformAction ? (
                                                <input
                                                    type="text"
                                                    className="w-24 text-xs border border-gray-200 rounded px-2 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none transition-all bg-white/50"
                                                    value={record.measurementNumber || ''}
                                                    onChange={(e) => handleQuickUpdate(record.id, 'measurementNumber', e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    placeholder="Số TĐ"
                                                />
                                            ) : <span className="text-xs text-gray-800 font-mono">{record.measurementNumber || '---'}</span>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] font-bold text-gray-500 w-6">TL:</span>
                                            {canPerformAction ? (
                                                <input
                                                    type="text"
                                                    className="w-24 text-xs border border-gray-200 rounded px-2 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none transition-all bg-white/50"
                                                    value={record.excerptNumber || ''}
                                                    onChange={(e) => handleQuickUpdate(record.id, 'excerptNumber', e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    placeholder="Số TL"
                                                />
                                            ) : <span className="text-xs text-gray-800 font-mono">{record.excerptNumber || '---'}</span>}
                                        </div>
                                    </div>
                                    </td>
                                )}
                                {visibleColumns.batch && (
                                    <td className="p-3 text-center">
                                        {record.exportBatch ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200 whitespace-nowrap">
                                                Đợt {record.exportBatch}
                                                <span className="ml-1 text-[10px] text-green-700">({formatDate(record.exportDate)})</span>
                                            </span>
                                        ) : '-'}
                                    </td>
                                )}
                                {visibleColumns.status && <td className="p-3 text-center"><StatusBadge status={record.status} /></td>}
                                
                                {canPerformAction && (
                                    <td className={`p-3 sticky right-0 shadow-l text-center ${isOverdue ? 'bg-red-50 group-hover:bg-red-100' : isApproaching ? 'bg-orange-50 group-hover:bg-orange-100' : 'bg-white group-hover:bg-blue-50/60'}`}>
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={(e) => { e.stopPropagation(); setViewingRecord(record); }} className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Xem chi tiết"><Eye size={16} /></button>
                                            <button onClick={(e) => { e.stopPropagation(); setEditingRecord(record); setIsModalOpen(true); }} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Chỉnh sửa"><Pencil size={16} /></button>
                                            
                                            {/* LOGIC NÚT ĐIỀU HƯỚNG */}
                                            {record.status === RecordStatus.PENDING_SIGN ? (
                                                <button onClick={(e) => { e.stopPropagation(); advanceStatus(record, RecordStatus.SIGNED); }} className="p-1.5 text-purple-600 hover:bg-purple-100 rounded-full transition-colors flex items-center gap-1 font-bold" title="Đã ký duyệt (Chuyển sang Giao 1 cửa)">
                                                    <PenTool size={16} /> 
                                                </button>
                                            ) : record.status !== RecordStatus.HANDOVER && currentView !== 'handover_list' && (
                                                <button onClick={(e) => { e.stopPropagation(); advanceStatus(record); }} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-full transition-colors" title={record.status === RecordStatus.RECEIVED ? "Giao việc" : "Chuyển bước tiếp theo"}><ArrowRight size={16} /></button>
                                            )}
                                            {record.status === RecordStatus.HANDOVER && <CheckCircle size={16} className="text-green-500" />}
                                            
                                            {hasAdminRights && (
                                                <button onClick={(e) => { e.stopPropagation(); confirmDelete(record); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Xóa hồ sơ"><Trash2 size={16} /></button>
                                            )}
                                        </div>
                                    </td>
                                )}
                             </tr>
                        );
                    })
                ) : (
                    <tr>
                      <td colSpan={15} className="p-12 text-center text-gray-400">
                        {showApproachingOnly ? "Không có hồ sơ nào sắp tới hạn." : showOverdueOnly ? "Không có hồ sơ nào bị quá hạn." : "Không tìm thấy hồ sơ phù hợp."}
                      </td>
                    </tr>
                )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Footer */}
        <div className="border-t border-gray-200 px-4 py-3 flex items-center justify-between bg-white">
             <div className="flex items-center gap-2">
                 <span className="text-sm text-gray-600">
                     Hiển thị {paginatedRecords.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} đến {Math.min(currentPage * itemsPerPage, filteredRecords.length)} trong tổng số <strong>{filteredRecords.length}</strong> hồ sơ
                 </span>
                 <select 
                    value={itemsPerPage} 
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="ml-2 border border-gray-300 rounded text-sm px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                 >
                     <option value={10}>10 dòng</option>
                     <option value={20}>20 dòng</option>
                     <option value={50}>50 dòng</option>
                     <option value={100}>100 dòng</option>
                 </select>
             </div>
             
             <div className="flex items-center gap-1">
                 <button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
                 >
                     <ChevronLeft size={20} />
                 </button>
                 {/* ... (Phân trang logic giữ nguyên) */}
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, idx) => {
                     let pageNum = idx + 1;
                     if (totalPages > 5) {
                         if (currentPage > 3) pageNum = currentPage - 2 + idx;
                         if (pageNum > totalPages) pageNum = totalPages - (4 - idx);
                     }
                     if (pageNum <= 0 || pageNum > totalPages) return null;
                     return (
                         <button
                             key={pageNum}
                             onClick={() => setCurrentPage(pageNum)}
                             className={`w-8 h-8 rounded text-sm font-medium ${currentPage === pageNum ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-700'}`}
                         >
                             {pageNum}
                         </button>
                     );
                 })}
                 <button 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
                 >
                     <ChevronRight size={20} />
                 </button>
             </div>
        </div>
      </div>
    );
  };

  if (!currentUser) {
    return <Login onLogin={setCurrentUser} users={users} />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenSystemSettings={() => setIsSystemSettingsOpen(true)}
        currentUser={currentUser}
        onLogout={() => setCurrentUser(null)}
      />
      
      <main className="flex-1 p-4 h-screen overflow-hidden flex flex-col">
        <header className="flex justify-between items-center mb-6 shrink-0">
          {/* Header Title giữ nguyên */}
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {currentView === 'dashboard' ? 'Tổng quan hệ thống' : 
               currentView === 'reports' ? 'Báo cáo & Thống kê' : 
               currentView === 'personal_profile' ? 'Hồ sơ cá nhân' :
               currentView === 'user_management' ? 'Quản trị hệ thống' : 
               currentView === 'excerpt_management' ? 'Cấp Số Trích Lục' : 
               currentView === 'assign_tasks' ? 'Giao Hồ Sơ (Chưa phân công)' : 'Quản lý hồ sơ địa chính'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
             {connectionStatus === 'connected' ? (
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-green-200 shadow-sm text-green-700">
                    <Wifi size={14} /> <span className="text-xs font-bold">Online (Server)</span>
                </div>
             ) : (
                <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-full border border-red-200 shadow-sm text-red-700">
                    <WifiOff size={14} /> <span className="text-xs font-bold">Offline (Dữ liệu mẫu)</span>
                </div>
             )}
          </div>
        </header>
        <div className="flex-1 overflow-hidden flex flex-col">{renderMainContent()}</div>
      </main>

      <RecordModal 
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingRecord(null); }}
        onSubmit={handleAddOrUpdate}
        initialData={editingRecord}
        employees={employees}
        currentUser={currentUser}
        wards={wards}
      />
      
      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onImport={handleImportRecords} 
        employees={employees} 
      />
      
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        employees={employees} 
        onSaveEmployee={handleSaveEmployee}
        onDeleteEmployee={handleDeleteEmployee}
        wards={wards} 
        currentUser={currentUser}
        onDeleteAllData={handleDeleteAllData} 
      />

      <SystemSettingsModal 
        isOpen={isSystemSettingsOpen} 
        onClose={() => setIsSystemSettingsOpen(false)} 
        onDeleteAllData={handleDeleteAllData}
      />

      <AssignModal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} onConfirm={confirmAssign} employees={employees} selectedRecords={assignTargetRecords} />
      <DetailModal isOpen={!!viewingRecord} onClose={() => setViewingRecord(null)} record={viewingRecord} employees={employees} />
      <DeleteConfirmModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDeleteRecord} message={`Bạn có chắc chắn muốn xóa hồ sơ ${deletingRecord?.code}?`} />
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} records={records} wards={wards} />
    </div>
  );
}

export default App;
