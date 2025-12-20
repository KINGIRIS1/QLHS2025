
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
import { exportReportToExcel } from './utils/excelExport';
import { generateReport } from './services/geminiService';
import { syncTemplatesFromCloud } from './services/docxService'; 
import { updateRecordApi, saveEmployeeApi, saveUserApi, forceUpdateRecordsBatchApi } from './services/api';
import { supabase } from './services/supabaseClient';
import * as XLSX from 'xlsx-js-style';
import { 
  Plus, Search, CheckSquare, Square, Users, FileSpreadsheet,
  SlidersHorizontal, AlertTriangle, Clock, Lock, WifiOff,
  ArrowUpDown, ChevronLeft, ChevronRight, Bell, MapPin, RotateCcw, Menu, FileOutput, FileSignature, ListChecks, History,
  Calendar, X, Filter, User as UserIcon, Eye, CalendarRange, CheckCircle, UserPlus, Send
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

  const handleExportReportExcel = (fromDateStr: string, toDateStr: string) => {
      if (!currentUser) return;
      exportReportToExcel(records, fromDateStr, toDateStr);
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

  const handleEditRecord = useCallback((r: RecordFile) => { setEditingRecord(r); setIsModalOpen(true); }, []);
  const handleViewRecord = useCallback((r: RecordFile) => setViewingRecord(r), []);
  const handleDeleteConfirm = useCallback((r: RecordFile) => { setDeletingRecord(r); setIsDeleteModalOpen(true); }, []);

  const renderRecordList = () => {
    const isListView = currentView === 'check_list' || currentView === 'handover_list';
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col flex-1 h-full">
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
                             <button onClick={() => setHandoverTab('today')} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${handoverTab === 'today' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><ListChecks size={16} /> Chờ giao</button>
                             <button onClick={() => setHandoverTab('history')} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${handoverTab === 'history' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><History size={16} /> Lịch sử</button>
                         </div>
                     )}
                     
                     {currentView !== 'handover_list' && !showAdvancedDateFilter && ( <div className="flex items-center gap-2 bg-white px-2 py-1.5 border border-gray-200 rounded-md shadow-sm"><Calendar size={16} className="text-gray-500" /><input type="date" value={filterSpecificDate} onChange={(e) => setFilterSpecificDate(e.target.value)} className="text-sm outline-none bg-transparent text-gray-700" title="Lọc theo ngày tiếp nhận" />{filterSpecificDate && (<button onClick={() => setFilterSpecificDate('')} className="text-gray-400 hover:text-red-500"><X size={14} /></button>)}</div>)}
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
                            <button onClick={() => setWarningFilter(prev => prev === 'approaching' ? 'none' : 'approaching')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-colors shadow-sm border ${warningFilter === 'approaching' ? 'bg-amber-500 text-white' : 'bg-white text-amber-600'}`}><Clock size={16} /> {warningCount.approaching}</button>
                        </div>
                    )}

                     <div className="relative" ref={columnSelectorRef}>
                        <button onClick={() => setShowColumnSelector(!showColumnSelector)} className="flex items-center gap-2 bg-white text-gray-700 px-3 py-1.5 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors text-sm font-medium shadow-sm"><SlidersHorizontal size={16} /> Cột</button>
                        {showColumnSelector && (<div className="absolute top-full mt-2 left-0 w-60 bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-3 max-h-80 overflow-y-auto"><div className="flex justify-between items-center mb-3 border-b pb-2"><h4 className="text-xs font-semibold text-gray-500 uppercase">Hiển thị cột</h4><button onClick={() => setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)} className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded"><RotateCcw size={10} /> Mặc định</button></div><div className="space-y-1">{COLUMN_DEFS.map(col => (<label key={col.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors select-none"><input type="checkbox" checked={visibleColumns[col.key]} onChange={() => setVisibleColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))} className="rounded text-blue-600 focus:ring-blue-500 border-gray-300 w-4 h-4" /><span className="text-sm text-gray-700">{col.label}</span></label>))}</div></div>)}
                    </div>

                    <div className="h-6 w-px bg-gray-300 mx-1 hidden sm:block"></div>

                    {canPerformAction && currentView === 'all_records' && (
                        <>
                            <button onClick={() => { setEditingRecord(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"><Plus size={16} /> Mới</button>
                            <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 transition-colors text-sm font-medium shadow-sm"><FileSpreadsheet size={16} /> Excel</button>
                        </>
                    )}

                    {canPerformAction && selectedRecordIds.size > 0 && (currentView === 'all_records' || currentView === 'assign_tasks') && (
                        <button onClick={() => { setAssignTargetRecords(records.filter(r => selectedRecordIds.has(r.id))); setIsAssignModalOpen(true); }} className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1.5 rounded-md hover:bg-purple-700 transition-colors text-sm font-medium shadow-sm"><UserPlus size={16} /> Giao ({selectedRecordIds.size})</button>
                    )}

                    {currentView === 'check_list' && canPerformAction && (
                        <div className="flex gap-2 ml-auto">
                            <button onClick={handleConfirmSignBatch} className="bg-purple-600 text-white px-3 py-1.5 rounded-md text-sm font-bold shadow-sm hover:bg-purple-700"><CheckCircle size={16} className="inline mr-1"/> Duyệt ký ({paginatedRecords.length})</button>
                            <button onClick={() => { setExportModalType('check_list'); setIsExportModalOpen(true); }} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium shadow-sm hover:bg-gray-50"><FileOutput size={16} className="inline mr-1"/> Xuất DS</button>
                        </div>
                    )}

                    {currentView === 'handover_list' && canPerformAction && (
                        <div className="flex gap-2 ml-auto">
                            {handoverTab === 'today' ? (
                                <button onClick={() => setIsAddToBatchModalOpen(true)} disabled={paginatedRecords.length === 0} className="bg-green-600 text-white px-3 py-1.5 rounded-md text-sm font-bold shadow-sm hover:bg-green-700 disabled:opacity-50"><Send size={16} className="inline mr-1"/> Chốt danh sách giao ({selectedRecordIds.size > 0 ? selectedRecordIds.size : 'Tất cả'})</button>
                            ) : (
                                <button onClick={() => { setExportModalType('handover'); setIsExportModalOpen(true); }} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium shadow-sm hover:bg-gray-50"><FileOutput size={16} className="inline mr-1"/> Xuất Excel Đợt Giao</button>
                            )}
                        </div>
                    )}
                </div>

                {showAdvancedDateFilter && (
                    <div className="bg-blue-50 p-2 rounded-lg border border-blue-100 flex items-center gap-3 animate-fade-in">
                        <span className="text-xs font-bold text-blue-700 uppercase">Lọc theo khoảng thời gian:</span>
                        <div className="flex items-center gap-2">
                            <input type="date" value={filterFromDate} onChange={(e) => setFilterFromDate(e.target.value)} className="text-sm border rounded px-2 py-1" />
                            <span>-</span>
                            <input type="date" value={filterToDate} onChange={(e) => setFilterToDate(e.target.value)} className="text-sm border rounded px-2 py-1" />
                        </div>
                        <button onClick={() => { setFilterFromDate(''); setFilterToDate(''); }} className="text-xs text-blue-600 hover:underline">Xóa lọc</button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-auto relative">
                <table className="w-full text-left table-fixed border-collapse min-w-[1200px]">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-semibold sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th className="p-3 w-10 text-center bg-gray-50">
                                {canPerformAction ? <button onClick={toggleSelectAll} className="text-gray-400 hover:text-blue-600">{selectedRecordIds.size === paginatedRecords.length && paginatedRecords.length > 0 ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}</button> : '#'}
                            </th>
                            {visibleColumns.code && <th className="p-3 w-[120px] bg-gray-50 cursor-pointer hover:bg-gray-100" onClick={() => setSortConfig({ key: 'code', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}><div className="flex items-center gap-1">Mã Hồ Sơ <ArrowUpDown size={12} /></div></th>}
                            {visibleColumns.customer && <th className="p-3 w-[180px] bg-gray-50 cursor-pointer hover:bg-gray-100" onClick={() => setSortConfig({ key: 'customerName', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}><div className="flex items-center gap-1">Chủ Sử Dụng <ArrowUpDown size={12} /></div></th>}
                            {visibleColumns.phone && <th className="p-3 w-[100px] bg-gray-50">SĐT</th>}
                            {visibleColumns.received && <th className="p-3 w-[110px] bg-gray-50 cursor-pointer hover:bg-gray-100" onClick={() => setSortConfig({ key: 'receivedDate', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}><div className="flex items-center gap-1">Ngày Nhận <ArrowUpDown size={12} /></div></th>}
                            {visibleColumns.deadline && <th className="p-3 w-[110px] bg-gray-50 cursor-pointer hover:bg-gray-100" onClick={() => setSortConfig({ key: 'deadline', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}><div className="flex items-center gap-1">Hẹn Trả <ArrowUpDown size={12} /></div></th>}
                            {visibleColumns.ward && <th className="p-3 w-[120px] bg-gray-50">Xã / Phường</th>}
                            {visibleColumns.group && <th className="p-3 w-[100px] bg-gray-50">Nhóm (Khu vực)</th>}
                            {visibleColumns.mapSheet && <th className="p-3 w-[60px] text-center bg-gray-50">Tờ</th>}
                            {visibleColumns.landPlot && <th className="p-3 w-[60px] text-center bg-gray-50">Thửa</th>}
                            {visibleColumns.assigned && <th className="p-3 w-[110px] text-center bg-gray-50">Giao NV</th>}
                            {visibleColumns.completed && <th className="p-3 w-[110px] text-center bg-gray-50">Ngày Xong</th>}
                            {visibleColumns.type && <th className="p-3 w-[130px] bg-gray-50">Loại HS</th>}
                            {visibleColumns.tech && <th className="p-3 w-[100px] bg-gray-50">Kỹ Thuật</th>}
                            {visibleColumns.batch && <th className="p-3 w-[100px] text-center bg-gray-50">Đợt Xuất</th>}
                            {visibleColumns.status && <th className="p-3 w-[120px] text-center bg-gray-50">Trạng Thái</th>}
                            {canPerformAction && <th className="p-3 w-[140px] text-center bg-gray-50 sticky right-0 shadow-l z-30">Thao Tác</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm text-gray-700 bg-white">
                        {paginatedRecords.length > 0 ? (
                            paginatedRecords.map((record) => (
                                <RecordRow
                                    key={record.id}
                                    record={record}
                                    employees={employees}
                                    visibleColumns={visibleColumns}
                                    isSelected={selectedRecordIds.has(record.id)}
                                    canPerformAction={canPerformAction}
                                    onToggleSelect={toggleSelectRecord}
                                    onView={handleViewRecord}
                                    onEdit={handleEditRecord}
                                    onDelete={handleDeleteConfirm}
                                    onAdvanceStatus={advanceStatus}
                                    onQuickUpdate={handleQuickUpdate}
                                />
                            ))
                        ) : (
                            <tr>
                                <td colSpan={20} className="p-8 text-center text-gray-400 italic">
                                    Không tìm thấy hồ sơ nào phù hợp.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="p-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center text-xs text-gray-500 shrink-0">
                <span>Hiển thị {paginatedRecords.length} / {filteredRecords.length} hồ sơ</span>
                <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"><ChevronLeft size={16} /></button>
                    <span>Trang {currentPage} / {totalPages}</span>
                    <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"><ChevronRight size={16} /></button>
                    <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="ml-2 border border-gray-300 rounded px-2 py-1 outline-none bg-white">
                        <option value={20}>20 dòng</option>
                        <option value={50}>50 dòng</option>
                        <option value={100}>100 dòng</option>
                    </select>
                </div>
            </div>
        </div>
    );
  };

  const renderContent = () => {
    // SỬA LỖI: Thêm guard clause để đảm bảo currentUser không null khi render các component con
    if (!currentUser) return null;

    switch (currentView) {
      case 'dashboard': return <DashboardView records={records} />;
      case 'internal_chat': return <InternalChat currentUser={currentUser} wards={wards} employees={employees} users={users} onResetUnread={() => setUnreadMessages(0)} notificationEnabled={notificationEnabled} />;
      case 'personal_profile': return <PersonalProfile user={currentUser} records={records} onUpdateStatus={advanceStatus} onViewRecord={handleViewRecord} />;
      case 'receive_record': return <ReceiveRecord onSave={handleAddOrUpdateRecord} onDelete={handleDeleteRecord} wards={wards} employees={employees} currentUser={currentUser} records={records} />;
      case 'receive_contract': return <ReceiveContract onSave={handleAddOrUpdateRecord} wards={wards} currentUser={currentUser} records={records} />;
      case 'all_records':
      case 'assign_tasks':
      case 'check_list':
      case 'handover_list': return renderRecordList();
      case 'user_management': return isAdmin ? <UserManagement users={users} employees={employees} onAddUser={(u) => handleUpdateUser(u, false)} onUpdateUser={(u) => handleUpdateUser(u, true)} onDeleteUser={handleDeleteUser} /> : null;
      case 'employee_management': return <EmployeeManagement employees={employees} onSaveEmployee={handleSaveEmployee} onDeleteEmployee={handleDeleteEmployee} wards={wards} currentUser={currentUser} />;
      case 'excerpt_management': return <ExcerptManagement currentUser={currentUser} records={records} onUpdateRecord={(id, num) => handleQuickUpdate(id, 'excerptNumber', num)} wards={wards} onAddWard={(w) => setWards(prev => [...prev, w])} onDeleteWard={(w) => setWards(prev => prev.filter(x => x !== w))} onResetWards={() => setWards(STATIC_WARDS)} />;
      case 'reports': return <ReportSection reportContent={globalReportContent} isGenerating={isGeneratingReport} onGenerate={handleGlobalGenerateReport} onExportExcel={handleExportReportExcel} />;
      case 'account_settings': return <AccountSettingsView currentUser={currentUser} linkedEmployee={employees.find(e => e.id === currentUser.employeeId)} onUpdate={handleUpdateCurrentAccount} notificationEnabled={notificationEnabled} setNotificationEnabled={setNotificationEnabled} />;
      case 'utilities': return <UtilitiesView currentUser={currentUser} />;
      default: return <div className="p-8 text-center text-gray-500">Chức năng đang phát triển...</div>;
    }
  };

  if (!currentUser) {
    return <Login onLogin={setCurrentUser} users={users} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 font-sans text-gray-900">
      {/* Mobile Menu Overlay */}
      <div className={`md:hidden fixed inset-0 z-40 bg-black/50 transition-opacity ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsMobileMenuOpen(false)}></div>
      
      {/* Sidebar */}
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        onOpenSettings={() => {}} 
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
        reminderCount={activeRemindersCount} // Truyền số lượng nhắc nhở vào Sidebar
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Mobile Header */}
        <div className="md:hidden bg-white border-b border-gray-200 p-3 flex justify-between items-center shadow-sm shrink-0 z-30">
            <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-600"><Menu size={24} /></button>
            <span className="font-bold text-gray-800 text-sm truncate">QL Hồ Sơ - {currentUser.name}</span>
            <div className="w-6"></div>
        </div>

        {/* Desktop Header - NEW ADDITION */}
        <div className="hidden md:flex bg-white border-b border-gray-200 px-6 py-3 justify-between items-center shadow-sm shrink-0 z-20">
            <h1 className="text-xl font-bold text-slate-800">Hệ thống Quản lý Hồ sơ</h1>
            <div className="flex items-center gap-3">
                <button className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
                    <Bell size={20} />
                    {activeRemindersCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-pink-500 rounded-full ring-1 ring-white"></span>
                    )}
                </button>
            </div>
        </div>

        {/* Global Notifications/Toast */}
        {toast && (
            <div className={`absolute top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-fade-in-up ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                <span className="font-medium text-sm">{toast.message}</span>
                <button onClick={() => setToast(null)} className="ml-2 hover:opacity-80"><X size={16} /></button>
            </div>
        )}

        {/* Connection Status Indicator */}
        {connectionStatus === 'offline' && (
            <div className="bg-red-500 text-white text-xs px-2 py-1 text-center font-bold flex items-center justify-center gap-2 shadow-md z-40">
                <WifiOff size={12} /> Mất kết nối máy chủ - Đang chạy chế độ Offline (Dữ liệu cache)
            </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden relative">
            {renderContent()}
        </main>
      </div>

      <AppModals 
          isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen}
          isImportModalOpen={isImportModalOpen} setIsImportModalOpen={setIsImportModalOpen}
          isSettingsOpen={false} setIsSettingsOpen={() => {}}
          isSystemSettingsOpen={isSystemSettingsOpen} setIsSystemSettingsOpen={setIsSystemSettingsOpen}
          isAssignModalOpen={isAssignModalOpen} setIsAssignModalOpen={setIsAssignModalOpen}
          isDeleteModalOpen={isDeleteModalOpen} setIsDeleteModalOpen={setIsDeleteModalOpen}
          isExportModalOpen={isExportModalOpen} setIsExportModalOpen={setIsExportModalOpen}
          isAddToBatchModalOpen={isAddToBatchModalOpen} setIsAddToBatchModalOpen={setIsAddToBatchModalOpen}
          isExcelPreviewOpen={isExcelPreviewOpen} setIsExcelPreviewOpen={setIsExcelPreviewOpen}
          
          editingRecord={editingRecord} setEditingRecord={setEditingRecord}
          viewingRecord={viewingRecord} setViewingRecord={setViewingRecord}
          deletingRecord={deletingRecord} setDeletingRecord={setDeletingRecord}
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
          confirmDelete={handleDeleteConfirm}
          handleExcelPreview={(wb, name) => { setPreviewWorkbook(wb); setPreviewExcelName(name); setIsExcelPreviewOpen(true); }}
          executeBatchExport={executeBatchExport}

          employees={employees} currentUser={currentUser} wards={wards}
          filteredRecords={filteredRecords} records={records} selectedCount={selectedRecordIds.size}
          canPerformAction={canPerformAction}
      />
    </div>
  );
}

export default App;
