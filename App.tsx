
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { RecordFile, RecordStatus, Employee, User, UserRole, Message } from './types';
import { STATUS_LABELS, WARDS as DEFAULT_WARDS, getShortRecordType, getNormalizedWard, APP_VERSION } from './constants';
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
import ReceiveRecord from './components/ReceiveRecord'; 
import ReceiveContract from './components/ReceiveContract'; 
import InternalChat from './components/InternalChat'; 
import ExcelPreviewModal from './components/ExcelPreviewModal';
import AccountSettingsView from './components/AccountSettingsView';
import AddToBatchModal from './components/AddToBatchModal';
import { generateReport } from './services/geminiService';
import { syncTemplatesFromCloud } from './services/docxService'; // IMPORT SYNC TEMPLATE
import { 
    fetchRecords, createRecordApi, updateRecordApi, deleteRecordApi, deleteAllDataApi, createRecordsBatchApi,
    fetchEmployees, saveEmployeeApi, deleteEmployeeApi,
    fetchUsers, saveUserApi, deleteUserApi, fetchUpdateInfo
} from './services/api';
import { supabase } from './services/supabaseClient';
import * as XLSX from 'xlsx-js-style';
import { 
  Plus, Search, ArrowRight, FileCheck, CheckCircle, 
  RefreshCw, Calendar, FileOutput, Loader2,
  BarChart3, FileText, CheckSquare, Square, Users, FileSpreadsheet,
  SlidersHorizontal, AlertTriangle, AlertCircle, Filter, Pencil, RotateCcw, Eye, Trash2, CalendarRange, Clock, FileDown, Lock, Download, WifiOff, Wifi,
  ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, BellRing, MapPin, PenTool, Sparkles, X, FileSignature, Menu, FolderInput, ListChecks, History
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// --- HÀM TIỆN ÍCH XỬ LÝ CHUỖI TIẾNG VIT ---
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
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); 
    str = str.replace(/\u02C6|\u0306|\u031B/g, ""); 
    str = str.replace(/ + /g, " ");
    str = str.trim();
    return str;
}

