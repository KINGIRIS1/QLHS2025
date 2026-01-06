
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RecordFile, RecordStatus, Employee, User, UserRole, Message } from './types';
import { STATUS_LABELS, DEFAULT_WARDS as STATIC_WARDS } from './constants';
import Sidebar from './components/Sidebar';
import Login from './components/Login'; 
import UserManagement from './components/UserManagement'; 
import EmployeeManagement from './components/EmployeeManagement';
import PersonalProfile from './components/PersonalProfile'; 
import ExcerptManagement from './components/ExcerptManagement';
import ReceiveRecord from './components/ReceiveRecord'; 
import ReceiveContract from './components/ReceiveContract'; 
import InternalChat from './components/InternalChat'; 
import AccountSettingsView from './components/AccountSettingsView';
import DashboardView from './components/DashboardView';
import ReportSection from './components/ReportSection';
import AppModals from './components/AppModals';
import RecordRow from './components/RecordRow';
import UtilitiesView from './components/UtilitiesView'; 

import { COLUMN_DEFS, DEFAULT_VISIBLE_COLUMNS, confirmAction } from './utils/appHelpers';
import { exportReportToExcel, exportReturnedListToExcel } from './utils/excelExport';
import { generateReport } from './services/geminiService';
import { syncTemplatesFromCloud } from './services/docxService'; 
import { updateRecordApi, saveEmployeeApi, saveUserApi, forceUpdateRecordsBatchApi } from './services/api';
import { supabase } from './services/supabaseClient';
import * as XLSX from 'xlsx-js-style';
import { 
  Plus, Search, CheckSquare, Square, Users, FileSpreadsheet,
  SlidersHorizontal, AlertTriangle, Clock, Lock, WifiOff,
  ArrowUpDown, ChevronLeft, ChevronRight, Bell, MapPin, RotateCcw, Menu, FileOutput, FileSignature, ListChecks, History,
  Calendar, X, Filter, User as UserIcon, Eye, CalendarRange, CheckCircle, UserPlus, Send, Layers, FileCheck
} from 'lucide-react';

