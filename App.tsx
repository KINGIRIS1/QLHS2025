
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RecordFile, RecordStatus, Employee, User, UserRole, Message } from './types';
import { DEFAULT_WARDS as STATIC_WARDS, getNormalizedWard } from './constants';
import Login from './components/Login'; 
import MainLayout from './components/layout/MainLayout';
import AppRoutes from './components/AppRoutes';
import AppModals from './components/AppModals';
import BlockingWarningModal from './components/BlockingWarningModal';

import { DEFAULT_VISIBLE_COLUMNS, confirmAction, getReceivingWard, triggerPrioritySignedAlert } from './utils/appHelpers';
import { exportReportToExcel, exportReturnedListToExcel } from './utils/excelExport';
import { generateReport } from './services/geminiService';
import { syncTemplatesFromCloud } from './services/docxService'; 
import { updateRecordApi, saveEmployeeApi, saveUserApi, forceUpdateRecordsBatchApi, saveArchiveRecord, fetchArchiveRecordById } from './services/api';
import { logUserActivity } from './services/apiLogs';
import * as XLSX from 'xlsx-js-style';
import { CheckCircle, AlertTriangle } from 'lucide-react';

import { useAppData } from './hooks/useAppData';
import { useRecordFilter } from './hooks/useRecordFilter';
import { useReminderSystem } from './hooks/useReminderSystem';
import { useGlobalChatListener } from './hooks/useGlobalChatListener';

import { useIsMobile } from './hooks/useIsMobile';
import MobileLayout from './components/layout/MobileLayout';
import MobileRoutes from './components/mobile/MobileRoutes';
import UpdateRequiredModal from './components/UpdateRequiredModal';
import { PlotCountModal } from './components/PlotCountModal';
import WelcomeModal from './components/WelcomeModal';
import PrioritySignedModalAlert from './components/PrioritySignedModalAlert';
import { supabase, isConfigured } from './services/supabaseClient';
import { offlineDb } from './utils/offlineDb';