// Hàm chuyển đổi Title Case (Nguyễn Văn A)
function toTitleCase(str: string | undefined): string {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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

const DEFAULT_VISIBLE_COLUMNS = {
    code: true, customer: true, phone: false, received: true, deadline: true,
    ward: true, group: false, landInfo: true, assigned: true, completed: false,
    type: true, tech: false, batch: false, status: true
};

// --- CÁC HÀM TIỆN ÍCH ---
const isRecordOverdue = (record: RecordFile): boolean => {
  if (record.status === RecordStatus.HANDOVER) return false;
  if (!record.deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
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

// --- COMPONENTS CON CHO DASHBOARD ---
const DashboardChart = ({ data }: { data: any[] }) => (
  <div style={{ width: '100%', height: '100%', minHeight: '300px' }}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis fontSize={12} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

// --- COMPONENT BÁO CÁO (ReportSection) ---
interface ReportSectionProps {
    reportContent: string;
    isGenerating: boolean;
    onGenerate: (fromDate: string, toDate: string) => void;
    onExportExcel: (fromDate: string, toDate: string) => void; // Add Excel Export Handler
}

const ReportSection: React.FC<ReportSectionProps> = ({ reportContent, isGenerating, onGenerate, onExportExcel }) => {
    // Mặc định: Từ ngày đầu tháng đến hiện tại
    const [fromDate, setFromDate] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    });
    const [toDate, setToDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });

    const handleGenerateClick = () => {
        if (!fromDate || !toDate) {
            alert("Vui lòng chọn đầy đủ Từ ngày và Đến ngày.");
            return;
        }
        if (new Date(fromDate) > new Date(toDate)) {
            alert("Ngày bắt đầu không được lớn hơn ngày kết thúc.");
            return;
        }
        onGenerate(fromDate, toDate);
    };

    const handleExcelClick = () => {
        if (!fromDate || !toDate) {
            alert("Vui lòng chọn đầy đủ Từ ngày và Đến ngày.");
            return;
        }
        onExportExcel(fromDate, toDate);
    };

    const handleDownloadReport = () => {
        if (!reportContent) return;
        
        // Tạo file HTML đầy đủ
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Báo cáo hồ sơ</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    body { font-family: 'Inter', system-ui, sans-serif; padding: 2rem; background-color: #fff; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                ${reportContent}
            </body>
            </html>
        `;

        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Bao_Cao_${fromDate}_den_${toDate}.html`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-full gap-4 overflow-hidden">
            {/* Toolbar - CỐ ĐỊNH */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="bg-purple-100 p-2 rounded-lg">
                        <BarChart3 className="text-purple-600" size={24} />
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-800 text-lg">Báo cáo & Thống kê</h2>
                        <p className="text-xs text-gray-500">Tổng hợp số liệu theo tuần/tháng</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-600">Từ ngày:</span>
                        <input 
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-600">Đến ngày:</span>
                        <input 
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white"
                        />
                    </div>

                    <button 
                        onClick={handleExcelClick}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-all shadow-md font-bold text-sm ml-2"
                        title="Xuất file Excel để nộp báo cáo"
                    >
                        <FileSpreadsheet size={16} /> Xuất Excel
                    </button>

                    <button 
                        onClick={handleGenerateClick}
                        disabled={isGenerating}
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-md hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 transition-all shadow-md font-bold text-sm"
                    >
                        {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                        {isGenerating ? 'AI đang viết...' : 'AI Phân tích'}
                    </button>

                    {reportContent && (
                        <button 
                            onClick={handleDownloadReport}
                            className="flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-3 py-2 rounded-md hover:bg-gray-50 transition-all shadow-sm font-medium text-sm"
                            title="Tải báo cáo AI về máy (HTML)"
                        >
                            <Download size={16} /> Lưu HTML
                        </button>
                    )}
                </div>
            </div>

            {/* Result Area - CUỘN ĐỘC LẬP */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative">
                {isGenerating && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                        <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-4" />
                        <p className="text-lg font-medium text-purple-800">AI đang phân tích dữ liệu...</p>
                        <p className="text-sm text-gray-500">Vui lòng đợi trong giây lát</p>
                    </div>
                )}
                
                <div className="h-full overflow-y-auto p-8 custom-scrollbar">
                    {reportContent ? (
                        <div 
                            className="prose max-w-none text-gray-800 report-content"
                            dangerouslySetInnerHTML={{ __html: reportContent }}
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                            <BarChart3 size={64} className="mb-4 text-gray-300" />
                            <p className="text-lg font-medium">Chọn thời gian để tạo báo cáo</p>
                            <p className="text-sm text-center max-w-md mt-2">
                                Bạn có thể xuất file Excel thống kê chi tiết hoặc dùng AI để phân tích và nhận xét tình hình hồ sơ.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- MAIN APP COMPONENT ---
function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [records, setRecords] = useState<RecordFile[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'offline'>('connected');
  
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [updateUrl, setUpdateUrl] = useState<string | null>(null);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  const [wards, setWards] = useState<string[]>(() => {
    const saved = localStorage.getItem('wards_list');
    return saved ? JSON.parse(saved) : DEFAULT_WARDS;
  });

  // --- FILTER & PAGINATION STATES ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [filterDate, setFilterDate] = useState(''); 
  const [filterSpecificDate, setFilterSpecificDate] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [showAdvancedDateFilter, setShowAdvancedDateFilter] = useState(false);
  
  const [filterWard, setFilterWard] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterEmployee, setFilterEmployee] = useState('all');
  
  // NEW: Warning Filter State - 'none', 'overdue', 'approaching'
  const [warningFilter, setWarningFilter] = useState<'none' | 'overdue' | 'approaching'>('none');

  // --- STATE CHO HANDOVER TABS ---
  const [handoverTab, setHandoverTab] = useState<'today' | 'history'>('today');

  const [sortConfig, setSortConfig] = useState<{ key: keyof RecordFile | string; direction: 'asc' | 'desc' }>({
    key: 'receivedDate',
    direction: 'desc'
  });

  // --- SELECTION & VISIBILITY STATES ---
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
      try {
          const saved = localStorage.getItem('visible_columns');
          return saved ? JSON.parse(saved) : DEFAULT_VISIBLE_COLUMNS;
      } catch {
          return DEFAULT_VISIBLE_COLUMNS;
      }
  });

  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const columnSelectorRef = useRef<HTMLDivElement>(null);

  // --- MODAL STATES ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecordFile | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSystemSettingsOpen, setIsSystemSettingsOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTargetRecords, setAssignTargetRecords] = useState<RecordFile[]>([]);
  const [viewingRecord, setViewingRecord] = useState<RecordFile | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<RecordFile | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalType, setExportModalType] = useState<'handover' | 'check_list'>('handover');
  const [isAddToBatchModalOpen, setIsAddToBatchModalOpen] = useState(false);

  // States for Excel Preview
  const [isExcelPreviewOpen, setIsExcelPreviewOpen] = useState(false);
  const [previewWorkbook, setPreviewWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [previewExcelName, setPreviewExcelName] = useState('');

  // --- STATE BÁO CÁO TOÀN CỤC ---
  const [globalReportContent, setGlobalReportContent] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // --- STATE THÔNG BÁO ---
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [warningCount, setWarningCount] = useState({ overdue: 0, approaching: 0 });

  // --- PERMISSIONS ---
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isSubadmin = currentUser?.role === UserRole.SUBADMIN;
  const isTeamLeader = currentUser?.role === UserRole.TEAM_LEADER;
  // Cập nhật: Cho phép TeamLeader thực hiện các hành động quản lý (Giao việc, Sửa, vv)
  const canPerformAction = isAdmin || isSubadmin || isTeamLeader;

  // --- EFFECTS ---
  useEffect(() => {
      loadData();
      // Đồng bộ template từ Cloud khi App chạy
      syncTemplatesFromCloud();
      
      const interval = setInterval(loadData, 30000); 
      return () => clearInterval(interval);
  }, []);

  // --- FUNCTION: Kiểm tra xem hồ sơ có thuộc phạm vi quản lý của User không ---
  // Dùng để lọc hiển thị cảnh báo (Warning)
  const checkWarningPermission = (r: RecordFile) => {
      if (!currentUser) return false;
      // OneDoor không cần cảnh báo tiến độ kiểu này
      if (currentUser.role === UserRole.ONEDOOR) return false;
      
      // Admin thấy hết
      if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN) return true;

      // Nhân viên chỉ thấy hồ sơ của mình
      if (currentUser.role === UserRole.EMPLOYEE) {
          return r.assignedTo === currentUser.employeeId;
      }

      // Nhóm trưởng thấy hồ sơ của mình HOẶC hồ sơ thuộc xã mình quản lý
      if (currentUser.role === UserRole.TEAM_LEADER) {
          const leaderEmp = employees.find(e => e.id === currentUser.employeeId);
          if (!leaderEmp) return false; 
          
          const isMyTask = r.assignedTo === currentUser.employeeId;
          const isMyWard = leaderEmp.managedWards.some(w => r.ward && r.ward.includes(w));
          
          return isMyTask || isMyWard;
      }
      
      return false; 
  };

  // Tính toán số lượng hồ sơ cảnh báo DỰA TRÊN ROLE và LOẠI CẢNH BÁO
  useEffect(() => {
      if (records.length > 0 && currentUser) {
          let overdue = 0;
          let approaching = 0;

          records.forEach(r => {
              if (r.status === RecordStatus.HANDOVER) return; // Bỏ qua đã xong
              if (!checkWarningPermission(r)) return; // Bỏ qua không thuộc quyền

              if (isRecordOverdue(r)) overdue++;
              else if (isRecordApproaching(r)) approaching++;
          });

          setWarningCount({ overdue, approaching });
      } else {
          setWarningCount({ overdue: 0, approaching: 0 });
      }
  }, [records, currentUser, employees]);

  // Global Chat Listener
  useEffect(() => {
      // Chỉ lắng nghe khi user đã đăng nhập và KHÔNG ở màn hình chat
      if (!currentUser) return;

      const channel = supabase
          .channel('global-chat-listener')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
              const newMsg = payload.new as Message;
              
              // Bỏ qua tin nhắn của chính mình
              if (newMsg.sender_username === currentUser.username) return;

              // Nếu đang không ở màn hình chat, tăng biến đếm
              if (currentView !== 'internal_chat') {
                  setUnreadMessages(prev => prev + 1);
              }
          })
          .subscribe();

      return () => {
          supabase.removeChannel(channel);
      };
  }, [currentUser, currentView]);

  useEffect(() => {
      localStorage.setItem('visible_columns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
      // Đóng dropdown cột khi click ra ngoài
      const handleClickOutside = (event: MouseEvent) => {
        if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
          setShowColumnSelector(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
      setCurrentPage(1);
  }, [currentView, sortConfig, warningFilter, filterWard, filterStatus, filterEmployee, filterSpecificDate, filterFromDate, filterToDate, handoverTab]);


  const loadData = async () => {
      try {
          const [recData, empData, userData, updateInfo] = await Promise.all([
              fetchRecords(),
              fetchEmployees(),
              fetchUsers(),
              fetchUpdateInfo()
          ]);
          setRecords(recData);
          setEmployees(empData);
          setUsers(userData);
          setConnectionStatus('connected');

          if (updateInfo.version && updateInfo.version !== APP_VERSION) {
              setIsUpdateAvailable(true);
              setLatestVersion(updateInfo.version);
              setUpdateUrl(updateInfo.url);
          }
      } catch (error) {
          console.error("Lỗi tải dữ liệu:", error);
          setConnectionStatus('offline');
      }
  };

  // --- HANDLE EXPORT EXCEL REPORT ---
  const handleExportReportExcel = (fromDateStr: string, toDateStr: string) => {
      if (!currentUser) return;

      const from = new Date(fromDateStr);
      from.setHours(0, 0, 0, 0);
      const to = new Date(toDateStr);
      to.setHours(23, 59, 59, 999);

      // Filter records
      const filtered = records.filter(r => {
          if (!r.receivedDate) return false;
          const rDate = new Date(r.receivedDate);
          return rDate >= from && rDate <= to;
      });

      if (filtered.length === 0) {
          alert("Không có hồ sơ nào trong khoảng thời gian này.");
          return;
      }

      // Prepare Data
      const formatDate = (d: string) => {
          if (!d) return '';
          const date = new Date(d);
          return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
      };

      // Summary Stats
      let total = filtered.length;
      let completed = filtered.filter(r => r.status === RecordStatus.HANDOVER).length;
      let processing = total - completed;
      let overdue = filtered.filter(r => isRecordOverdue(r)).length;

      // Table Header
      const tableHeader = ["STT", "Mã Hồ Sơ", "Chủ Sử Dụng", "Địa Chỉ (Xã)", "Loại Hồ Sơ", "Ngày Nhận", "Hẹn Trả", "Ngày Xong", "Trạng Thái", "Ghi Chú"];
      
      const dataRows = filtered.map((r, i) => [
          i + 1,
          r.code,
          r.customerName,
          getNormalizedWard(r.ward),
          getShortRecordType(r.recordType),
          formatDate(r.receivedDate),
          formatDate(r.deadline),
          formatDate(r.completedDate || ''),
          STATUS_LABELS[r.status],
          r.notes || ''
      ]);

      // Generate Workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([]);

      // Styles
      const titleStyle = { font: { name: "Times New Roman", sz: 14, bold: true }, alignment: { horizontal: "center" } };
      const subTitleStyle = { font: { name: "Times New Roman", sz: 12, italic: true }, alignment: { horizontal: "center" } };
      const headerStyle = { 
          font: { name: "Times New Roman", sz: 11, bold: true }, 
          border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }, 
          fill: { fgColor: { rgb: "E0E0E0" } }, 
          alignment: { horizontal: "center", vertical: "center", wrapText: true } 
      };
      const cellStyle = { 
          font: { name: "Times New Roman", sz: 11 }, 
          border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } },
          alignment: { vertical: "center", wrapText: true }
      };
      const centerStyle = { ...cellStyle, alignment: { horizontal: "center", vertical: "center" } };

      // Content Injection
      XLSX.utils.sheet_add_aoa(ws, [
          ["CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM"],
          ["Độc lập - Tự do - Hạnh phúc"],
          [""],
          ["BÁO CÁO TÌNH HÌNH TIẾP NHẬN VÀ GIẢI QUYẾT HỒ SƠ"],
          [`Từ ngày ${formatDate(fromDateStr)} đến ngày ${formatDate(toDateStr)}`],
          [""],
          [`Tổng số: ${total} | Đã xong: ${completed} | Đang giải quyết: ${processing} | Trễ hạn: ${overdue}`],
          [""],
          tableHeader
      ], { origin: "A1" });

      XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A10" });

      // Formatting
      ws['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
          { s: { r: 3, c: 0 }, e: { r: 3, c: 9 } },
          { s: { r: 4, c: 0 }, e: { r: 4, c: 9 } },
          { s: { r: 6, c: 0 }, e: { r: 6, c: 9 } }
      ];
      ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 20 }];

      // Apply Styles
      if(ws['A1']) ws['A1'].s = titleStyle;
      if(ws['A2']) ws['A2'].s = { font: { name: "Times New Roman", sz: 12, bold: true, underline: true }, alignment: { horizontal: "center" } };
      if(ws['A4']) ws['A4'].s = { font: { name: "Times New Roman", sz: 16, bold: true, color: { rgb: "0000FF" } }, alignment: { horizontal: "center" } };
      if(ws['A5']) ws['A5'].s = subTitleStyle;
      if(ws['A7']) ws['A7'].s = { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center" }, fill: { fgColor: { rgb: "FFFACD" } } };

      // Table Styles
      for (let c = 0; c < 10; c++) {
          const headerRef = XLSX.utils.encode_cell({ r: 9, c });
          if (!ws[headerRef]) ws[headerRef] = { v: "", t: "s" };
          ws[headerRef].s = headerStyle;

          for (let r = 10; r < 10 + dataRows.length; r++) {
              const cellRef = XLSX.utils.encode_cell({ r, c });
              if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
              if ([0, 5, 6, 7, 8].includes(c)) ws[cellRef].s = centerStyle;
              else ws[cellRef].s = cellStyle;
          }
      }

      // Footer
      const lastRow = 9 + dataRows.length + 2;
      XLSX.utils.sheet_add_aoa(ws, [
          ["NGƯỜI LẬP BIỂU", "", "", "", "", "", "", "THỦ TRƯỞNG ĐƠN VỊ"],
          ["(Ký, họ tên)", "", "", "", "", "", "", "(Ký, họ tên, đóng dấu)"]
      ], { origin: `A${lastRow}` });
      
      ws['!merges'].push(
          { s: { r: lastRow - 1, c: 0 }, e: { r: lastRow - 1, c: 2 } },
          { s: { r: lastRow, c: 0 }, e: { r: lastRow, c: 2 } },
          { s: { r: lastRow - 1, c: 7 }, e: { r: lastRow - 1, c: 9 } },
          { s: { r: lastRow, c: 7 }, e: { r: lastRow, c: 9 } }
      );
      
      const footerStyle = { font: { name: "Times New Roman", sz: 12, bold: true }, alignment: { horizontal: "center" } };
      const footerNoteStyle = { font: { name: "Times New Roman", sz: 11, italic: true }, alignment: { horizontal: "center" } };
      
      const leftTitle = XLSX.utils.encode_cell({r: lastRow - 1, c: 0});
      const rightTitle = XLSX.utils.encode_cell({r: lastRow - 1, c: 7});
      if(ws[leftTitle]) ws[leftTitle].s = footerStyle;
      if(ws[rightTitle]) ws[rightTitle].s = footerStyle;

      XLSX.utils.book_append_sheet(wb, ws, "Bao Cao");
      const fileName = `Bao_Cao_${fromDateStr}_${toDateStr}.xlsx`;
      XLSX.writeFile(wb, fileName);
  };

  // --- HANDLE UPDATE CURRENT ACCOUNT ---
  const handleUpdateCurrentAccount = async (data: { name: string; password?: string; department?: string }) => {
      if (!currentUser) return false;

      try {
        // 1. Update User Record
        const updatedUser: User = {
            ...currentUser,
            name: data.name,
            ...(data.password ? { password: data.password } : {})
        };

        const savedUser = await saveUserApi(updatedUser, true);
        if (!savedUser) return false;

        // 2. Update Employee Record if linked
        if (currentUser.employeeId && data.department) {
            const emp = employees.find(e => e.id === currentUser.employeeId);
            if (emp) {
                const updatedEmp = { ...emp, department: data.department };
                const savedEmp = await saveEmployeeApi(updatedEmp, true);
                if (savedEmp) {
                    setEmployees(prev => prev.map(e => e.id === emp.id ? savedEmp : e));
                }
            }
        }

        // 3. Update Local State
        setUsers(prev => prev.map(u => u.username === currentUser.username ? savedUser : u));
        setCurrentUser(savedUser);
        loadData();
        return true;
      } catch (error) {
        console.error("Lỗi cập nhật tài khoản:", error);
        return false;
      }
  };

  // --- REPORT GENERATION ---
  const handleGlobalGenerateReport = async (fromDateStr: string, toDateStr: string) => {
      if (!currentUser) return;
      setIsGeneratingReport(true);
      setGlobalReportContent(''); 

      const from = new Date(fromDateStr);
      from.setHours(0, 0, 0, 0); 

      const to = new Date(toDateStr);
      to.setHours(23, 59, 59, 999); 

      const filtered = records.filter(r => {
          if(!r.receivedDate) return false;
          const rDate = new Date(r.receivedDate);
          return rDate >= from && rDate <= to;
      });

      const formatDateVN = (d: Date) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
      const timeLabel = `Từ ngày ${formatDateVN(from)} đến ngày ${formatDateVN(to)}`;

      try {
          const scope = currentUser.role === UserRole.EMPLOYEE ? 'personal' : 'general';
          const result = await generateReport(filtered, timeLabel, scope, currentUser.name);
          setGlobalReportContent(result);
      } catch (error) {
          setGlobalReportContent("Không thể tạo báo cáo. Vui lòng kiểm tra API Key.");
      } finally {
          setIsGeneratingReport(false);
      }
  };

  // --- LOGIC FILTER ---
  const filteredRecords = useMemo(() => {
      // 1. DEDUPLICATION
      const uniqueMap = new Map();
      records.forEach(r => { if(r.id) uniqueMap.set(r.id, r); });
      let result = Array.from(uniqueMap.values()) as RecordFile[];

      // 2. View specific filtering
      if (currentView === 'check_list') {
          result = result.filter(r => r.status === RecordStatus.PENDING_SIGN);
      } else if (currentView === 'handover_list') {
          // --- LOGIC MỚI CHO HANDOVER TABS ---
          if (handoverTab === 'today') {
              // Tab "Hồ sơ hôm nay / Chờ giao": Hiển thị các hồ sơ đã ký, chờ chốt danh sách
              result = result.filter(r => r.status === RecordStatus.SIGNED);
          } else {
              // Tab "Lịch sử đã giao": Hiển thị các hồ sơ đã Handover
              result = result.filter(r => r.status === RecordStatus.HANDOVER);
              // Chỉ áp dụng lọc ngày cho tab lịch sử
              if (filterDate) {
                  result = result.filter(r => r.exportDate?.startsWith(filterDate));
              }
          }
      } else if (currentView === 'assign_tasks') {
          result = result.filter(r => r.status === RecordStatus.RECEIVED);
      }

      // 3. Search Text
      if (searchTerm) {
          const lowerSearch = removeVietnameseTones(searchTerm);
          result = result.filter(r => {
              if (removeVietnameseTones(r.code).includes(lowerSearch)) return true;
              if (removeVietnameseTones(r.customerName).includes(lowerSearch)) return true;
              if (r.phoneNumber && r.phoneNumber.includes(searchTerm)) return true;
              if (removeVietnameseTones(r.ward || '').includes(lowerSearch)) return true;
              if (removeVietnameseTones(r.landPlot || '').includes(lowerSearch)) return true;
              if (removeVietnameseTones(r.mapSheet || '').includes(lowerSearch)) return true;
              return false;
          });
      }

      // 4. Filters (Common)
      if (filterWard !== 'all') {
          const wardSearch = removeVietnameseTones(filterWard);
          result = result.filter(r => removeVietnameseTones(r.ward || '').includes(wardSearch));
      }
      if (filterStatus !== 'all' && currentView !== 'handover_list') {
          // Trong handover_list, status được kiểm soát bởi Tab, không dùng filterStatus chung
          result = result.filter(r => r.status === filterStatus);
      }
      if (filterEmployee !== 'all' && currentView !== 'assign_tasks') {
          if (filterEmployee === 'unassigned') result = result.filter(r => !r.assignedTo);
          else result = result.filter(r => r.assignedTo === filterEmployee);
      }

      // 5. Date Filters
      // Chỉ áp dụng lọc ngày nâng cao cho các view danh sách chính, trừ các view đặc thù
      if (currentView !== 'handover_list') {
          if (filterSpecificDate) {
              result = result.filter(r => r.receivedDate === filterSpecificDate);
          } else if (showAdvancedDateFilter) {
              if (filterFromDate || filterToDate) {
                  result = result.filter(r => {
                      if (!r.receivedDate) return false;
                      const rDate = r.receivedDate;
                      if (filterFromDate && rDate < filterFromDate) return false;
                      if (filterToDate && rDate > filterToDate) return false;
                      return true;
                  });
              }
          }
      }

      // 6. Special Filters (Warning Mode - UPDATED)
      if (warningFilter !== 'none' && currentUser) {
          if (warningFilter === 'overdue') {
              result = result.filter(r => isRecordOverdue(r) && checkWarningPermission(r));
          } else if (warningFilter === 'approaching') {
              result = result.filter(r => isRecordApproaching(r) && checkWarningPermission(r));
          }
      }

      // 7. Sorting
      result.sort((a, b) => {
          let aVal: any = a[sortConfig.key as keyof RecordFile];
          let bVal: any = b[sortConfig.key as keyof RecordFile];
          if (!aVal) return 1; if (!bVal) return -1;
          if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });

      return result;
  }, [records, searchTerm, filterWard, filterStatus, filterEmployee, filterDate, filterSpecificDate, filterFromDate, filterToDate, showAdvancedDateFilter, warningFilter, currentView, sortConfig, handoverTab, currentUser, employees]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  // --- HANDLERS (OPTIMIZED FOR SPEED) ---
  const handleAddOrUpdate = async (recordData: any) => {
      // 1. Kiểm tra xem là Sửa hay Thêm
      const isEdit = recordData.id && records.find(r => r.id === recordData.id);
      
      if (isEdit) {
          // GỌI API SỬA
          const updated = await updateRecordApi(recordData);
          if (updated) {
              // CẬP NHẬT LOCAL STATE NGAY LẬP TỨC (Không gọi loadData)
              setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
              setIsModalOpen(false);
              setEditingRecord(null);
          }
      } else {
          // GỌI API THÊM
          const newRecord = await createRecordApi({ ...recordData, id: Math.random().toString(36).substr(2, 9) });
          if (newRecord) {
              // CẬP NHẬT LOCAL STATE NGAY LẬP TỨC
              setRecords(prev => [newRecord, ...prev]);
              setIsModalOpen(false);
              setEditingRecord(null);
          }
      }
  };

  const handleDeleteRecord = async () => {
      if (deletingRecord) {
          const success = await deleteRecordApi(deletingRecord.id);
          if (success) {
              // CẬP NHẬT LOCAL STATE NGAY LẬP TỨC
              setRecords(prev => prev.filter(r => r.id !== deletingRecord.id));
              setDeletingRecord(null);
              setIsDeleteModalOpen(false);
          }
      }
  };

  const handleImportRecords = async (newRecords: RecordFile[]) => {
      const success = await createRecordsBatchApi(newRecords);
      if (success) {
          loadData(); // Bulk import vẫn nên load lại để đảm bảo đồng bộ
          setIsImportModalOpen(false);
          alert(`Đã nhập thành công ${newRecords.length} hồ sơ!`);
      }
  };

  const handleSaveEmployee = async (emp: Employee) => {
      const exists = employees.find(e => e.id === emp.id);
      const savedEmp = await saveEmployeeApi(emp, !!exists);
      if (savedEmp) {
          if (exists) setEmployees(prev => prev.map(e => e.id === savedEmp.id ? savedEmp : e));
          else setEmployees(prev => [...prev, savedEmp]);
      }
  };

  const handleDeleteEmployee = async (id: string) => {
      const success = await deleteEmployeeApi(id);
      if (success) setEmployees(prev => prev.filter(e => e.id !== id));
  };

  const handleDeleteAllData = async () => {
      const success = await deleteAllDataApi();
      if (success) {
          setRecords([]);
          setIsSystemSettingsOpen(false);
          alert("Đã xóa toàn bộ dữ liệu.");
      }
  };

  const toggleSelectAll = () => {
      if (selectedRecordIds.size === paginatedRecords.length && paginatedRecords.length > 0) {
          setSelectedRecordIds(new Set());
      } else {
          const ids = new Set(paginatedRecords.map(r => r.id));
          setSelectedRecordIds(ids);
      }
  };

  const toggleSelectRecord = (id: string) => {
      const newSet = new Set(selectedRecordIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedRecordIds(newSet);
  };

  const openBulkAssignModal = () => {
      const targetRecords = records.filter(r => selectedRecordIds.has(r.id));
      setAssignTargetRecords(targetRecords);
      setIsAssignModalOpen(true);
  };

  const confirmAssign = async (employeeId: string) => {
      const today = new Date().toISOString().split('T')[0];
      // Cập nhật State trước (Optimistic)
      const updatedIds = assignTargetRecords.map(r => r.id);
      setRecords(prev => prev.map(r => {
          if(updatedIds.includes(r.id)) {
              return { ...r, assignedTo: employeeId, status: RecordStatus.ASSIGNED, assignedDate: today };
          }
          return r;
      }));

      // Gọi API nền
      const promises = assignTargetRecords.map(r => updateRecordApi({ ...r, assignedTo: employeeId, status: RecordStatus.ASSIGNED, assignedDate: today }));
      await Promise.all(promises);
      
      setIsAssignModalOpen(false);
      setSelectedRecordIds(new Set());
      alert('Đã giao hồ sơ thành công!');
  };

  const confirmDelete = (record: RecordFile) => {
      setDeletingRecord(record);
      setIsDeleteModalOpen(true);
  };

  const handleQuickUpdate = async (id: string, field: keyof RecordFile, value: string) => {
      // Cập nhật UI ngay
      setRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
      
      const record = records.find(r => r.id === id);
      if (record) {
          await updateRecordApi({ ...record, [field]: value });
      }
  };

  const advanceStatus = async (record: RecordFile, targetStatus?: RecordStatus) => {
      let nextStatus = targetStatus;
      if (!nextStatus) {
          if (record.status === RecordStatus.RECEIVED) {
              setAssignTargetRecords([record]);
              setIsAssignModalOpen(true);
              return;
          }
          const flow = [RecordStatus.RECEIVED, RecordStatus.ASSIGNED, RecordStatus.IN_PROGRESS, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER];
          const idx = flow.indexOf(record.status);
          if (idx < flow.length - 1) nextStatus = flow[idx + 1];
      }
      
      if (nextStatus) {
          const updates: any = { status: nextStatus };
          const todayStr = new Date().toISOString().split('T')[0];

          if (nextStatus === RecordStatus.HANDOVER) updates.completedDate = todayStr;
          // CẬP NHẬT NGÀY KHI CHUYỂN TRẠNG THÁI
          if (nextStatus === RecordStatus.PENDING_SIGN) updates.submissionDate = todayStr;
          if (nextStatus === RecordStatus.SIGNED) updates.approvalDate = todayStr;
          
          // Cập nhật UI ngay
          setRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...updates } : r));
          
          await updateRecordApi({ ...record, ...updates });
      }
  };

  // --- COLUMN VISIBILITY ---
  const toggleColumn = (key: string) => {
      setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const resetColumns = () => {
      setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
  };

  const renderSortableHeader = (label: string, sortKey: string) => (
      <div 
          className="flex items-center gap-1 cursor-pointer select-none hover:text-blue-600 transition-colors"
          onClick={() => setSortConfig({ key: sortKey, direction: sortConfig.key === sortKey && sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
      >
          {label}
          <span className="text-gray-400">
            {sortConfig.key === sortKey ? (
                sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-blue-600" /> : <ArrowDown size={12} className="text-blue-600" />
            ) : <ArrowUpDown size={12} />}
          </span>
      </div>
  );

  // --- EXPORT HANDLERS ---
  const handleOpenExportModal = (type: 'handover' | 'check_list') => {
      setExportModalType(type);
      setIsExportModalOpen(true);
  };

  // Mở modal chọn đợt (Thay thế cho handleExportBatch cũ)
  const handleOpenBatchModal = () => {
      if (!canPerformAction) return;
      
      let candidates: RecordFile[] = [];
      if (selectedRecordIds.size > 0) candidates = records.filter(r => selectedRecordIds.has(r.id));
      else candidates = filteredRecords;

      const recordsToExport = candidates.filter(r => r.status === RecordStatus.SIGNED);

      if (recordsToExport.length === 0) {
          alert(`Không có hồ sơ hợp lệ để chốt danh sách.\nVui lòng đảm bảo các hồ sơ đang ở trạng thái "Đã ký duyệt" (SIGNED).`);
          return;
      }
      setIsAddToBatchModalOpen(true);
  };

  // Xử lý logic chốt sau khi Modal trả về kết quả
  const executeBatchExport = async (batchNumber: number, batchDate: string) => {
      const todayStr = filterDate || new Date().toISOString().split('T')[0];
      
      // Lấy danh sách cần chốt
      let candidates: RecordFile[] = [];
      if (selectedRecordIds.size > 0) candidates = records.filter(r => selectedRecordIds.has(r.id));
      else candidates = filteredRecords;

      const recordsToExport = candidates.filter(r => r.status === RecordStatus.SIGNED);

      if (recordsToExport.length === 0) return;

      // Optimistic UI Update
      setRecords(prev => prev.map(r => {
          if(recordsToExport.find(ex => ex.id === r.id)) {
              return {
                  ...r,
                  exportBatch: batchNumber, 
                  exportDate: batchDate,
                  status: RecordStatus.HANDOVER,
                  completedDate: r.completedDate || todayStr
              };
          }
          return r;
      }));

      // API Call
      const promises = recordsToExport.map(r => updateRecordApi({ 
          ...r, 
          exportBatch: batchNumber, 
          exportDate: batchDate,
          status: RecordStatus.HANDOVER,
          completedDate: r.completedDate || todayStr
      }));
      await Promise.all(promises);
      
      setSelectedRecordIds(new Set()); 
      alert(`Đã chốt danh sách ĐỢT ${batchNumber} thành công.`);
  };

  const handleConfirmSignBatch = async () => {
      if (!canPerformAction) return;
      const pendingSign = filteredRecords.filter(r => r.status === RecordStatus.PENDING_SIGN);
      if (pendingSign.length === 0) {
          alert("Không có hồ sơ nào đang chờ ký trong danh sách hiện tại.");
          return;
      }
      if(confirm(`Xác nhận chuyển ${pendingSign.length} hồ sơ sang trạng thái "Đã ký"?`)) {
          const todayStr = new Date().toISOString().split('T')[0];
          // Optimistic UI Update
          setRecords(prev => prev.map(r => {
              if (pendingSign.find(p => p.id === r.id)) return { ...r, status: RecordStatus.SIGNED, approvalDate: todayStr };
              return r;
          }));

          const promises = pendingSign.map(r => updateRecordApi({ ...r, status: RecordStatus.SIGNED, approvalDate: todayStr }));
          await Promise.all(promises);
      }
  };

  const handleExcelPreview = (wb: XLSX.WorkBook, name: string) => {
      setPreviewWorkbook(wb);
      setPreviewExcelName(name);
      setIsExcelPreviewOpen(true);
  };

  const formatDate = (dateStr?: string) => {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear()).slice(-2);
      return `${day}/${month}/${year}`;
  };

  // --- RENDER LIST FUNCTION ---
  const renderRecordList = () => {
    const isListView = currentView === 'check_list' || currentView === 'handover_list';
    
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col flex-1 h-full">
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
                     {/* TAB SWITCHER CHO HANDOVER LIST */}
                     {currentView === 'handover_list' && (
                         <div className="flex bg-white rounded-md border border-gray-200 p-1 mr-2 shadow-sm">
                             <button 
                                onClick={() => setHandoverTab('today')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${handoverTab === 'today' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                             >
                                 <ListChecks size={16} /> Chờ giao (Hôm nay)
                             </button>
                             <button 
                                onClick={() => setHandoverTab('history')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${handoverTab === 'history' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                             >
                                 <History size={16} /> Lịch sử đã giao
                             </button>
                         </div>
                     )}

                     {/* BỘ LỌC NGÀY NÂNG CAO */}
                     {currentView !== 'handover_list' && (
                         <>
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

                    {currentView !== 'handover_list' && (
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
                    )}
                    
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

                    {isListView && currentView === 'handover_list' && handoverTab === 'history' && (
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

                    {/* BỘ LỌC CẢNH BÁO MỚI (TÁCH 2 LOẠI) */}
                    {currentUser?.role !== UserRole.ONEDOOR && currentView === 'all_records' && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setWarningFilter(prev => prev === 'overdue' ? 'none' : 'overdue')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-colors shadow-sm border ${
                                    warningFilter === 'overdue'
                                    ? 'bg-red-600 text-white border-red-600 shadow-red-200' 
                                    : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                                }`}
                                title="Lọc hồ sơ đã quá hạn"
                            >
                                <AlertTriangle size={16} />
                                Quá hạn ({warningCount.overdue})
                            </button>

                            <button
                                onClick={() => setWarningFilter(prev => prev === 'approaching' ? 'none' : 'approaching')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-colors shadow-sm border ${
                                    warningFilter === 'approaching'
                                    ? 'bg-amber-500 text-white border-amber-500 shadow-amber-200' 
                                    : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'
                                }`}
                                title="Lọc hồ sơ sắp tới hạn (3 ngày)"
                            >
                                <Clock size={16} />
                                Sắp tới hạn ({warningCount.approaching})
                            </button>
                        </div>
                    )}

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
                        <button className="flex items-center gap-2 bg-white text-blue-600 border border-blue-200 px-3 py-1.5 rounded-md hover:bg-blue-50 transition-colors text-sm font-medium shadow-sm ml-auto" onClick={() => handleOpenExportModal(currentView === 'handover_list' ? 'handover' : 'check_list')}>
                            <Eye size={16} /> Xem & In DS
                        </button>

                        {currentView === 'handover_list' && handoverTab === 'today' && (
                            <button className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 transition-colors text-sm font-medium shadow-sm ml-2" onClick={handleOpenBatchModal}>
                                <FileOutput size={16} /> {selectedRecordIds.size > 0 ? `Chốt (${selectedRecordIds.size})` : 'Chốt toàn bộ'}
                            </button>
                        )}

                        {currentView === 'check_list' && (
                            <>
                                <button className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1.5 rounded-md hover:bg-purple-700 transition-colors text-sm font-medium shadow-sm ml-2" onClick={handleConfirmSignBatch}>
                                    <FileSignature size={16} /> Chốt danh sách trình ký
                                </button>
                            </>
                        )}
                       </>
                    )}
                </div>
            </div>
            
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse min-w-[1400px] table-fixed">
                 <thead className="sticky top-0 bg-gray-100 z-10 text-xs font-semibold text-gray-600 uppercase tracking-wider shadow-sm">
                  <tr>
                    <th className="p-3 border-b w-10 text-center">
                        {canPerformAction ? (
                            <button onClick={toggleSelectAll} className="text-gray-500 hover:text-gray-700">
                                {paginatedRecords.length > 0 && selectedRecordIds.size >= paginatedRecords.length ? <CheckSquare size={16} /> : <Square size={16} />}
                            </button>
                        ) : <Lock size={14} className="text-gray-400 mx-auto" />}
                    </th>
                    {visibleColumns.code && <th className="p-3 border-b w-[140px]">{renderSortableHeader('Mã Hồ Sơ', 'code')}</th>}
                    {visibleColumns.customer && <th className="p-3 border-b w-[200px]">{renderSortableHeader('Chủ Sử Dụng', 'customerName')}</th>}
                    {visibleColumns.phone && <th className="p-3 border-b w-[120px]">{renderSortableHeader('Số Điện Thoại', 'phoneNumber')}</th>}
                    {visibleColumns.received && <th className="p-3 border-b w-[120px]">{renderSortableHeader('Ngày TN', 'receivedDate')}</th>}
                    {visibleColumns.deadline && <th className="p-3 border-b w-[130px]">{renderSortableHeader('Hẹn Trả', 'deadline')}</th>}
                    {visibleColumns.ward && <th className="p-3 border-b w-[150px]">{renderSortableHeader('Xã Phường', 'ward')}</th>}
                    {visibleColumns.group && <th className="p-3 border-b w-[120px]">{renderSortableHeader('Nhóm', 'group')}</th>}
                    {visibleColumns.landInfo && <th className="p-3 border-b text-center w-[100px]">{renderSortableHeader('Thửa / Tờ', 'landPlot')}</th>}
                    {visibleColumns.assigned && <th className="p-3 border-b text-center w-[120px]">{renderSortableHeader('Ngày Giao', 'assignedDate')}</th>}
                    {visibleColumns.completed && <th className="p-3 border-b text-center w-[120px]">{renderSortableHeader('Ngày Xong', 'completedDate')}</th>}
                    {visibleColumns.type && <th className="p-3 border-b w-[130px]">{renderSortableHeader('Loại Hồ Sơ', 'recordType')}</th>}
                    {visibleColumns.tech && <th className="p-3 border-b w-[120px]">{renderSortableHeader('Trích Đo/Lục', 'measurementNumber')}</th>}
                    {visibleColumns.batch && <th className="p-3 border-b text-center w-[120px]">{renderSortableHeader('DS Xuất', 'exportBatch')}</th>}
                    {visibleColumns.status && <th className="p-3 border-b text-center w-[140px]">{renderSortableHeader('Trạng Thái', 'status')}</th>}
                    {canPerformAction && <th className="p-3 border-b sticky right-0 bg-gray-100 shadow-l w-[120px] text-center">Thao Tác</th>}
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
                                    <td className="p-3 text-center align-middle">
                                      {canPerformAction ? (
                                         <button onClick={() => toggleSelectRecord(record.id)} className={`${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>
                                            {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                         </button>
                                      ) : <div className="w-4 h-4" />}
                                    </td>
                                    
                                    {visibleColumns.code && (
                                        <td className="p-3 font-medium text-blue-600 cursor-pointer align-middle" onClick={() => { 
                                            if(canPerformAction) { setEditingRecord(record); setIsModalOpen(true); } 
                                            else { setViewingRecord(record); }
                                        }}>
                                            <div className="truncate" title={record.code}>{record.code}</div>
                                            {isOverdue && <span className="inline-block px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] rounded border border-red-200 font-bold mt-1">Quá hạn</span>}
                                        </td>
                                    )}
                                    
                                    {visibleColumns.customer && <td className="p-3 font-medium text-gray-900 align-middle"><div className="truncate" title={record.customerName}>{toTitleCase(record.customerName)}</div></td>}
                                    {visibleColumns.phone && <td className="p-3 text-gray-500 align-middle">{record.phoneNumber || '--'}</td>}
                                    {visibleColumns.received && <td className="p-3 text-gray-600 align-middle">{formatDate(record.receivedDate)}</td>}
                                    {visibleColumns.deadline && (
                                        <td className="p-3 align-middle">
                                            <div className="flex items-center gap-1">
                                                <span className={`font-medium ${isOverdue ? 'text-red-700' : isApproaching ? 'text-orange-700' : 'text-gray-600'}`}>
                                                    {formatDate(record.deadline)}
                                                </span>
                                                {isOverdue && <span title="Quá hạn"><AlertCircle size={14} className="text-red-500 animate-pulse" /></span>}
                                                {isApproaching && <span title="Sắp tới hạn"><Clock size={14} className="text-orange-500 animate-pulse" /></span>}
                                            </div>
                                        </td>
                                    )}
                                    {visibleColumns.ward && <td className="p-3 text-gray-600 align-middle"><div className="truncate" title={getNormalizedWard(record.ward)}>{getNormalizedWard(record.ward) || '--'}</div></td>}
                                    {visibleColumns.group && <td className="p-3 align-middle"><div className="truncate" title={record.group}><span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">{record.group}</span></div></td>}
                                    {visibleColumns.landInfo && (
                                        <td className="p-3 text-center align-middle">
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs font-semibold">T: {record.landPlot || '-'}</span>
                                                <span className="text-xs text-gray-500">TB: {record.mapSheet || '-'}</span>
                                            </div>
                                        </td>
                                    )}
                                    {visibleColumns.assigned && (
                                        <td className="p-3 text-center align-middle">
                                            {record.assignedDate ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs">{formatDate(record.assignedDate)}</span>
                                                    {employee && <span className="text-[10px] text-indigo-600 font-medium truncate max-w-full" title={employee.name}>({employee.name})</span>}
                                                </div>
                                            ) : '--'}
                                        </td>
                                    )}
                                    {visibleColumns.completed && <td className="p-3 text-center text-gray-600 align-middle">{formatDate(record.completedDate) || '--'}</td>}
                                    {visibleColumns.type && <td className="p-3 text-gray-600 align-middle"><div className="truncate" title={record.recordType}>{getShortRecordType(record.recordType)}</div></td>}
                                    {visibleColumns.tech && (
                                        <td className="p-3 align-middle">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] font-bold text-gray-500 w-6 shrink-0">TĐ:</span>
                                                {canPerformAction ? (
                                                    <input
                                                        type="text"
                                                        className="w-full text-xs border border-gray-200 rounded px-1 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none transition-all bg-white/50"
                                                        value={record.measurementNumber || ''}
                                                        onChange={(e) => handleQuickUpdate(record.id, 'measurementNumber', e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        placeholder="Số TĐ"
                                                    />
                                                ) : <span className="text-xs text-gray-800 font-mono truncate">{record.measurementNumber || '---'}</span>}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] font-bold text-gray-500 w-6 shrink-0">TL:</span>
                                                {canPerformAction ? (
                                                    <input
                                                        type="text"
                                                        className="w-full text-xs border border-gray-200 rounded px-1 py-1 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none transition-all bg-white/50"
                                                        value={record.excerptNumber || ''}
                                                        onChange={(e) => handleQuickUpdate(record.id, 'excerptNumber', e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        placeholder="Số TL"
                                                    />
                                                ) : <span className="text-xs text-gray-800 font-mono truncate">{record.excerptNumber || '---'}</span>}
                                            </div>
                                        </div>
                                        </td>
                                    )}
                                    {visibleColumns.batch && (
                                        <td className="p-3 text-center align-middle">
                                            {record.exportBatch ? (
                                                <span className="inline-flex flex-col items-center px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-800 border border-green-200">
                                                    <span className="font-bold">Đợt {record.exportBatch}</span>
                                                    <span className="text-[10px] text-green-600 whitespace-nowrap">({formatDate(record.exportDate)})</span>
                                                </span>
                                            ) : '-'}
                                        </td>
                                    )}
                                    {visibleColumns.status && <td className="p-3 text-center align-middle"><StatusBadge status={record.status} /></td>}
                                    
                                    {canPerformAction && (
                                        <td className={`p-3 sticky right-0 shadow-l text-center align-middle ${isOverdue ? 'bg-red-50 group-hover:bg-red-100' : isApproaching ? 'bg-orange-50 group-hover:bg-orange-100' : 'bg-white group-hover:bg-blue-50/60'}`}>
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={(e) => { e.stopPropagation(); setViewingRecord(record); }} className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Xem chi tiết"><Eye size={16} /></button>
                                                
                                                {record.status === RecordStatus.PENDING_SIGN ? (
                                                    <button onClick={(e) => { e.stopPropagation(); advanceStatus(record, RecordStatus.SIGNED); }} className="p-1.5 text-purple-600 hover:bg-purple-100 rounded-full transition-colors flex items-center gap-1 font-bold" title="Đã ký duyệt (Chuyển sang Giao 1 cửa)">
                                                        <PenTool size={16} /> 
                                                    </button>
                                                ) : record.status !== RecordStatus.HANDOVER && currentView !== 'handover_list' && (
                                                    <button onClick={(e) => { e.stopPropagation(); advanceStatus(record); }} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-full transition-colors" title={record.status === RecordStatus.RECEIVED ? "Giao việc" : "Chuyển bước tiếp theo"}><ArrowRight size={16} /></button>
                                                )}
                                                {record.status === RecordStatus.HANDOVER && <CheckCircle size={16} className="text-green-500" />}
                                            </div>
                                        </td>
                                    )}
                                 </tr>
                            );
                        })
                    ) : (
                        <tr>
                          <td colSpan={15} className="p-12 text-center text-gray-400">
                            {warningFilter !== 'none' ? "Không có hồ sơ nào cần cảnh báo." : "Không tìm thấy hồ sơ phù hợp."}
                          </td>
                        </tr>
                    )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Footer */}
            <div className="border-t border-gray-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between bg-white gap-4">
                 <div className="flex items-center gap-2">
                     <span className="text-sm text-gray-600">
                         Hiển thị {paginatedRecords.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, filteredRecords.length)} / <strong>{filteredRecords.length}</strong>
                     </span>
                     <select 
                        value={itemsPerPage} 
                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                        className="ml-2 border border-gray-300 rounded text-sm px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                     >
                         <option value={10}>10</option>
                         <option value={20}>20</option>
                         <option value={50}>50</option>
                         <option value={100}>100</option>
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

  // --- VIEW RENDERER ---
  const renderMainContent = () => {
      // Fix TS Error: Ensure user is non-null for components
      const user = currentUser!;
      
      // Safety check (should be handled by outer check)
      if (!user) return null;

      switch (currentView) {
          case 'dashboard':
              const total = records.length;
              const completed = records.filter(r => r.status === RecordStatus.HANDOVER).length;
              const processing = records.filter(r => r.status !== RecordStatus.HANDOVER && r.status !== RecordStatus.RECEIVED).length;
              const overdue = records.filter(r => isRecordOverdue(r)).length;
              
              const stats = [
                  { name: 'Hoàn thành', value: completed, fill: '#22c55e' },
                  { name: 'Đang xử lý', value: processing, fill: '#3b82f6' },
                  { name: 'Quá hạn', value: overdue, fill: '#ef4444' }
              ];

              return (
                  <div className="h-full overflow-y-auto space-y-6 p-2">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                              <div><p className="text-gray-500 text-sm">Tổng hồ sơ</p><h3 className="text-2xl font-bold text-gray-800">{total}</h3></div>
                              <div className="bg-blue-100 p-3 rounded-full text-blue-600"><FileText size={24} /></div>
                          </div>
                          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                              <div><p className="text-gray-500 text-sm">Đang xử lý</p><h3 className="text-2xl font-bold text-yellow-600">{processing}</h3></div>
                              <div className="bg-yellow-100 p-3 rounded-full text-yellow-600"><RotateCcw size={24} /></div>
                          </div>
                          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                              <div><p className="text-gray-500 text-sm">Hoàn thành</p><h3 className="text-2xl font-bold text-green-600">{completed}</h3></div>
                              <div className="bg-green-100 p-3 rounded-full text-green-600"><CheckCircle size={24} /></div>
                          </div>
                          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
                              <div><p className="text-gray-500 text-sm">Quá hạn</p><h3 className="text-2xl font-bold text-red-600">{overdue}</h3></div>
                              <div className="bg-red-100 p-3 rounded-full text-red-600"><AlertTriangle size={24} /></div>
                          </div>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 h-80 flex flex-col">
                              <h3 className="text-lg font-bold text-gray-800 mb-4 shrink-0">Biểu đồ trạng thái</h3>
                              <div className="flex-1 min-h-0 w-full relative">
                                <div className="absolute inset-0">
                                    <DashboardChart data={stats} />
                                </div>
                              </div>
                          </div>
                          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center h-80">
                              <h3 className="text-lg font-bold text-gray-800 mb-4 shrink-0">Tỷ lệ hoàn thành</h3>
                              <div className="w-full flex-1 min-h-0 relative">
                                  <div className="absolute inset-0">
                                      <ResponsiveContainer width="100%" height="100%">
                                          <PieChart>
                                              <Pie data={stats} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                                  {stats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                                              </Pie>
                                              <Tooltip />
                                              <Legend verticalAlign="bottom" height={36}/>
                                          </PieChart>
                                      </ResponsiveContainer>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              );
          
          case 'personal_profile':
              return <PersonalProfile 
                user={user} 
                records={records} 
                onUpdateStatus={(r, s) => { 
                    const updates: any = { status: s };
                    const today = new Date().toISOString().split('T')[0];
                    if(s === RecordStatus.PENDING_SIGN) updates.submissionDate = today;
                    if(s === RecordStatus.SIGNED) updates.approvalDate = today;
                    updateRecordApi({ ...r, ...updates }); 
                    // Optimistic update
                    setRecords(prev => prev.map(rec => rec.id === r.id ? { ...rec, ...updates } : rec));
                }} 
                onViewRecord={(r) => setViewingRecord(r)} 
              />;
          
          case 'internal_chat':
              return (
                  <InternalChat 
                      currentUser={user} 
                      employees={employees} 
                      wards={wards} 
                      users={users}
                      // Khi vào chat, reset số thông báo
                      onResetUnread={() => setUnreadMessages(0)}
                  />
              );
          
          case 'user_management':
              return <UserManagement users={users} employees={employees} onAddUser={(u) => { saveUserApi(u, false).then(loadData); }} onUpdateUser={(u) => { saveUserApi(u, true).then(loadData); }} onDeleteUser={(u) => { deleteUserApi(u).then(loadData); }} />;
          
          case 'excerpt_management':
              return <ExcerptManagement currentUser={user} records={records} wards={wards} onUpdateRecord={(id, num) => { updateRecordApi({ ...records.find(r => r.id === id)!, excerptNumber: num }).then(loadData); }} onAddWard={(w) => { const newWards = [...wards, w]; setWards(newWards); localStorage.setItem('wards_list', JSON.stringify(newWards)); }} onDeleteWard={(w) => { const newWards = wards.filter(x => x !== w); setWards(newWards); localStorage.setItem('wards_list', JSON.stringify(newWards)); }} onResetWards={() => { setWards(DEFAULT_WARDS); localStorage.setItem('wards_list', JSON.stringify(DEFAULT_WARDS)); }} />;
          
          case 'account_settings':
              return (
                  <AccountSettingsView 
                    currentUser={user}
                    linkedEmployee={employees.find(e => e.id === user.employeeId)}
                    onUpdate={handleUpdateCurrentAccount}
                  />
              );

          case 'reports':
              return (
                  <ReportSection 
                      reportContent={globalReportContent} 
                      isGenerating={isGeneratingReport}
                      onGenerate={handleGlobalGenerateReport}
                      onExportExcel={handleExportReportExcel}
                  />
              );

          case 'all_records':
          case 'check_list':
          case 'handover_list':
          case 'assign_tasks':
              return renderRecordList();

          default:
              return null;
      }
  };

  if (!currentUser) {
    return <Login onLogin={setCurrentUser} users={users} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans">
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenSystemSettings={() => setIsSystemSettingsOpen(true)}
        currentUser={currentUser}
        onLogout={() => setCurrentUser(null)}
        mobileOpen={isMobileMenuOpen} 
        setMobileOpen={setIsMobileMenuOpen}
        isGeneratingReport={isGeneratingReport} 
        isUpdateAvailable={isUpdateAvailable}
        latestVersion={latestVersion}
        updateUrl={updateUrl}
        onOpenAccountSettings={() => setCurrentView('account_settings')}
        // Truyen thong bao
        unreadMessagesCount={unreadMessages}
        warningRecordsCount={warningCount.overdue + warningCount.approaching}
      />
      
      <main className="flex-1 h-screen overflow-hidden flex flex-col relative min-w-0">
        <header className="sticky top-0 z-30 flex justify-between items-center px-6 py-4 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200 shadow-sm shrink-0">
          <div className="flex items-center">
            <button 
                className="mr-3 p-2 rounded-md bg-white border border-gray-200 text-gray-600 md:hidden shadow-sm active:bg-gray-100"
                onClick={() => setIsMobileMenuOpen(true)}
            >
                <Menu size={20} />
            </button>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800 truncate max-w-[200px] md:max-w-none">
              {currentView === 'dashboard' ? 'Tổng quan' : 
               currentView === 'reports' ? 'Báo cáo & Thống kê' : 
               currentView === 'personal_profile' ? 'Hồ sơ cá nhân' :
               currentView === 'internal_chat' ? 'Kênh Chat Nội Bộ' :
               currentView === 'user_management' ? 'Quản trị hệ thống' : 
               currentView === 'excerpt_management' ? 'Cấp Số Trích Lục' : 
               currentView === 'assign_tasks' ? 'Giao Hồ Sơ' : 
               currentView === 'receive_record' ? 'Tiếp Nhận Hồ Sơ' :
               currentView === 'receive_contract' ? 'Tiếp Nhận Hợp Đồng' :
               currentView === 'account_settings' ? 'Cài đặt tài khoản' :
               'Quản lý hồ sơ'}
            </h1>
          </div>
          <div className="flex items-center gap-4">
             {connectionStatus === 'connected' ? (
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-green-200 shadow-sm text-green-700">
                    <Wifi size={14} /> <span className="text-xs font-bold hidden sm:inline">Online</span>
                </div>
             ) : (
                <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-full border border-red-200 shadow-sm text-red-700">
                    <WifiOff size={14} /> <span className="text-xs font-bold hidden sm:inline">Offline</span>
                </div>
             )}
          </div>
        </header>
        
        <div className="flex-1 overflow-hidden flex flex-col p-4 md:p-6 relative">
            {/* CACHED VIEWS - KEEP ALIVE */}
            <div className={`h-full flex flex-col ${currentView === 'receive_record' ? 'flex' : 'hidden'}`}>
                 <ReceiveRecord 
                  onSave={async (r) => { 
                      const res = await createRecordApi(r); 
                      if(res) {
                          setRecords(prev => [res, ...prev]);
                          return true;
                      }
                      return false; 
                  }} 
                  wards={wards} 
                  employees={employees} 
                  currentUser={currentUser!}
                  records={records} 
              />
            </div>

            <div className={`h-full flex flex-col ${currentView === 'receive_contract' ? 'flex' : 'hidden'}`}>
                <ReceiveContract 
                    onSave={async (r) => { const res = await createRecordApi(r); return !!res; }} 
                    wards={wards} 
                    currentUser={currentUser!} 
                    records={records} 
                />
            </div>

            {/* DYNAMIC VIEWS */}
            {renderMainContent()}
        </div>
      </main>

      {/* Các Modal */}
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
      
      <DetailModal 
        isOpen={!!viewingRecord} 
        onClose={() => setViewingRecord(null)} 
        record={viewingRecord} 
        employees={employees} 
        currentUser={currentUser} 
        onEdit={(record) => { setEditingRecord(record); setIsModalOpen(true); }}
        onDelete={confirmDelete}
      />
      
      <DeleteConfirmModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={handleDeleteRecord} message={`Bạn có chắc chắn muốn xóa hồ sơ ${deletingRecord?.code}?`} />
      
      <ExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        records={records} 
        wards={wards} 
        type={exportModalType}
        onPreview={handleExcelPreview}
      />
      
      <ExcelPreviewModal 
        isOpen={isExcelPreviewOpen} 
        onClose={() => setIsExcelPreviewOpen(false)} 
        workbook={previewWorkbook} 
        fileName={previewExcelName} 
      />

      <AddToBatchModal
        isOpen={isAddToBatchModalOpen}
        onClose={() => setIsAddToBatchModalOpen(false)}
        onConfirm={executeBatchExport}
        records={records}
        selectedCount={selectedRecordIds.size}
      />
    </div>
  );
}

export default App;