import { useAppData } from './hooks/useAppData';
import { useRecordFilter } from './hooks/useRecordFilter';
import { useReminderSystem } from './hooks/useReminderSystem';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [notificationEnabled, setNotificationEnabled] = useState(() => {
      const saved = localStorage.getItem('chat_notification_enabled');
      return saved === null ? true : saved === 'true';
  });

  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Contract Liquidation Request State
  const [recordToLiquidate, setRecordToLiquidate] = useState<RecordFile | null>(null);

  useEffect(() => {
      if (toast) {
          const timer = setTimeout(() => setToast(null), 3000);
          return () => clearTimeout(timer);
      }
  }, [toast]);

  useEffect(() => {
      if (window.electronAPI && window.electronAPI.onNavigateToView) {
          window.electronAPI.onNavigateToView((viewId: string) => {
              if (currentUser) {
                  setCurrentView(viewId);
              }
          });
      }
      return () => {
          if (window.electronAPI && window.electronAPI.removeNavigationListener) {
              window.electronAPI.removeNavigationListener();
          }
      };
  }, [currentUser]);

  const { 
      records, employees, users, wards, connectionStatus,
      isUpdateAvailable, latestVersion, updateUrl,
      setEmployees, setUsers, setRecords, setWards,
      loadData, handleAddOrUpdateRecord, handleDeleteRecord, handleImportRecords,
      handleSaveEmployee, handleDeleteEmployee, handleDeleteAllData, handleUpdateUser, handleDeleteUser
  } = useAppData(currentUser);

  // --- REMINDER SYSTEM INTEGRATION ---
  const handleUpdateRecordState = useCallback((updatedRecord: RecordFile) => {
      setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
  }, [setRecords]);

  const { activeRemindersCount } = useReminderSystem(records, handleUpdateRecordState);

  const {
      filteredRecords, paginatedRecords, totalPages, warningCount,
      searchTerm, setSearchTerm,
      filterDate, setFilterDate,
      filterSpecificDate, setFilterSpecificDate,
      filterFromDate, setFilterFromDate,
      filterToDate, setFilterToDate,
      showAdvancedDateFilter, setShowAdvancedDateFilter,
      filterWard, setFilterWard,
      filterStatus, setFilterStatus,
      filterEmployee, setFilterEmployee,
      warningFilter, setWarningFilter,
      handoverTab, setHandoverTab,
      sortConfig, setSortConfig,
      currentPage, setCurrentPage,
      itemsPerPage, setItemsPerPage
  } = useRecordFilter(records, currentUser, currentView, employees);

  // --- LOGIC TỰ ĐỘNG CHUYỂN TAB CHO 1 CỬA ---
  // Nếu là 1 cửa và đang ở tab 'today' (Chờ giao) -> Chuyển ngay sang 'history'
  useEffect(() => {
      if (currentView === 'handover_list' && currentUser?.role === UserRole.ONEDOOR && handoverTab === 'today') {
          setHandoverTab('history');
      }
  }, [currentView, currentUser, handoverTab, setHandoverTab]);

  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
      try { return JSON.parse(localStorage.getItem('visible_columns') || '') || DEFAULT_VISIBLE_COLUMNS; } catch { return DEFAULT_VISIBLE_COLUMNS; }
  });
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const columnSelectorRef = useRef<HTMLDivElement>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecordFile | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSystemSettingsOpen, setIsSystemSettingsOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTargetRecords, setAssignTargetRecords] = useState<RecordFile[]>([]);
  const [viewingRecord, setViewingRecord] = useState<RecordFile | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<RecordFile | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalType, setExportModalType] = useState<'handover' | 'check_list'>('handover');
  const [isAddToBatchModalOpen, setIsAddToBatchModalOpen] = useState(false);
  const [isExcelPreviewOpen, setIsExcelPreviewOpen] = useState(false);
  const [previewWorkbook, setPreviewWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [previewExcelName, setPreviewExcelName] = useState('');
  
  // NEW: State for Bulk Update Modal
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);

  // NEW: State for Return Result Modal
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnRecord, setReturnRecord] = useState<RecordFile | null>(null);

  const [globalReportContent, setGlobalReportContent] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isSubadmin = currentUser?.role === UserRole.SUBADMIN;
  const isTeamLeader = currentUser?.role === UserRole.TEAM_LEADER;
  const canPerformAction = isAdmin || isSubadmin || isTeamLeader || currentUser?.role === UserRole.ONEDOOR;

  useEffect(() => {
      syncTemplatesFromCloud();
  }, []);

  useEffect(() => {
      if (!currentUser) return;
      const channel = supabase
          .channel('global-chat-listener')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload: any) => {
              const newMsg = payload.new as Message;
              if (newMsg.sender_username === currentUser.username) return;
              if (currentView !== 'internal_chat') {
                  setUnreadMessages(prev => prev + 1);
              }
              if (notificationEnabled && window.electronAPI && window.electronAPI.showNotification) {
                  const title = `Tin nhắn từ ${newMsg.sender_name}`;
                  const body = newMsg.content || (newMsg.file_name ? `[File] ${newMsg.file_name}` : '[Hình ảnh]');
                  window.electronAPI.showNotification(title, body);
              }
          })
          .subscribe();
      return () => { supabase.removeChannel(channel); };
  }, [currentUser, currentView, notificationEnabled]);

  useEffect(() => { localStorage.setItem('visible_columns', JSON.stringify(visibleColumns)); }, [visibleColumns]);

  const handleExportReportExcel = async (fromDateStr: string, toDateStr: string) => {
      if (!currentUser) return;
      await exportReportToExcel(records, fromDateStr, toDateStr);
  };

  const handleUpdateCurrentAccount = async (data: { name: string; password?: string; department?: string }) => {
      if (!currentUser) return false;
      const updatedUser: User = { ...currentUser, name: data.name, ...(data.password ? { password: data.password } : {}) };
      const savedUser = await saveUserApi(updatedUser, true);
      if (!savedUser) return false;
      if (currentUser.employeeId && data.department) {
          const emp = employees.find(e => e.id === currentUser.employeeId);
          if (emp) {
              const savedEmp = await saveEmployeeApi({ ...emp, department: data.department }, true);
              if (savedEmp) setEmployees(prev => prev.map(e => e.id === emp.id ? savedEmp : e));
          }
      }
      setUsers(prev => prev.map(u => u.username === currentUser.username ? savedUser : u));
      setCurrentUser(savedUser);
      loadData();
      return true;
  };

  const handleGlobalGenerateReport = async (fromDateStr: string, toDateStr: string) => {
      if (!currentUser) return;
      setIsGeneratingReport(true);
      setGlobalReportContent(''); 
      const from = new Date(fromDateStr); from.setHours(0, 0, 0, 0); 
      const to = new Date(toDateStr); to.setHours(23, 59, 59, 999); 
      const filtered = records.filter(r => { if(!r.receivedDate) return false; const rDate = new Date(r.receivedDate); return rDate >= from && rDate <= to; });
      const formatDateVN = (d: Date) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
      try {
          const scope = currentUser.role === UserRole.EMPLOYEE ? 'personal' : 'general';
          const result = await generateReport(filtered, `Từ ngày ${formatDateVN(from)} đến ngày ${formatDateVN(to)}`, scope, currentUser.name);
          setGlobalReportContent(result);
      } catch (error) { setGlobalReportContent("Không thể tạo báo cáo. Vui lòng kiểm tra API Key."); } 
      finally { setIsGeneratingReport(false); }
  };

  const onImportRecords = async (data: RecordFile[], mode: 'create' | 'update') => {
      if (mode === 'create') {
          return handleImportRecords(data);
      } else {
          const result = await forceUpdateRecordsBatchApi(data);
          if (result.success) {
              setToast({ type: 'success', message: `Đã cập nhật thành công ${result.count} hồ sơ.` });
              loadData();
              return true;
          } else {
              setToast({ type: 'error', message: "Lỗi khi cập nhật dữ liệu. Vui lòng thử lại." });
              return false;
          }
      }
  };

  const toggleSelectAll = useCallback(() => {
      if (selectedRecordIds.size === paginatedRecords.length && paginatedRecords.length > 0) setSelectedRecordIds(new Set());
      else setSelectedRecordIds(new Set(paginatedRecords.map(r => r.id)));
  }, [selectedRecordIds, paginatedRecords]);

  const toggleSelectRecord = useCallback((id: string) => {
      setSelectedRecordIds(prev => {
          const newSet = new Set(prev);
          if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
          return newSet;
      });
  }, []);

  const confirmAssign = async (employeeId: string) => {
      const today = new Date().toISOString().split('T')[0];
      const updatedIds = assignTargetRecords.map(r => r.id);
      setRecords(prev => prev.map(r => updatedIds.includes(r.id) ? { ...r, assignedTo: employeeId, status: RecordStatus.ASSIGNED, assignedDate: today } : r));
      await Promise.all(assignTargetRecords.map(r => updateRecordApi({ ...r, assignedTo: employeeId, status: RecordStatus.ASSIGNED, assignedDate: today })));
      setIsAssignModalOpen(false); 
      setSelectedRecordIds(new Set()); 
      setToast({ type: 'success', message: `Đã giao ${assignTargetRecords.length} hồ sơ thành công!` });
  };

  // --- NEW: HANDLER CHO BULK UPDATE (ADMIN) ---
  const handleBulkUpdate = async (field: keyof RecordFile, value: any) => {
      const selectedIds = Array.from(selectedRecordIds);
      const updates: any = { [field]: value };
      
      // Tự động set ngày kèm theo nếu đổi trạng thái
      const todayStr = new Date().toISOString().split('T')[0];
      if (field === 'status') {
          if (value === RecordStatus.ASSIGNED) updates.assignedDate = todayStr;
          if (value === RecordStatus.PENDING_SIGN) updates.submissionDate = todayStr;
          if (value === RecordStatus.SIGNED) updates.approvalDate = todayStr;
          if (value === RecordStatus.HANDOVER) updates.completedDate = todayStr;
          if (value === RecordStatus.RETURNED) updates.resultReturnedDate = todayStr;
      }
      if (field === 'assignedTo') {
          updates.assignedDate = todayStr;
          updates.status = RecordStatus.ASSIGNED; // Tự động chuyển status nếu giao việc
      }

      // Optimistic Update UI
      setRecords(prev => prev.map(r => selectedIds.includes(r.id) ? { ...r, ...updates } : r));

      // Call API Loop
      const targets = records.filter(r => selectedIds.includes(r.id));
      await Promise.all(targets.map(r => updateRecordApi({ ...r, ...updates })));

      setToast({ type: 'success', message: `Đã cập nhật ${selectedIds.length} hồ sơ thành công!` });
      setSelectedRecordIds(new Set()); // Clear selection
  };

  const handleQuickUpdate = useCallback(async (id: string, field: keyof RecordFile, value: string) => {
      setRecords(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
      const record = records.find(r => r.id === id); 
      if (record) {
          try {
              await updateRecordApi({ ...record, [field]: value });
          } catch (e) {
              console.error("Quick update failed", e);
          }
      } else {
          const tempRecord = { id } as RecordFile; 
          await updateRecordApi({ ...tempRecord, [field]: value });
      }
  }, [records]);

  // Xử lý nút mở Modal trả kết quả (Thay vì confirm trực tiếp)
  const handleOpenReturnModal = useCallback((record: RecordFile) => {
      setReturnRecord(record);
      setIsReturnModalOpen(true);
  }, []);

  // Xử lý xác nhận trả kết quả từ Modal
  const handleConfirmReturnResult = useCallback(async (receiptNumber: string, receiverName: string) => {
      if (!returnRecord) return;
      
      const today = new Date().toISOString().split('T')[0];
      
      const updates = { 
          resultReturnedDate: today, 
          status: RecordStatus.RETURNED,
          receiptNumber: receiptNumber,
          receiverName: receiverName, // CẬP NHẬT: Lưu vào cột receiverName riêng
          // Không cần nối vào notes nữa
      }; 

      setRecords(prev => prev.map(r => r.id === returnRecord.id ? { ...r, ...updates } : r));
      await updateRecordApi({ ...returnRecord, ...updates });
      
      setToast({ type: 'success', message: `Đã ghi nhận trả kết quả hồ sơ ${returnRecord.code} cho ${receiverName}.` });
      setReturnRecord(null);
  }, [returnRecord]);

  const advanceStatus = useCallback(async (record: RecordFile) => {
      if (record.status === RecordStatus.RECEIVED) { 
          setAssignTargetRecords([record]); 
          setIsAssignModalOpen(true); 
          return; 
      }
      const flow = [RecordStatus.RECEIVED, RecordStatus.ASSIGNED, RecordStatus.IN_PROGRESS, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER];
      const idx = flow.indexOf(record.status);
      if (idx < flow.length - 1) {
          const nextStatus = flow[idx + 1];
          const updates: any = { status: nextStatus };
          const todayStr = new Date().toISOString().split('T')[0];
          if (nextStatus === RecordStatus.HANDOVER) updates.completedDate = todayStr;
          if (nextStatus === RecordStatus.PENDING_SIGN) updates.submissionDate = todayStr;
          if (nextStatus === RecordStatus.SIGNED) updates.approvalDate = todayStr;
          setRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...updates } : r));
          await updateRecordApi({ ...record, ...updates });
      }
  }, []);

  const executeBatchExport = async (batchNumber: number, batchDate: string) => {
      const todayStr = filterDate || new Date().toISOString().split('T')[0];
      const candidates = selectedRecordIds.size > 0 ? records.filter(r => selectedRecordIds.has(r.id)) : filteredRecords;
      const recordsToExport = candidates.filter(r => r.status === RecordStatus.SIGNED || (r.status === RecordStatus.WITHDRAWN && !r.exportBatch));

      if (recordsToExport.length === 0) return;

      const updatesToApply = recordsToExport.map(r => {
          const nextStatus = r.status === RecordStatus.WITHDRAWN ? RecordStatus.WITHDRAWN : RecordStatus.HANDOVER;
          return { ...r, exportBatch: batchNumber, exportDate: batchDate, status: nextStatus, completedDate: r.completedDate || todayStr };
      });

      setRecords(prev => prev.map(r => {
          const updated = updatesToApply.find(u => u.id === r.id);
          return updated ? updated : r;
      }));

      await Promise.all(updatesToApply.map(r => updateRecordApi(r)));
      setSelectedRecordIds(new Set()); 
      setToast({ type: 'success', message: `Đã chốt danh sách ĐỢT ${batchNumber} thành công.` });
  };

  const handleConfirmSignBatch = async () => {
      if (!canPerformAction) return;
      const pendingSign = filteredRecords.filter(r => r.status === RecordStatus.PENDING_SIGN);
      if (pendingSign.length === 0) { alert("Không có hồ sơ nào đang chờ ký."); return; }
      
      if(await confirmAction(`Xác nhận chuyển ${pendingSign.length} hồ sơ sang "Đã ký"?`)) {
          const todayStr = new Date().toISOString().split('T')[0];
          setRecords(prev => prev.map(r => pendingSign.find(p => p.id === r.id) ? { ...r, status: RecordStatus.SIGNED, approvalDate: todayStr } : r));
          await Promise.all(pendingSign.map(r => updateRecordApi({ ...r, status: RecordStatus.SIGNED, approvalDate: todayStr })));
          setToast({ type: 'success', message: `Đã chuyển ${pendingSign.length} hồ sơ sang "Đã ký".` });
      }
  };

  const handleExportReturnedList = () => {
      if (!canPerformAction) return;
      // CẬP NHẬT: Truyền khoảng thời gian (Từ ngày - Đến ngày)
      exportReturnedListToExcel(filteredRecords, filterFromDate, filterToDate, filterWard);
  };

  // --- LIQUIDATION HANDLER ---
  const handleRequestLiquidation = useCallback((record: RecordFile) => {
      setRecordToLiquidate(record);
      setCurrentView('receive_contract');
  }, []);

  const handleEditRecord = useCallback((r: RecordFile) => { setEditingRecord(r); setIsModalOpen(true); }, []);
  const handleViewRecord = useCallback((r: RecordFile) => setViewingRecord(r), []);
  const handleDeleteConfirm = useCallback((r: RecordFile) => { setDeletingRecord(r); setIsDeleteModalOpen(true); }, []);

  const handleExcelPreview = (wb: XLSX.WorkBook, name: string) => {
      setPreviewWorkbook(wb);
      setPreviewExcelName(name);
      setIsExcelPreviewOpen(true);
  };

  // Render Record List Table
  const renderRecordList = () => {
    // UPDATE: Thêm 'all_records' vào danh sách isListView để hiển thị thanh công cụ phía dưới
    const isListView = currentView === 'check_list' || currentView === 'handover_list' || currentView === 'assign_tasks' || currentView === 'all_records';
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col flex-1 h-full animate-fade-in-up">
            <div className="p-4 border-b border-gray-100 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        {currentView === 'check_list' ? 'Danh sách Trình Ký' : currentView === 'handover_list' ? 'Danh sách Trả Kết Quả' : currentView === 'assign_tasks' ? 'Giao Hồ Sơ Mới' : 'Danh sách Hồ sơ'}
                        {!canPerformAction && <span className="text-xs font-normal text-gray-500 px-2 py-0.5 bg-gray-100 rounded-full border">Chỉ xem</span>}
                    </h2>
                    <div className="relative flex-1 sm:w-64 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input type="text" placeholder="Tìm kiếm..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-2 rounded-lg relative">
                     {currentView === 'handover_list' && (
                         <div className="flex bg-white rounded-md border border-gray-200 p-1 mr-2 shadow-sm">
                             {/* CHỈ HIỂN THỊ NÚT 'CHỜ GIAO' NẾU KHÔNG PHẢI LÀ 1 CỬA */}
                             {currentUser?.role !== UserRole.ONEDOOR && (
                                <button onClick={() => setHandoverTab('today')} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${handoverTab === 'today' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><ListChecks size={16} /> Chờ giao</button>
                             )}
                             <button onClick={() => setHandoverTab('history')} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${handoverTab === 'history' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><History size={16} /> Lịch sử</button>
                             {/* TAB MỚI: ĐÃ TRẢ KẾT QUẢ */}
                             <button onClick={() => setHandoverTab('returned')} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${handoverTab === 'returned' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><FileCheck size={16} /> Đã trả KQ</button>
                         </div>
                     )}
                     
                     {/* Ẩn bộ lọc ngày chung nếu đang ở tab handover_list history/returned vì nó có logic lọc riêng */}
                     {currentView !== 'handover_list' && !showAdvancedDateFilter && ( <div className="flex items-center gap-2 bg-white px-2 py-1.5 border border-gray-200 rounded-md shadow-sm"><Calendar size={16} className="text-gray-500" /><input type="date" value={filterSpecificDate} onChange={(e) => setFilterSpecificDate(e.target.value)} className="text-sm outline-none bg-transparent text-gray-700" title="Lọc theo ngày tiếp nhận" />{filterSpecificDate && (<button onClick={() => setFilterSpecificDate('')} className="text-gray-400 hover:text-red-500"><X size={14} /></button>)}</div>)}
                     
                     {/* Logic lọc ngày riêng cho History và Returned */}
                     {currentView === 'handover_list' && handoverTab === 'history' && (
                         <div className="flex items-center gap-2 bg-white px-2 py-1.5 border border-gray-200 rounded-md shadow-sm">
                             <Calendar size={16} className="text-gray-500" />
                             <span className="text-xs text-gray-500 font-bold uppercase">Ngày giao:</span>
                             <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="text-sm outline-none bg-transparent text-gray-700" />
                             {filterDate && (<button onClick={() => setFilterDate('')} className="text-gray-400 hover:text-red-500"><X size={14} /></button>)}
                         </div>
                     )}

                     {/* CẬP NHẬT: Logic lọc ngày cho 'returned' dùng khoảng thời gian (giống Advanced Date Filter) */}
                     {currentView === 'handover_list' && handoverTab === 'returned' && (
                        <div className="flex items-center gap-2 bg-white px-2 py-1.5 border border-gray-200 rounded-md shadow-sm">
                            <span className="text-xs text-gray-500 font-bold uppercase">Ngày trả:</span>
                            <input type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} className="text-sm outline-none bg-transparent text-gray-700 border border-gray-300 rounded px-1" title="Từ ngày" />
                            <span className="text-gray-400">-</span>
                            <input type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} className="text-sm outline-none bg-transparent text-gray-700 border border-gray-300 rounded px-1" title="Đến ngày" />
                            {(filterFromDate || filterToDate) && (<button onClick={() => { setFilterFromDate(''); setFilterToDate(''); }} className="text-gray-400 hover:text-red-500"><X size={14} /></button>)}
                        </div>
                     )}

                     {currentView !== 'handover_list' && <button onClick={() => setShowAdvancedDateFilter(!showAdvancedDateFilter)} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm border ${showAdvancedDateFilter ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}><CalendarRange size={16} /></button>}
                     
                     <div className="flex items-center gap-2 bg-white px-2 py-1.5 border border-gray-200 rounded-md shadow-sm"><MapPin size={16} className="text-gray-500" /><select value={filterWard} onChange={(e) => setFilterWard(e.target.value)} className="text-sm outline-none bg-transparent text-gray-700 font-medium cursor-pointer border-none focus:ring-0 max-w-[120px]"><option value="all">Tất cả Xã</option>{wards.map(w => (<option key={w} value={w}>{w}</option>))}</select></div>
                     
                     {currentView === 'all_records' && (
                        <div className="flex items-center gap-2 bg-white px-2 py-1.5 border border-gray-200 rounded-md shadow-sm">
                            <Filter size={16} className="text-gray-500" />
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="text-sm outline-none bg-transparent text-gray-700 font-medium cursor-pointer border-none focus:ring-0 max-w-[120px]">
                                <option value="all">Mọi trạng thái</option>
                                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                     )}

                     {canPerformAction && currentView === 'all_records' && (
                        <div className="flex items-center gap-2 bg-white px-2 py-1.5 border border-gray-200 rounded-md shadow-sm">
                            <UserIcon size={16} className="text-gray-500" />
                            <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} className="text-sm outline-none bg-transparent text-gray-700 font-medium cursor-pointer border-none focus:ring-0 max-w-[120px]">
                                <option value="all">Tất cả NV</option>
                                <option value="unassigned">Chưa giao</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                            </select>
                        </div>
                     )}

                     {currentUser?.role !== UserRole.ONEDOOR && currentView === 'all_records' && (
                        <div className="flex gap-2">
                            <button onClick={() => setWarningFilter(prev => prev === 'overdue' ? 'none' : 'overdue')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-colors shadow-sm border ${warningFilter === 'overdue' ? 'bg-red-600 text-white' : 'bg-white text-red-600'}`}><AlertTriangle size={16} /> {warningCount.overdue}</button>
                            <button onClick={() => setWarningFilter(prev => prev === 'approaching' ? 'none' : 'approaching')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-colors shadow-sm border ${warningFilter === 'approaching' ? 'bg-orange-500 text-white' : 'bg-white text-orange-600'}`}><Clock size={16} /> {warningCount.approaching}</button>
                        </div>
                     )}

                     {canPerformAction && (
                        <>
                            <div className="h-6 w-px bg-gray-300 mx-2"></div>
                            <button onClick={() => { setIsModalOpen(true); setEditingRecord(null); }} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 shadow-sm text-sm font-bold"><Plus size={16} /> Nhập</button>
                            <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 shadow-sm text-sm font-bold"><FileSpreadsheet size={16} /> Excel</button>
                        </>
                     )}

                     {(isAdmin || isSubadmin) && selectedRecordIds.size > 0 && (
                        <button 
                            onClick={() => setIsBulkUpdateModalOpen(true)} 
                            className="ml-2 flex items-center gap-1 bg-orange-600 text-white px-3 py-1.5 rounded-md hover:bg-orange-700 shadow-sm text-sm font-bold animate-pulse"
                        >
                            <Layers size={16} /> Admin: Xử lý hàng loạt ({selectedRecordIds.size})
                        </button>
                     )}

                     {currentView === 'all_records' && (
                        <div className="relative ml-auto" ref={columnSelectorRef}>
                            <button onClick={() => setShowColumnSelector(!showColumnSelector)} className="p-2 bg-white border border-gray-200 rounded-md hover:bg-gray-100"><SlidersHorizontal size={16} /></button>
                            {showColumnSelector && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-2">
                                    {COLUMN_DEFS.map(col => (
                                        <label key={col.key} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                            <input type="checkbox" checked={visibleColumns[col.key]} onChange={() => setVisibleColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))} className="rounded text-blue-600 focus:ring-blue-500" />
                                            <span className="text-sm text-gray-700">{col.label}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                     )}
                </div>

                {showAdvancedDateFilter && (
                    <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200 animate-fade-in text-sm">
                        <span className="text-gray-600 font-medium">Từ ngày:</span>
                        <input type="date" className="border rounded px-2 py-1" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} />
                        <span className="text-gray-600 font-medium">Đến ngày:</span>
                        <input type="date" className="border rounded px-2 py-1" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} />
                        {(filterFromDate || filterToDate) && <button onClick={() => { setFilterFromDate(''); setFilterToDate(''); }} className="text-red-500 hover:underline text-xs">Xóa</button>}
                    </div>
                )}
                
                {/* Check List / Handover Actions */}
                {isListView && (
                    <div className="flex justify-end gap-3 mt-2">
                        {canPerformAction && currentView === 'handover_list' && handoverTab === 'today' && selectedRecordIds.size > 0 && (
                            <button onClick={() => setIsAddToBatchModalOpen(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-bold shadow-md transition-all animate-pulse">
                                <CheckCircle size={18} /> Chốt Danh Sách Giao ({selectedRecordIds.size})
                            </button>
                        )}
                        {canPerformAction && currentView === 'handover_list' && handoverTab === 'returned' && (
                            <button onClick={handleExportReturnedList} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-bold shadow-md transition-all">
                                <FileSpreadsheet size={18} /> Xuất Excel (Đã trả KQ)
                            </button>
                        )}
                        {canPerformAction && currentView === 'check_list' && filteredRecords.length > 0 && (
                            <button onClick={handleConfirmSignBatch} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-bold shadow-md">
                                <FileSignature size={18} /> Ký Duyệt Tất Cả ({filteredRecords.length})
                            </button>
                        )}
                        {/* BUTTON GIAO VIỆC HÀNG LOẠT (Updated condition) */}
                        {canPerformAction && (currentView === 'assign_tasks' || currentView === 'all_records') && selectedRecordIds.size > 0 && (
                            <button 
                                onClick={() => {
                                    const targets = records.filter(r => selectedRecordIds.has(r.id));
                                    setAssignTargetRecords(targets);
                                    setIsAssignModalOpen(true);
                                }}
                                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-bold shadow-md transition-all animate-pulse"
                            >
                                <UserPlus size={18} /> Giao Nhân Viên ({selectedRecordIds.size})
                            </button>
                        )}
                        {/* UPDATE: Ẩn nút Xuất Danh Sách cho all_records vì đã có nút Excel ở trên */}
                        {(currentView !== 'handover_list' || handoverTab !== 'returned') && currentView !== 'assign_tasks' && currentView !== 'all_records' && (
                            <button onClick={() => { setExportModalType(currentView === 'check_list' ? 'check_list' : 'handover'); setIsExportModalOpen(true); }} className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium shadow-sm">
                                <FileOutput size={18} /> Xuất Danh Sách
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-auto min-h-0 bg-white">
                <table className="w-full text-left table-fixed min-w-[1200px] border-collapse">
                    <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase sticky top-0 shadow-sm z-10">
                        <tr>
                            <th className="p-3 w-10 text-center">
                                {canPerformAction ? <button onClick={toggleSelectAll}>{selectedRecordIds.size === paginatedRecords.length && paginatedRecords.length > 0 ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-gray-400" />}</button> : '#'}
                            </th>
                            {COLUMN_DEFS.map(col => visibleColumns[col.key] && (
                                <th key={col.key} className={`p-3 cursor-pointer hover:bg-gray-100 transition-colors group select-none ${col.className || ''}`} onClick={() => { if (sortConfig.key === col.sortKey) { setSortConfig({ key: col.sortKey, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' }); } else { setSortConfig({ key: col.sortKey, direction: 'asc' }); } }}>
                                    <div className={`flex items-center gap-1 ${col.className?.includes('text-center') ? 'justify-center' : ''}`}>
                                        {col.label}
                                        {sortConfig.key === col.sortKey ? (sortConfig.direction === 'asc' ? <ArrowUpDown size={14} className="text-blue-600" /> : <ArrowUpDown size={14} className="text-blue-600 rotate-180" />) : <ArrowUpDown size={14} className="text-gray-300 opacity-0 group-hover:opacity-100" />}
                                    </div>
                                </th>
                            ))}
                            {canPerformAction && <th className="p-3 w-28 text-center bg-gray-50 sticky right-0 shadow-l">Thao Tác</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                        {paginatedRecords.length > 0 ? paginatedRecords.map(r => (
                            <RecordRow 
                                key={r.id} 
                                record={r} 
                                employees={employees} 
                                visibleColumns={visibleColumns} 
                                isSelected={selectedRecordIds.has(r.id)} 
                                canPerformAction={canPerformAction} 
                                onToggleSelect={toggleSelectRecord} 
                                onView={handleViewRecord} 
                                onEdit={handleEditRecord} 
                                onDelete={handleDeleteConfirm} 
                                onAdvanceStatus={advanceStatus}
                                onQuickUpdate={handleQuickUpdate}
                                onReturnResult={handleOpenReturnModal}
                            />
                        )) : (
                            <tr><td colSpan={Object.values(visibleColumns).filter(v => v).length + 2} className="p-8 text-center text-gray-400 italic">Không có dữ liệu hiển thị.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {paginatedRecords.length > 0 && (
                <div className="border-t border-gray-200 p-3 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 text-xs text-gray-600">
                    <div className="flex items-center gap-4">
                        <span>Tổng số: <strong>{filteredRecords.length}</strong> bản ghi</span>
                        <div className="flex items-center gap-2">
                            <span>Hiển thị</span>
                            <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 bg-white outline-none">
                                <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-1.5 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"><ChevronLeft size={16} /></button>
                        <span className="font-medium">Trang {currentPage} / {totalPages}</span>
                        <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="p-1.5 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"><ChevronRight size={16} /></button>
                    </div>
                </div>
            )}
        </div>
    );
  };

  if (!currentUser) return <Login onLogin={setCurrentUser} users={users} />;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        onOpenSettings={() => {}} // Deprecated
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
        unreadMessagesCount={unreadMessages}
        warningRecordsCount={warningCount.overdue + warningCount.approaching}
        reminderCount={activeRemindersCount}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden bg-[#0f172a] text-white p-4 flex justify-between items-center shadow-md z-20">
            <h1 className="font-bold text-sm truncate">QLHS Đo Đạc</h1>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><Menu size={24} /></button>
        </header>

        {connectionStatus === 'offline' && (
            <div className="bg-red-600 text-white text-xs py-1 px-4 text-center font-bold flex items-center justify-center gap-2 shadow-sm z-30">
                <WifiOff size={14} /> MẤT KẾT NỐI SERVER - ĐANG CHẠY CHẾ ĐỘ OFFLINE (Chỉ xem)
            </div>
        )}

        <main className="flex-1 p-4 overflow-hidden relative">
            {currentView === 'dashboard' && <DashboardView records={records} />}
            
            {currentView === 'internal_chat' && (
                <InternalChat 
                    currentUser={currentUser} 
                    wards={wards} 
                    employees={employees} 
                    users={users}
                    onResetUnread={() => setUnreadMessages(0)} 
                    notificationEnabled={notificationEnabled}
                />
            )}
            
            {currentView === 'personal_profile' && currentUser && (
                <PersonalProfile 
                    user={currentUser} 
                    records={records} 
                    onUpdateStatus={() => {}} 
                    onViewRecord={handleViewRecord} 
                    onCreateLiquidation={handleRequestLiquidation}
                />
            )}
            
            {currentView === 'receive_record' && (
                <ReceiveRecord 
                    onSave={handleAddOrUpdateRecord} 
                    onDelete={handleDeleteRecord} 
                    wards={wards} 
                    employees={employees}
                    currentUser={currentUser}
                    records={records}
                />
            )}
            
            {currentView === 'receive_contract' && (
                <ReceiveContract 
                    onSave={(r) => handleAddOrUpdateRecord(r)} // Using record update for contract (if mapped correctly) or separate api
                    wards={wards} 
                    currentUser={currentUser} 
                    records={records}
                    recordToLiquidate={recordToLiquidate}
                    onClearRecordToLiquidate={() => setRecordToLiquidate(null)}
                />
            )}
            
            {currentView === 'user_management' && isAdmin && (
                <UserManagement 
                    users={users} 
                    employees={employees}
                    onAddUser={(u) => handleUpdateUser(u, false)} 
                    onUpdateUser={(u) => handleUpdateUser(u, true)} 
                    onDeleteUser={handleDeleteUser} 
                />
            )}

            {currentView === 'employee_management' && (
                <EmployeeManagement 
                    employees={employees} 
                    onSaveEmployee={handleSaveEmployee} 
                    onDeleteEmployee={handleDeleteEmployee} 
                    wards={wards} 
                    currentUser={currentUser} 
                />
            )}

            {currentView === 'excerpt_management' && (
                <ExcerptManagement 
                    currentUser={currentUser} 
                    records={records} 
                    onUpdateRecord={(id, num) => handleQuickUpdate(id, 'excerptNumber', num)}
                    wards={wards}
                    onAddWard={(w) => setWards(prev => [...prev, w])}
                    onDeleteWard={(w) => setWards(prev => prev.filter(x => x !== w))}
                    onResetWards={() => setWards(STATIC_WARDS)}
                />
            )}

            {currentView === 'utilities' && <UtilitiesView currentUser={currentUser} />}

            {currentView === 'account_settings' && (
                <AccountSettingsView 
                    currentUser={currentUser} 
                    linkedEmployee={employees.find(e => e.id === currentUser.employeeId)}
                    onUpdate={handleUpdateCurrentAccount}
                    notificationEnabled={notificationEnabled}
                    setNotificationEnabled={setNotificationEnabled}
                />
            )}

            {currentView === 'reports' && (
                <ReportSection 
                    reportContent={globalReportContent} 
                    isGenerating={isGeneratingReport} 
                    onGenerate={handleGlobalGenerateReport} 
                    onExportExcel={handleExportReportExcel}
                    records={records} // Truyền data
                />
            )}

            {['all_records', 'check_list', 'handover_list', 'assign_tasks'].includes(currentView) && renderRecordList()}
        </main>
      </div>

      <AppModals 
          isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen}
          isImportModalOpen={isImportModalOpen} setIsImportModalOpen={setIsImportModalOpen}
          isSettingsOpen={false} setIsSettingsOpen={() => {}} // Deprecated
          isSystemSettingsOpen={isSystemSettingsOpen} setIsSystemSettingsOpen={setIsSystemSettingsOpen}
          isAssignModalOpen={isAssignModalOpen} setIsAssignModalOpen={setIsAssignModalOpen}
          isDeleteModalOpen={isDeleteModalOpen} setIsDeleteModalOpen={setIsDeleteModalOpen}
          isExportModalOpen={isExportModalOpen} setIsExportModalOpen={setIsExportModalOpen}
          isAddToBatchModalOpen={isAddToBatchModalOpen} setIsAddToBatchModalOpen={setIsAddToBatchModalOpen}
          isExcelPreviewOpen={isExcelPreviewOpen} setIsExcelPreviewOpen={setIsExcelPreviewOpen}
          isBulkUpdateModalOpen={isBulkUpdateModalOpen} setIsBulkUpdateModalOpen={setIsBulkUpdateModalOpen}
          isReturnModalOpen={isReturnModalOpen} setIsReturnModalOpen={setIsReturnModalOpen}
          
          editingRecord={editingRecord} setEditingRecord={setEditingRecord}
          viewingRecord={viewingRecord} setViewingRecord={setViewingRecord}
          deletingRecord={deletingRecord} setDeletingRecord={setDeletingRecord}
          returnRecord={returnRecord} setReturnRecord={setReturnRecord}
          assignTargetRecords={assignTargetRecords}
          exportModalType={exportModalType}
          
          previewWorkbook={previewWorkbook} previewExcelName={previewExcelName}

          handleAddOrUpdate={handleAddOrUpdateRecord}
          handleImportRecords={onImportRecords}
          handleSaveEmployee={handleSaveEmployee}
          handleDeleteEmployee={handleDeleteEmployee}
          handleDeleteAllData={handleDeleteAllData}
          confirmAssign={confirmAssign}
          handleDeleteRecord={() => { if(deletingRecord) handleDeleteRecord(deletingRecord.id); }}
          confirmDelete={(r) => handleDeleteRecord(r.id)}
          handleExcelPreview={(wb, name) => { setPreviewWorkbook(wb); setPreviewExcelName(name); setIsExcelPreviewOpen(true); }}
          executeBatchExport={executeBatchExport}
          onCreateLiquidation={handleRequestLiquidation}
          handleBulkUpdate={handleBulkUpdate}
          confirmReturnResult={handleConfirmReturnResult}

          employees={employees}
          currentUser={currentUser}
          wards={wards}
          filteredRecords={filteredRecords}
          records={records}
          selectedCount={selectedRecordIds.size}
          canPerformAction={canPerformAction}
          selectedRecordsForBulk={records.filter(r => selectedRecordIds.has(r.id))}
      />

      {toast && (
          <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up z-50 flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
              {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
              {toast.message}
          </div>
      )}
    </div>
  );
}

export default App;