function App() {
  const isMobile = useIsMobile(768);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
      try {
          const stored = localStorage.getItem('currentUser');
          return stored ? JSON.parse(stored) : null;
      } catch (e) {
          return null;
      }
  });
  const [currentView, setCurrentView] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [notificationEnabled, setNotificationEnabled] = useState(() => {
      const saved = localStorage.getItem('chat_notification_enabled');
      return saved === null ? true : saved === 'true';
  });

  const [toast, setToast] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Feature specific states
  const [recordToLiquidate, setRecordToLiquidate] = useState<RecordFile | null>(null);
  const [recordForMapCorrection, setRecordForMapCorrection] = useState<RecordFile | null>(null);

  // Modal & UI States
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
      try { return JSON.parse(localStorage.getItem('visible_columns') || '') || DEFAULT_VISIBLE_COLUMNS; } catch { return DEFAULT_VISIBLE_COLUMNS; }
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecordFile | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
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
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnRecord, setReturnRecord] = useState<RecordFile | null>(null);

  const [isPlotCountModalOpen, setIsPlotCountModalOpen] = useState(false);
  const [selectedRecordForPlotCount, setSelectedRecordForPlotCount] = useState<RecordFile | null>(null);

  // Welcome Popup State
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [welcomeUser, setWelcomeUser] = useState<User | null>(null);

  // Trạng thái cho cảnh báo ngăn chặn trình ký duyệt
  const [isBlockingWarningOpen, setIsBlockingWarningOpen] = useState(false);
  const [blockingMatches, setBlockingMatches] = useState<{ record: any; source: 'active' | 'archive' }[]>([]);
  const [pendingAdvanceRecord, setPendingAdvanceRecord] = useState<RecordFile | null>(null);

  // Report States
  const [globalReportContent, setGlobalReportContent] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // --- UPDATE LOGIC STATES ---
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'downloading' | 'ready' | 'error'>('idle');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateSpeed, setUpdateSpeed] = useState(0); // Bytes per second
  const [updateDeferred, setUpdateDeferred] = useState(false); // Đã chọn cập nhật sau 10p chưa

  // Reset deferred state when an explicit broadcast arrives
  const currentUserRef = useRef(currentUser);
  useEffect(() => {
      currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
      const handleResetDeferred = (e: any) => {
          if (e.type === 'system_update_available') {
              setUpdateDeferred(false);
          } else if (e.type === 'system_update_available_broadcast') {
              const rawPayload = e.detail;
              const payload = rawPayload && rawPayload.payload ? rawPayload.payload : rawPayload;
              if (payload && (payload.target === 'all' || (currentUserRef.current && payload.target === currentUserRef.current.username))) {
                  setUpdateDeferred(false);
              }
          }
      };
      window.addEventListener('system_update_available_broadcast', handleResetDeferred);
      window.addEventListener('system_update_available', handleResetDeferred);
      return () => {
          window.removeEventListener('system_update_available_broadcast', handleResetDeferred);
          window.removeEventListener('system_update_available', handleResetDeferred);
      };
  }, []);

  // Toast effect
  useEffect(() => {
      if (toast) {
          const timer = setTimeout(() => setToast(null), 3000);
          return () => clearTimeout(timer);
      }
  }, [toast]);

  // Lắng nghe sự kiện app_toast global
  useEffect(() => {
      const handleAppToast = (e: any) => {
          if (e.detail) setToast(e.detail);
      };
      window.addEventListener('app_toast', handleAppToast);
      return () => window.removeEventListener('app_toast', handleAppToast);
  }, []);

  // Electron Nav Listener
  useEffect(() => {
      if (window.electronAPI && window.electronAPI.onNavigateToView) {
          window.electronAPI.onNavigateToView((viewId: string) => {
              if (currentUser) setCurrentView(viewId);
          });
      }
      return () => {
          if (window.electronAPI && window.electronAPI.removeNavigationListener) {
              window.electronAPI.removeNavigationListener();
          }
      };
  }, [currentUser]);

  // Sync Templates
  useEffect(() => { syncTemplatesFromCloud(); }, []);

  // Save visible columns
  useEffect(() => { localStorage.setItem('visible_columns', JSON.stringify(visibleColumns)); }, [visibleColumns]);

  // Đồng bộ dữ liệu ngăn chặn từ Cloud vào IndexedDB để thực hiện check ngăn chặn ngoại tuyến
  useEffect(() => {
      const syncBlockingRecords = async () => {
          if (!isConfigured) return;
          try {
              // Rate limiting: Chỉ sync tối đa 1 lần mỗi 30 phút
              const lastSync = localStorage.getItem('last_blocking_records_sync_time');
              const now = Date.now();
              if (lastSync && now - parseInt(lastSync, 10) < 30 * 60 * 1000) {
                  console.log('⚡ Dữ liệu ngăn chặn đã được đồng bộ gần đây, bỏ qua đồng bộ lúc khởi động.');
                  return;
              }

              console.log('🔄 Bắt đầu đồng bộ dữ liệu ngăn chặn từ Cloud...');
              
              // 1. Fetch active blocking records theo trang
              let activeData: any[] = [];
              let fromActive = 0;
              const limit = 1000;
              let hasMoreActive = true;
              try {
                  while (hasMoreActive) {
                      const { data, error } = await supabase
                          .from('blocking_records')
                          .select('*')
                          .range(fromActive, fromActive + limit - 1);
                      if (error) {
                          if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
                              console.warn('⚠️ Bảng blocking_records chưa được khởi tạo trong Database.');
                              break;
                          }
                          throw error;
                      }
                      if (data && data.length > 0) {
                          activeData = [...activeData, ...data];
                          if (data.length < limit) {
                              hasMoreActive = false;
                          } else {
                              fromActive += limit;
                          }
                      } else {
                          hasMoreActive = false;
                      }
                  }
                  if (activeData.length > 0) {
                      await offlineDb.saveRecords('blocking_records', activeData);
                  }
              } catch (err) {
                  console.warn('⚠️ Lỗi khi đồng bộ bảng blocking_records:', err);
              }

              // 2. Fetch archive blocking records theo trang
              let archiveData: any[] = [];
              let fromArchive = 0;
              let hasMoreArchive = true;
              try {
                  while (hasMoreArchive) {
                      const { data, error } = await supabase
                          .from('archive_blocking_records')
                          .select('*')
                          .range(fromArchive, fromArchive + limit - 1);
                      if (error) {
                          if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
                              console.warn('⚠️ Bảng archive_blocking_records chưa được khởi tạo trong Database.');
                              break;
                          }
                          throw error;
                      }
                      if (data && data.length > 0) {
                          archiveData = [...archiveData, ...data];
                          if (data.length < limit) {
                              hasMoreArchive = false;
                          } else {
                              fromArchive += limit;
                          }
                      } else {
                          hasMoreArchive = false;
                      }
                  }
                  if (archiveData.length > 0) {
                      await offlineDb.saveRecords('archive_blocking_records', archiveData);
                  }
              } catch (err) {
                  console.warn('⚠️ Lỗi khi đồng bộ bảng archive_blocking_records:', err);
              }

              localStorage.setItem('last_blocking_records_sync_time', now.toString());
              console.log(`✅ Đã đồng bộ dữ liệu ngăn chặn từ Cloud vào bộ nhớ IndexedDB (${activeData.length} bản ghi active, ${archiveData.length} bản ghi archive).`);
          } catch (e) {
              console.error('Lỗi khi đồng bộ dữ liệu ngăn chặn:', e);
          }
      };

      if (currentUser) {
          syncBlockingRecords();
      }
  }, [currentUser]);

  // Tự động kiểm tra và thực hiện Sao lưu định kỳ (Auto Backup) nếu đến hạn
  useEffect(() => {
      if (currentUser) {
          import('./services/backupService').then(({ checkAndRunAutoBackup }) => {
              checkAndRunAutoBackup(currentUser.name);
          });
      }
  }, [currentUser]);

  // --- CUSTOM HOOKS ---
  const { 
      records, employees, users, wards, holidays, connectionStatus, 
      isUpdateAvailable, latestVersion, updateUrl,
      setEmployees, setUsers, setRecords, setWards,
      loadData, handleAddOrUpdateRecord, handleDeleteRecord, handleImportRecords,
      handleSaveEmployee, handleDeleteEmployee, handleDeleteAllData, handleUpdateUser, handleDeleteUser
  } = useAppData(currentUser);

  // Reminder System
  const handleUpdateRecordState = useCallback((updatedRecord: RecordFile) => {
      setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
  }, [setRecords]);
  const { activeRemindersCount } = useReminderSystem(records, handleUpdateRecordState);

  // Filtering Logic
  const recordFilterProps = useRecordFilter(records, currentUser, currentView, employees);

  // Chat Listener
  useGlobalChatListener(currentUser, currentView, notificationEnabled, setUnreadMessages);

  // Permissions
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isSubadmin = currentUser?.role === UserRole.SUBADMIN;
  const isTeamLeader = currentUser?.role === UserRole.TEAM_LEADER;
  const canPerformAction = isAdmin || isSubadmin || isTeamLeader || currentUser?.role === UserRole.ONEDOOR;

  const currentEmployee = employees.find(e => e.id === currentUser?.employeeId);
  const currentDepartment = currentEmployee?.department || '';

  // --- UPDATE HANDLERS ---
  
  // Lắng nghe sự kiện update từ Electron
  useEffect(() => {
      if (window.electronAPI && window.electronAPI.onUpdateStatus) {
          window.electronAPI.onUpdateStatus((data: any) => {
              if (data.status === 'downloading') {
                  setUpdateStatus('downloading');
                  setUpdateProgress(data.progress);
                  if (data.bytesPerSecond) setUpdateSpeed(data.bytesPerSecond);
              } else if (data.status === 'downloaded') {
                  setUpdateStatus('ready');
                  setUpdateProgress(100);
                  // Tự động cài đặt khi tải xong
                  window.electronAPI?.quitAndInstall();
              } else if (data.status === 'error') {
                  setUpdateStatus('error');
                  console.error("Update error:", data.message);
              }
          });
          return () => { if (window.electronAPI?.removeUpdateListener) window.electronAPI.removeUpdateListener(); };
      }
  }, []);

  const handleUpdateNow = async () => {
      if (window.electronAPI?.downloadUpdate) {
          try {
              setUpdateStatus('downloading'); // Chuyển trạng thái ngay để hiện progress bar
              await window.electronAPI.downloadUpdate();
          } catch (e: any) {
              console.error("Download update failed:", e);
              setUpdateStatus('error');
              setToast({ type: 'error', message: "Lỗi khi tải bản cập nhật: " + (e.message || "Không xác định") });
          }
      } else {
          // Fallback cho web
          if (updateUrl) window.open(updateUrl, '_blank');
      }
  };

  const handleUpdateLater = () => {
      setUpdateDeferred(true);
      // Đặt hẹn giờ 10 phút (600,000 ms)
      setTimeout(() => {
          setToast({ type: 'success', message: 'Bắt đầu tự động cập nhật hệ thống...' });
          handleUpdateNow();
      }, 600000);
  };

  // --- LOGIC TỰ ĐỘNG CHUYỂN TAB CHO 1 CỬA ---
  useEffect(() => {
      if (currentView === 'handover_list' && currentUser?.role === UserRole.ONEDOOR && recordFilterProps.handoverTab === 'today') {
          recordFilterProps.setHandoverTab('history');
      }
  }, [currentView, currentUser, recordFilterProps.handoverTab]);

  // --- HANDLERS (Business Logic) ---

  const handleExportReportExcel = async (fromDateStr: string, toDateStr: string, ward: string) => {
      if (!currentUser) return;
      await exportReportToExcel(records, fromDateStr, toDateStr, ward, employees);
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
      try {
          localStorage.setItem('currentUser', JSON.stringify(savedUser));
      } catch (e) {}
      loadData();
      return true;
  };

  const handleGlobalGenerateReport = async (fromDateStr: string, toDateStr: string, title?: string, data?: RecordFile[]) => {
      if (!currentUser) return;
      setIsGeneratingReport(true);
      setGlobalReportContent(''); 
      const from = new Date(fromDateStr); from.setHours(0, 0, 0, 0); 
      const to = new Date(toDateStr); to.setHours(23, 59, 59, 999); 
      
      let filtered = data;
      if (!filtered) {
          filtered = records.filter(r => { if(!r.receivedDate) return false; const rDate = new Date(r.receivedDate); return rDate >= from && rDate <= to; });
      }

      const formatDateVN = (d: Date) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
      try {
          const scope = currentUser.role === UserRole.EMPLOYEE ? 'personal' : 'general';
          const result = await generateReport(filtered!, `Từ ngày ${formatDateVN(from)} đến ngày ${formatDateVN(to)}`, scope, currentUser.name, title);
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

  const isRecordSelectable = useCallback((r: RecordFile) => {
      const isHandover = (r.exportBatch || r.exportDate) && r.status !== RecordStatus.WITHDRAWN && r.status !== RecordStatus.RETURNED;
      return r.status !== RecordStatus.RETURNED && r.status !== RecordStatus.HANDOVER && !isHandover;
  }, []);

  const toggleSelectAll = useCallback(() => {
      const selectableRecords = recordFilterProps.paginatedRecords.filter(isRecordSelectable);
      const allSelectableSelected = selectableRecords.length > 0 && selectableRecords.every(r => selectedRecordIds.has(r.id));
      if (allSelectableSelected) {
          setSelectedRecordIds(prev => {
              const newSet = new Set(prev);
              selectableRecords.forEach(r => newSet.delete(r.id));
              return newSet;
          });
      } else {
          setSelectedRecordIds(prev => {
              const newSet = new Set(prev);
              selectableRecords.forEach(r => newSet.add(r.id));
              return newSet;
          });
      }
  }, [selectedRecordIds, recordFilterProps.paginatedRecords, isRecordSelectable]);

  const toggleSelectRecord = useCallback((id: string) => {
      setSelectedRecordIds(prev => {
          const r = records.find(rec => rec.id === id);
          if (r && !isRecordSelectable(r)) return prev;
          
          const newSet = new Set(prev);
          if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
          return newSet;
      });
  }, [records, isRecordSelectable]);

  const confirmAssign = async (employeeId: string) => {
      const today = new Date().toISOString().split('T')[0];
      const updatedIds = assignTargetRecords.map(r => r.id);
      
      const updates = {
          assignedTo: employeeId,
          status: RecordStatus.ASSIGNED,
          assignedDate: today,
          submissionDate: null,
          approvalDate: null,
          completedDate: null,
          resultReturnedDate: null,
          exportBatch: null,
          exportDate: null
      };

      setRecords(prev => prev.map(r => updatedIds.includes(r.id) ? { ...r, ...updates } : r));
      await Promise.all(assignTargetRecords.map(r => updateRecordApi({ ...r, ...updates } as any)));
      setIsAssignModalOpen(false); 
      setSelectedRecordIds(new Set()); 
      setToast({ type: 'success', message: `Đã giao ${assignTargetRecords.length} hồ sơ thành công!` });
  };

  const getUpdatesForStatusChange = useCallback((newStatus: RecordStatus) => {
      const todayStr = new Date().toISOString().split('T')[0];
      const updates: any = { status: newStatus };

      switch (newStatus) {
          case RecordStatus.RECEIVED:
              updates.assignedDate = null;
              updates.submissionDate = null;
              updates.approvalDate = null;
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              updates.exportBatch = null;
              updates.exportDate = null;
              break;
          case RecordStatus.ASSIGNED:
          case RecordStatus.IN_PROGRESS:
              if (!updates.assignedDate) updates.assignedDate = todayStr;
              updates.workCompletedDate = null;
              updates.submissionDate = null;
              updates.approvalDate = null;
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              updates.exportBatch = null;
              updates.exportDate = null;
              break;
          // MỚI: Trạng thái Đã thực hiện
          case RecordStatus.COMPLETED_WORK:
              // Giữ nguyên assignedDate
              updates.workCompletedDate = todayStr;
              updates.submissionDate = null; 
              updates.approvalDate = null;
              updates.completedDate = null;
              break;
          case RecordStatus.PENDING_SIGN:
              updates.submissionDate = todayStr; 
              updates.approvalDate = null;
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              break;
          case RecordStatus.SIGNED:
              updates.approvalDate = todayStr; 
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              break;
          case RecordStatus.HANDOVER:
              updates.completedDate = todayStr; 
              updates.resultReturnedDate = null;
              break;
          case RecordStatus.RETURNED:
              updates.resultReturnedDate = todayStr;
              if (!updates.completedDate) updates.completedDate = todayStr;
              break;
      }
      return updates;
  }, []);

  const handleBulkUpdate = async (field: keyof RecordFile, value: any) => {
      const selectedIds = Array.from(selectedRecordIds);
      let updates: any = { [field]: value };
      const todayStr = new Date().toISOString().split('T')[0];

      if (field === 'status') {
          updates = getUpdatesForStatusChange(value as RecordStatus);
      }
      
      if (field === 'assignedTo') {
          updates.assignedDate = todayStr;
          updates.status = RecordStatus.ASSIGNED;
          updates.submissionDate = null;
          updates.approvalDate = null;
          updates.completedDate = null;
          updates.resultReturnedDate = null;
          updates.exportBatch = null;
          updates.exportDate = null;
      }

      setRecords(prev => prev.map(r => selectedIds.includes(r.id) ? { ...r, ...updates } : r));
      const targets = records.filter(r => selectedIds.includes(r.id));
      const updatedTargets = targets.map(r => ({ ...r, ...updates }));
      await Promise.all(updatedTargets.map(r => updateRecordApi(r)));
      if (field === 'status') {
          updatedTargets.forEach(r => triggerPrioritySignedAlert(r, value as RecordStatus));
      }
      setToast({ type: 'success', message: `Đã cập nhật ${selectedIds.length} hồ sơ thành công!` });
      setSelectedRecordIds(new Set()); 
  };

  const handleQuickUpdate = useCallback(async (id: string, field: keyof RecordFile, value: any, additionalUpdates?: Partial<RecordFile>) => {
      let updates: any = { [field]: value, ...additionalUpdates };
      if (field === 'status') {
          updates = { ...updates, ...getUpdatesForStatusChange(value as RecordStatus) };
      }
      setRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
      const record = records.find(r => r.id === id); 
      if (record) {
          const updatedRecord = { ...record, ...updates };
          try { 
              await updateRecordApi(updatedRecord); 
              if (field === 'status') {
                  triggerPrioritySignedAlert(updatedRecord, value as RecordStatus);
              }
          } catch (e) { console.error("Quick update failed", e); }
      } else {
          const tempRecord = { id, ...updates } as RecordFile; 
          await updateRecordApi(tempRecord);
      }
  }, [records, getUpdatesForStatusChange]);

  const handleOpenReturnModal = useCallback((record: RecordFile) => {
      setReturnRecord(record);
      setIsReturnModalOpen(true);
  }, []);

  const handleConfirmReturnResult = useCallback(async (receiptNumber: string, receiverName: string) => {
      if (!returnRecord) return;
      const today = new Date().toISOString().split('T')[0];
      
      if (returnRecord.recordType === 'Sao lục hồ sơ') {
          try {
              const origArchive = await fetchArchiveRecordById(returnRecord.id);
              if (origArchive) {
                  const historyEntry = {
                      action: 'Đã trả kết quả',
                      status: 'returned',
                      timestamp: new Date().toISOString(),
                      user: currentUser?.name || 'Hệ thống'
                  };
                  const oldHistory = Array.isArray(origArchive.data?.history) ? origArchive.data.history : [];
                  const newHistory = [...oldHistory, historyEntry];

                  await saveArchiveRecord({
                      ...origArchive,
                      status: 'returned',
                      data: {
                          ...origArchive.data,
                          history: newHistory,
                          so_bien_lai: receiptNumber,
                          nguoi_nhan_kq: receiverName,
                          ngay_tra_ket_qua: today
                      }
                  });

                  // Phát một Event để các component đang lắng nghe "archive_realtime_update" nạp lại dữ liệu
                  window.dispatchEvent(new CustomEvent('archive_realtime_update', { detail: { type: 'saoluc' } }));
              } else {
                  console.error("Không tìm thấy hồ sơ sao lục gốc.");
              }
          } catch (e) {
              console.error("Lỗi khi trả kết quả sao lục hồ sơ:", e);
          }
      } else {
          const updates = { resultReturnedDate: today, status: RecordStatus.RETURNED, receiptNumber: receiptNumber, receiverName: receiverName }; 
          setRecords(prev => prev.map(r => r.id === returnRecord.id ? { ...r, ...updates } : r));
          await updateRecordApi({ ...returnRecord, ...updates });
      }

      setToast({ type: 'success', message: `Đã ghi nhận trả kết quả hồ sơ ${returnRecord.code} cho ${receiverName}.` });
      logUserActivity({
          action: 'RETURN',
          targetType: 'RECORD',
          targetId: returnRecord.id,
          targetCode: returnRecord.code,
          details: `Xác nhận trả kết quả hồ sơ ${returnRecord.code} cho ${receiverName} (Số biên lai: ${receiptNumber || 'N/A'})`,
          user: currentUser
      });
      setReturnRecord(null);
  }, [returnRecord, currentUser]);

  const handleUpdateReturnResult = useCallback(async (record: RecordFile, receiptNumber: string, resultReturnedDate: string, receiverName: string) => {
      if (record._isArchive) {
          try {
              const origArchive = await fetchArchiveRecordById(record.id);
              if (origArchive) {
                  const updatedArchive = {
                      ...origArchive,
                      data: {
                          ...origArchive.data,
                          so_bien_lai: receiptNumber,
                          nguoi_nhan_kq: receiverName,
                          ngay_tra_ket_qua: resultReturnedDate
                      }
                  };
                  await saveArchiveRecord(updatedArchive);
                  window.dispatchEvent(new CustomEvent('archive_realtime_update', { detail: { type: record._archiveType || 'saoluc' } }));
                  setToast({ type: 'success', message: `Đã cập nhật thông tin trả kết quả hồ sơ ${record.code}.` });
                  return true;
              }
          } catch (e) {
              console.error("Lỗi cập nhật kết quả trả của archive_record:", e);
              setToast({ type: 'error', message: 'Lỗi cập nhật thông tin trả kết quả lưu trữ!' });
              return false;
          }
      } else {
          try {
              const updates = { 
                  receiptNumber, 
                  resultReturnedDate, 
                  receiverName 
              };
              const updatedRecord = { ...record, ...updates };
              setRecords(prev => prev.map(r => r.id === record.id ? updatedRecord : r));
              const success = await updateRecordApi(updatedRecord);
              if (success) {
                  setToast({ type: 'success', message: `Đã cập nhật thông tin trả kết quả hồ sơ ${record.code}.` });
                  return true;
              }
          } catch (e) {
              console.error("Lỗi cập nhật kết quả trả của record:", e);
              setToast({ type: 'error', message: 'Lỗi cập nhật thông tin trả kết quả!' });
              return false;
          }
      }
      return false;
  }, [setRecords]);

  const handleMapCorrectionRequest = useCallback(async (record: RecordFile) => {
      const newValue = !record.needsMapCorrection;
      const updatedRecord = { ...record, needsMapCorrection: newValue };
      setRecords(prev => prev.map(r => r.id === record.id ? updatedRecord : r));
      await updateRecordApi(updatedRecord);
      if (newValue) {
          setRecordForMapCorrection(updatedRecord);
          setCurrentView('utilities');
          setToast({ type: 'success', message: `Đã chuyển hồ sơ ${record.code} sang tiện ích chỉnh lý bản đồ.` });
      } else {
          setToast({ type: 'success', message: `Đã HỦY yêu cầu chỉnh lý cho hồ sơ ${record.code}.` });
      }
  }, []);

  const checkBlocking = useCallback(async (record: RecordFile) => {
      const normalize = (str: any) => {
          if (str === null || str === undefined) return '';
          return String(str)
              .trim()
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/đ/g, 'd');
      };

      const cleanCommune = (c: string) => {
          return c.replace(/^(xa|phuong|thi tran)\s+/gi, '').trim();
      };

      const cleanCommuneAccents = (c: string) => {
          if (!c) return '';
          return c.replace(/^(xã|phường|thị trấn|xa|phuong|thi tran)\s+/gi, '').trim();
      };

      const matchTokens = (str1: string, str2: string) => {
          if (!str1 || !str2) return false;
          const tokens1 = str1.split(/[,;\s+vvn&]+/i).map(t => t.trim()).filter(Boolean);
          const tokens2 = str2.split(/[,;\s+vvn&]+/i).map(t => t.trim()).filter(Boolean);
          
          return tokens1.some(t1 => {
              return tokens2.some(t2 => {
                  if (t1 === t2) return true;
                  if (t1.includes('/') || t2.includes('/')) {
                      const base1 = t1.split('/')[0];
                      const base2 = t2.split('/')[0];
                      return base1 === base2;
                  }
                  return false;
              });
          });
      };

      const wardNorm = normalize(record.ward);
      const plotNorm = normalize(record.landPlot);
      const sheetNorm = normalize(record.mapSheet);

      if (!wardNorm && !plotNorm) return [];

      const cleanWard = cleanCommune(wardNorm);

      let activeList: any[] = [];
      let archiveList: any[] = [];
      let loadedFromSupabase = false;

      try {
              // Ưu tiên dữ liệu trực tuyến từ Supabase khi có kết nối mạng và đã cấu hình
              if (isConfigured && navigator.onLine) {
                  const orParts: string[] = [];

                  // Ưu tiên truy vấn theo thửa đất hoặc tờ bản đồ để tối đa hóa hiệu năng và độ chính xác, tránh tải thừa dữ liệu xã
                  if (plotNorm) {
                      const plotTokens = plotNorm.split(/[,;\s+vvn&]+/i).map(t => t.trim()).filter(Boolean);
                      const searchTerms = new Set<string>();
                      plotTokens.forEach(token => {
                          searchTerms.add(token);
                          if (token.includes('/')) {
                              const base = token.split('/')[0];
                              if (base) searchTerms.add(base);
                          }
                      });
                      searchTerms.forEach(term => {
                          orParts.push(`plots.cs.[{"oldPlotNumber":"${term}"}]`);
                          orParts.push(`plots.cs.[{"newPlotNumber":"${term}"}]`);
                      });
                  } else if (sheetNorm) {
                      const sheetTokens = sheetNorm.split(/[,;\s+vvn&]+/i).map(t => t.trim()).filter(Boolean);
                      const searchTerms = new Set<string>();
                      sheetTokens.forEach(token => {
                          searchTerms.add(token);
                          if (token.includes('/')) {
                              const base = token.split('/')[0];
                              if (base) searchTerms.add(base);
                          }
                      });
                      searchTerms.forEach(term => {
                          orParts.push(`plots.cs.[{"oldMapSheetNumber":"${term}"}]`);
                          orParts.push(`plots.cs.[{"newMapSheetNumber":"${term}"}]`);
                      });
                  } else if (cleanWard) {
                      const rawWard = record.ward || '';
                      const rawCleanWard = cleanCommuneAccents(rawWard);
                      if (rawCleanWard) {
                          orParts.push(`oldCommune.ilike.%${rawCleanWard}%`);
                          orParts.push(`newCommune.ilike.%${rawCleanWard}%`);
                      }
                      if (cleanWard && cleanWard !== normalize(rawCleanWard)) {
                          orParts.push(`oldCommune.ilike.%${cleanWard}%`);
                          orParts.push(`newCommune.ilike.%${cleanWard}%`);
                      }
                  }

                  if (orParts.length > 0) {
                      const orQuery = orParts.join(',');
                      const [activeRes, archiveRes] = await Promise.all([
                          supabase.from('blocking_records').select('*').or(orQuery),
                          supabase.from('archive_blocking_records').select('*').or(orQuery)
                      ]);
                      if (activeRes.error) throw activeRes.error;
                      if (archiveRes.error) throw archiveRes.error;
                      activeList = activeRes.data || [];
                      archiveList = archiveRes.data || [];
                      loadedFromSupabase = true;
                  }
              }
      } catch (e) {
          console.warn('Lỗi khi truy vấn dữ liệu trực tuyến từ Supabase, chuyển sang sử dụng dữ liệu ngoại tuyến:', e);
          loadedFromSupabase = false;
      }

      // Chỉ sử dụng dữ liệu ngoại tuyến khi không có mạng, chưa cấu hình, hoặc truy vấn trực tuyến thất bại
      if (!loadedFromSupabase) {
          try {
              activeList = await offlineDb.getRecords('blocking_records');
              archiveList = await offlineDb.getRecords('archive_blocking_records');
          } catch (e) {
              console.error('Lỗi khi truy xuất dữ liệu ngăn chặn ngoại tuyến:', e);
          }
      }

      const matches: { record: any; source: 'active' | 'archive' }[] = [];

      const checkList = (list: any[], source: 'active' | 'archive') => {
          list.forEach(blocking => {
              const blockOldNorm = normalize(blocking.oldCommune);
              const blockNewNorm = normalize(blocking.newCommune);
              
              const cleanBlockOld = cleanCommune(blockOldNorm);
              const cleanBlockNew = cleanCommune(blockNewNorm);

              // Xử lý khớp xã/phường thông minh:
              // Nếu hồ sơ hoặc dữ liệu chặn thiếu xã/phường -> bỏ qua kiểm tra xã và xem như khớp (để đối soát Tờ/Thửa/Tên chủ toàn hệ thống)
              const isCommuneMatch = 
                  (!cleanWard) || 
                  (!cleanBlockOld && !cleanBlockNew) ||
                  (cleanBlockOld && (cleanBlockOld === cleanWard || cleanBlockOld.includes(cleanWard) || cleanWard.includes(cleanBlockOld))) ||
                  (cleanBlockNew && (cleanBlockNew === cleanWard || cleanBlockNew.includes(cleanWard) || cleanWard.includes(cleanBlockNew)));

              // 1. Đối soát Tờ/Thửa đất
              const isPlotMatch = isCommuneMatch && plotNorm && (blocking.plots?.some((p: any) => {
                  const oldPlotNorm = normalize(p.oldPlotNumber);
                  const newPlotNorm = normalize(p.newPlotNumber);
                  const oldSheetNorm = normalize(p.oldMapSheetNumber);
                  const newSheetNorm = normalize(p.newMapSheetNumber);

                  const plotMatches = matchTokens(plotNorm, oldPlotNorm) || matchTokens(plotNorm, newPlotNorm);

                  let sheetMatches = !sheetNorm;
                  if (!sheetMatches) {
                      const hasOldSheet = !!oldSheetNorm;
                      const hasNewSheet = !!newSheetNorm;
                      if (!hasOldSheet && !hasNewSheet) {
                          sheetMatches = true;
                      } else {
                          const oldMatch = hasOldSheet && matchTokens(sheetNorm, oldSheetNorm);
                          const newMatch = hasNewSheet && matchTokens(sheetNorm, newSheetNorm);
                          sheetMatches = oldMatch || newMatch;
                      }
                  }

                  return plotMatches && sheetMatches;
              }) ?? false);

              // 2. Đối soát Tên chủ sử dụng
              let isOwnerMatch = false;
              const fileCustomer = normalize(record.customerName);
              if (isCommuneMatch && fileCustomer && blocking.owners && blocking.owners.length > 0) {
                  isOwnerMatch = blocking.owners.some((bo: string) => {
                      const boNorm = normalize(bo);
                      return boNorm && (fileCustomer === boNorm || fileCustomer.includes(boNorm) || boNorm.includes(fileCustomer));
                  });
              }

              // Loại bỏ việc cảnh báo khi chỉ trùng tên chủ sử dụng (Yêu cầu phải trùng thửa đất/isPlotMatch)
              if (isPlotMatch) {
                  matches.push({ record: blocking, source });
              }
          });
      };

      checkList(activeList, 'active');
      checkList(archiveList, 'archive');

      return matches;
  }, []);

  const proceedAdvanceStatus = useCallback(async (record: RecordFile) => {
      // UPDATE: Thêm COMPLETED_WORK vào luồng
      const flow = [RecordStatus.RECEIVED, RecordStatus.ASSIGNED, RecordStatus.IN_PROGRESS, RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER];
      const idx = flow.indexOf(record.status);
      if (idx < flow.length - 1) {
          const nextStatus = flow[idx + 1];
          // Nếu chuyển lên PENDING_SIGN, yêu cầu nhập số lượng thửa cho hồ sơ Đo đạc và hồ sơ Khác
          if (nextStatus === RecordStatus.PENDING_SIGN && !['Sao lục', 'Công văn'].includes(record.recordType || '')) {
              setSelectedRecordForPlotCount(record);
              setIsPlotCountModalOpen(true);
              return;
          }
          const updates = getUpdatesForStatusChange(nextStatus);
          const updatedRecord = { ...record, ...updates };
          setRecords(prev => prev.map(r => r.id === record.id ? updatedRecord : r));
          await updateRecordApi(updatedRecord);
          triggerPrioritySignedAlert(updatedRecord, nextStatus);
      }
  }, [getUpdatesForStatusChange]);

  const advanceStatus = useCallback(async (record: RecordFile) => {
      if (record.status === RecordStatus.RECEIVED) { 
          setAssignTargetRecords([record]); 
          setIsAssignModalOpen(true); 
          return; 
      }

      // Kiểm tra xem trạng thái tiếp theo có phải trình ký duyệt (PENDING_SIGN) hoặc đã thực hiện (COMPLETED_WORK) hay không
      const flow = [RecordStatus.RECEIVED, RecordStatus.ASSIGNED, RecordStatus.IN_PROGRESS, RecordStatus.COMPLETED_WORK, RecordStatus.PENDING_SIGN, RecordStatus.SIGNED, RecordStatus.HANDOVER];
      const idx = flow.indexOf(record.status);
      if (idx < flow.length - 1) {
          const nextStatus = flow[idx + 1];
          if (nextStatus === RecordStatus.PENDING_SIGN || nextStatus === RecordStatus.COMPLETED_WORK) {
              const matches = await checkBlocking(record);
              if (matches.length > 0) {
                  setBlockingMatches(matches);
                  setPendingAdvanceRecord(record);
                  setIsBlockingWarningOpen(true);
                  return;
              }
          }
      }

      await proceedAdvanceStatus(record);
  }, [checkBlocking, proceedAdvanceStatus]);

  const handleConfirmPlotCount = useCallback(async (plotCount: number) => {
      if (selectedRecordForPlotCount) {
          const nextStatus = RecordStatus.PENDING_SIGN;
          const updates = { ...getUpdatesForStatusChange(nextStatus), plotCount };
          setRecords(prev => prev.map(r => r.id === selectedRecordForPlotCount.id ? { ...r, ...updates } : r));
          await updateRecordApi({ ...selectedRecordForPlotCount, ...updates });
          setIsPlotCountModalOpen(false);
          setSelectedRecordForPlotCount(null);
          setToast({ type: 'success', message: `Số thửa đã cập nhật thành ${plotCount} và chuyển hồ sơ ${selectedRecordForPlotCount.code} sang Chờ ký duyệt.` });
      }
  }, [selectedRecordForPlotCount, getUpdatesForStatusChange]);

  const executeBatchExport = async (batchNumber: number, batchDate: string, customWardsMap?: Record<string, string> | string) => {
      const todayStr = recordFilterProps.filterDate || new Date().toISOString().split('T')[0];
      const candidates = selectedRecordIds.size > 0 ? records.filter(r => selectedRecordIds.has(r.id)) : recordFilterProps.filteredRecords;
      const recordsToExport = candidates.filter(r => r.status === RecordStatus.SIGNED || (r.status === RecordStatus.WITHDRAWN && !r.exportBatch));
      if (recordsToExport.length === 0) return;

      const updatesToApply = recordsToExport.map(r => {
          const nextStatus = r.status === RecordStatus.WITHDRAWN ? RecordStatus.WITHDRAWN : RecordStatus.HANDOVER;
          let recWard = r.receivingWard || getReceivingWard(r);
          if (typeof customWardsMap === 'object' && customWardsMap && customWardsMap[r.id]) {
              recWard = customWardsMap[r.id];
          } else if (typeof customWardsMap === 'string' && customWardsMap) {
              recWard = customWardsMap;
          }
          return { 
              ...r, 
              exportBatch: batchNumber, 
              exportDate: batchDate, 
              status: nextStatus, 
              completedDate: r.completedDate || todayStr,
              receivingWard: recWard
          };
      });

      setRecords(prev => prev.map(r => {
          const updated = updatesToApply.find(u => u.id === r.id);
          return updated ? updated : r;
      }));
      await Promise.all(updatesToApply.map(r => updateRecordApi(r)));
      updatesToApply.forEach(r => triggerPrioritySignedAlert(r, r.status));
      setSelectedRecordIds(new Set()); 
      setToast({ type: 'success', message: `Đã chốt danh sách ĐỢT ${batchNumber} (${recordsToExport.length} hồ sơ) thành công.` });
  };

  const handleConfirmSignBatch = async () => {
      if (!canPerformAction) return;
      let pendingSign = recordFilterProps.filteredRecords.filter(r => r.status === RecordStatus.PENDING_SIGN);
      if (selectedRecordIds.size > 0) {
          pendingSign = pendingSign.filter(r => selectedRecordIds.has(r.id));
      }
      if (pendingSign.length === 0) {
          setToast({ 
              type: 'error', 
              message: selectedRecordIds.size > 0 
                  ? "Không có hồ sơ nào đang chờ ký trong số các hồ sơ được chọn." 
                  : "Không có hồ sơ nào đang chờ ký." 
          }); 
          return; 
      }
      const confirmMsg = selectedRecordIds.size > 0 
          ? `Xác nhận chuyển ${pendingSign.length} hồ sơ đã chọn sang "Đã ký"?`
          : `Xác nhận chuyển tất cả ${pendingSign.length} hồ sơ sang "Đã ký"?`;

      if (await confirmAction(confirmMsg)) {
          const todayStr = new Date().toISOString().split('T')[0];
          const updates = { status: RecordStatus.SIGNED, approvalDate: todayStr, completedDate: null };
          const updatedList = pendingSign.map(r => ({ ...r, ...updates }));
          setRecords(prev => prev.map(r => pendingSign.find(p => p.id === r.id) ? { ...r, ...updates } : r));
          await Promise.all(updatedList.map(r => updateRecordApi(r)));
          updatedList.forEach(r => triggerPrioritySignedAlert(r, RecordStatus.SIGNED));
          setSelectedRecordIds(new Set());
          setToast({ type: 'success', message: `Đã chuyển ${pendingSign.length} hồ sơ sang "Đã ký".` });
      }
  };

  const handleWithdrawSelectedRecords = async () => {
      if (selectedRecordIds.size === 0 || !currentUser) return;
      const canWithdraw = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN || currentUser.role === UserRole.RECEPTION_HANDOVER;
      if (!canWithdraw) return;

      if (await confirmAction(`Xác nhận rút ${selectedRecordIds.size} hồ sơ đã chọn sang trạng thái "CSD rút hồ sơ"?`)) {
          const todayStr = new Date().toISOString().split('T')[0];
          const targets = records.filter(r => selectedRecordIds.has(r.id));
          const updatesToApply = targets.map(r => ({
              ...r,
              status: RecordStatus.WITHDRAWN,
              completedDate: r.completedDate || todayStr,
          }));

          setRecords(prev => prev.map(r => {
              const updated = updatesToApply.find(u => u.id === r.id);
              return updated ? updated : r;
          }));

          await Promise.all(updatesToApply.map(r => updateRecordApi(r)));
          setSelectedRecordIds(new Set());
          setToast({ type: 'success', message: `Đã chuyển ${updatesToApply.length} hồ sơ sang trạng thái "CSD rút hồ sơ".` });
      }
  };

  const handleExportReturnedList = () => {
      if (!canPerformAction) return;
      exportReturnedListToExcel(recordFilterProps.filteredRecords, recordFilterProps.filterFromDate, recordFilterProps.filterToDate, recordFilterProps.filterWard);
  };

  const handleLogin = (user: User) => {
      setCurrentUser(user);
      try {
          localStorage.setItem('currentUser', JSON.stringify(user));
      } catch (e) {}
      setWelcomeUser(user);
      setIsWelcomeModalOpen(true);
      logUserActivity({
          action: 'LOGIN',
          targetType: 'USER',
          targetId: user.username,
          details: `Người dùng ${user.name} (${user.username}) đăng nhập hệ thống`,
          user: user
      });
      if (user.role === UserRole.EMPLOYEE) {
          const emp = employees.find(e => e.id === user.employeeId);
          const dept = (emp?.department || '').trim().toLowerCase();
          if (dept.includes('đo đạc')) setCurrentView('all_records');
          else if (dept.includes('lưu trữ')) setCurrentView('archive_records');
          else if (dept.includes('đăng ký')) setCurrentView('dangky_records');
          else setCurrentView('personal_profile');
      } else {
          setCurrentView('dashboard');
      }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
  };

  if (!currentUser) {
      return (
          <>
            <UpdateRequiredModal 
                visible={isUpdateAvailable && !updateDeferred}
                version={latestVersion}
                downloadStatus={updateStatus}
                progress={updateProgress}
                downloadSpeed={updateSpeed}
                onUpdateNow={handleUpdateNow}
                onUpdateLater={handleUpdateLater}
            />
            <Login onLogin={handleLogin} users={users} />
          </>
      );
  }

  if (isMobile) {
    return (
      <>
        <UpdateRequiredModal 
            visible={isUpdateAvailable && !updateDeferred}
            version={latestVersion}
            downloadStatus={updateStatus}
            progress={updateProgress}
            downloadSpeed={updateSpeed}
            onUpdateNow={handleUpdateNow}
            onUpdateLater={handleUpdateLater}
        />
        <MobileLayout
          currentUser={currentUser}
          currentView={currentView}
          setCurrentView={setCurrentView}
          onLogout={handleLogout}
          unreadMessages={unreadMessages}
          activeRemindersCount={activeRemindersCount}
          currentDepartment={currentDepartment}
        >
        <MobileRoutes
          currentView={currentView}
          setCurrentView={setCurrentView}
          currentUser={currentUser}
          records={records}
          employees={employees}
          users={users}
          wards={wards}
          holidays={holidays}
          onSaveRecord={handleAddOrUpdateRecord}
          currentDepartment={currentDepartment}
          handleViewRecord={(r) => setViewingRecord(r)}
          setEditingRecord={setEditingRecord}
          setIsModalOpen={setIsModalOpen}
          setDeletingRecord={setDeletingRecord}
          setIsDeleteModalOpen={setIsDeleteModalOpen}
          handleUpdateCurrentAccount={handleUpdateCurrentAccount}
          notificationEnabled={notificationEnabled}
          setNotificationEnabled={setNotificationEnabled}
          setUnreadMessages={setUnreadMessages}
          onLogout={handleLogout}
          onAddUser={(u) => { saveUserApi(u, false).then(res => { if(res) { setUsers(prev => [...prev, res]); loadData(); } }); }}
          onUpdateUser={(u) => handleUpdateUser(u, true)}
          onDeleteUser={handleDeleteUser}
          onSaveEmployee={handleSaveEmployee}
          onDeleteEmployee={handleDeleteEmployee}
          onDeleteAllData={handleDeleteAllData}
          onHolidaysChanged={loadData}
        />
        
        <AppModals 
            isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen}
            isImportModalOpen={isImportModalOpen} setIsImportModalOpen={setIsImportModalOpen}
            isSettingsOpen={false} setIsSettingsOpen={() => {}} 
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
            onRefreshData={loadData}
            confirmAssign={confirmAssign}
            handleDeleteRecord={() => { if(deletingRecord) handleDeleteRecord(deletingRecord.id); }}
            confirmDelete={(r) => handleDeleteRecord(r.id)}
            handleExcelPreview={(wb, name) => { setPreviewWorkbook(wb); setPreviewExcelName(name); setIsExcelPreviewOpen(true); }}
            executeBatchExport={executeBatchExport}
            onCreateLiquidation={(r) => { setRecordToLiquidate(r); setCurrentView('receive_contract'); }}
            handleBulkUpdate={handleBulkUpdate}
            confirmReturnResult={handleConfirmReturnResult}

            employees={employees}
            currentUser={currentUser}
            wards={wards}
            filteredRecords={recordFilterProps.filteredRecords}
            records={records}
            selectedCount={selectedRecordIds.size}
            canPerformAction={canPerformAction}
            selectedRecordsForBulk={records.filter(r => selectedRecordIds.has(r.id))}
            currentView={currentView}
            holidays={holidays}
        />

        {toast && (
            <div className={`fixed bottom-20 right-4 px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up z-50 flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                {toast.message}
            </div>
        )}
        <WelcomeModal
            isOpen={isWelcomeModalOpen}
            onClose={() => setIsWelcomeModalOpen(false)}
            user={welcomeUser || currentUser}
            employees={employees}
            records={records}
            onSelectRecord={(r) => setViewingRecord(r)}
        />
      </MobileLayout>
      </>
    );
  }

  return (
    <MainLayout
        currentUser={currentUser}
        currentDepartment={currentDepartment}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onLogout={handleLogout}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isGeneratingReport={isGeneratingReport}
        isUpdateAvailable={isUpdateAvailable} 
        latestVersion={latestVersion}
        updateUrl={updateUrl}
        unreadMessages={unreadMessages}
        warningCount={recordFilterProps.warningCount}
        activeRemindersCount={activeRemindersCount}
        connectionStatus={connectionStatus}
        showUpdateModal={isUpdateAvailable && !updateDeferred}
        updateVersion={latestVersion}
        updateDownloadStatus={updateStatus}
        updateProgress={updateProgress}
        updateSpeed={updateSpeed}
        onUpdateNow={handleUpdateNow}
        onUpdateLater={handleUpdateLater}
    >
        <AppRoutes 
            currentView={currentView}
            setCurrentView={setCurrentView}
            currentUser={currentUser}
            records={records}
            employees={employees}
            users={users}
            wards={wards}
            holidays={holidays}
            
            setUnreadMessages={setUnreadMessages}
            notificationEnabled={notificationEnabled}
            setNotificationEnabled={setNotificationEnabled}
            recordToLiquidate={recordToLiquidate}
            setRecordToLiquidate={setRecordToLiquidate}
            recordForMapCorrection={recordForMapCorrection}
            
            handleViewRecord={(r) => setViewingRecord(r)}
            handleMapCorrectionRequest={handleMapCorrectionRequest}
            handleUpdateReturnResult={handleUpdateReturnResult}
            handleAddOrUpdateRecord={handleAddOrUpdateRecord}
            handleDeleteRecord={handleDeleteRecord}
            handleUpdateUser={handleUpdateUser}
            handleDeleteUser={handleDeleteUser}
            handleSaveEmployee={handleSaveEmployee}
            handleDeleteEmployee={handleDeleteEmployee}
            handleDeleteAllData={handleDeleteAllData}
            onRefreshData={loadData}
            setWards={setWards}
            onResetWards={() => setWards(STATIC_WARDS)}
            handleQuickUpdate={handleQuickUpdate}
            handleUpdateCurrentAccount={handleUpdateCurrentAccount}
            
            globalReportContent={globalReportContent}
            isGeneratingReport={isGeneratingReport}
            handleGlobalGenerateReport={handleGlobalGenerateReport}
            handleExportReportExcel={handleExportReportExcel}

            {...recordFilterProps}
            
            selectedRecordIds={selectedRecordIds}
            toggleSelectAll={toggleSelectAll}
            toggleSelectRecord={toggleSelectRecord}
            visibleColumns={visibleColumns}
            setVisibleColumns={setVisibleColumns}
            
            setIsModalOpen={setIsModalOpen}
            setEditingRecord={setEditingRecord}
            setIsImportModalOpen={setIsImportModalOpen}
            setIsBulkUpdateModalOpen={setIsBulkUpdateModalOpen}
            setIsAddToBatchModalOpen={setIsAddToBatchModalOpen}
            handleExportReturnedList={handleExportReturnedList}
            handleConfirmSignBatch={handleConfirmSignBatch}
            handleWithdrawSelectedRecords={handleWithdrawSelectedRecords}
            setAssignTargetRecords={setAssignTargetRecords}
            setIsAssignModalOpen={setIsAssignModalOpen}
            setExportModalType={setExportModalType}
            setIsExportModalOpen={setIsExportModalOpen}
            setDeletingRecord={setDeletingRecord}
            setIsDeleteModalOpen={setIsDeleteModalOpen}
            advanceStatus={advanceStatus}
            handleOpenReturnModal={handleOpenReturnModal}
        />

        <AppModals 
            isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen}
            isImportModalOpen={isImportModalOpen} setIsImportModalOpen={setIsImportModalOpen}
            isSettingsOpen={false} setIsSettingsOpen={() => {}} 
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
            onRefreshData={loadData}
            confirmAssign={confirmAssign}
            handleDeleteRecord={() => { if(deletingRecord) handleDeleteRecord(deletingRecord.id); }}
            confirmDelete={(r) => handleDeleteRecord(r.id)}
            handleExcelPreview={(wb, name) => { setPreviewWorkbook(wb); setPreviewExcelName(name); setIsExcelPreviewOpen(true); }}
            executeBatchExport={executeBatchExport}
            onCreateLiquidation={(r) => { setRecordToLiquidate(r); setCurrentView('receive_contract'); }}
            handleBulkUpdate={handleBulkUpdate}
            confirmReturnResult={handleConfirmReturnResult}

            employees={employees}
            currentUser={currentUser}
            wards={wards}
            filteredRecords={recordFilterProps.filteredRecords}
            records={records}
            selectedCount={selectedRecordIds.size}
            canPerformAction={canPerformAction}
            selectedRecordsForBulk={records.filter(r => selectedRecordIds.has(r.id))}
            currentView={currentView}
            holidays={holidays}
        />

        {toast && (
            <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up z-50 flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                {toast.message}
            </div>
        )}

        <PlotCountModal
            isOpen={isPlotCountModalOpen}
            onClose={() => {
                setIsPlotCountModalOpen(false);
                setSelectedRecordForPlotCount(null);
            }}
            onConfirm={handleConfirmPlotCount}
            record={selectedRecordForPlotCount}
        />

        <BlockingWarningModal
            isOpen={isBlockingWarningOpen}
            onClose={() => {
                setIsBlockingWarningOpen(false);
                setPendingAdvanceRecord(null);
                setBlockingMatches([]);
            }}
            onConfirm={() => {
                if (pendingAdvanceRecord) {
                    proceedAdvanceStatus(pendingAdvanceRecord);
                }
                setIsBlockingWarningOpen(false);
                setPendingAdvanceRecord(null);
                setBlockingMatches([]);
            }}
            matches={blockingMatches}
            recordFile={pendingAdvanceRecord}
        />

        <WelcomeModal
            isOpen={isWelcomeModalOpen}
            onClose={() => setIsWelcomeModalOpen(false)}
            user={welcomeUser || currentUser}
            employees={employees}
            records={records}
            onSelectRecord={(r) => setViewingRecord(r)}
        />

        <PrioritySignedModalAlert records={records} />
    </MainLayout>
  );
}

export default App;
