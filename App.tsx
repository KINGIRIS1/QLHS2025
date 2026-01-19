
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RecordFile, RecordStatus, Employee, User, UserRole, Message } from './types';
import { DEFAULT_WARDS as STATIC_WARDS } from './constants';
import Login from './components/Login'; 
import MainLayout from './components/layout/MainLayout';
import AppRoutes from './components/AppRoutes';
import AppModals from './components/AppModals';

import { DEFAULT_VISIBLE_COLUMNS, confirmAction } from './utils/appHelpers';
import { exportReportToExcel, exportReturnedListToExcel } from './utils/excelExport';
import { generateReport } from './services/geminiService';
import { syncTemplatesFromCloud } from './services/docxService'; 
import { updateRecordApi, saveEmployeeApi, saveUserApi, forceUpdateRecordsBatchApi } from './services/api';
import * as XLSX from 'xlsx-js-style';
import { CheckCircle, AlertTriangle } from 'lucide-react';

import { useAppData } from './hooks/useAppData';
import { useRecordFilter } from './hooks/useRecordFilter';
import { useReminderSystem } from './hooks/useReminderSystem';
import { useGlobalChatListener } from './hooks/useGlobalChatListener';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
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
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnRecord, setReturnRecord] = useState<RecordFile | null>(null);

  // Report States
  const [globalReportContent, setGlobalReportContent] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // --- UPDATE LOGIC STATES ---
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'downloading' | 'ready' | 'error'>('idle');
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateSpeed, setUpdateSpeed] = useState(0); // Bytes per second
  const [updateDeferred, setUpdateDeferred] = useState(false); // Đã chọn cập nhật sau 10p chưa

  // Toast effect
  useEffect(() => {
      if (toast) {
          const timer = setTimeout(() => setToast(null), 3000);
          return () => clearTimeout(timer);
      }
  }, [toast]);

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
              alert("Lỗi khi tải bản cập nhật: " + (e.message || "Không xác định"));
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
      loadData();
      return true;
  };

  const handleGlobalGenerateReport = async (fromDateStr: string, toDateStr: string, title?: string) => {
      if (!currentUser) return;
      setIsGeneratingReport(true);
      setGlobalReportContent(''); 
      const from = new Date(fromDateStr); from.setHours(0, 0, 0, 0); 
      const to = new Date(toDateStr); to.setHours(23, 59, 59, 999); 
      const filtered = records.filter(r => { if(!r.receivedDate) return false; const rDate = new Date(r.receivedDate); return rDate >= from && rDate <= to; });
      const formatDateVN = (d: Date) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
      try {
          const scope = currentUser.role === UserRole.EMPLOYEE ? 'personal' : 'general';
          const result = await generateReport(filtered, `Từ ngày ${formatDateVN(from)} đến ngày ${formatDateVN(to)}`, scope, currentUser.name, title);
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
      if (selectedRecordIds.size === recordFilterProps.paginatedRecords.length && recordFilterProps.paginatedRecords.length > 0) setSelectedRecordIds(new Set());
      else setSelectedRecordIds(new Set(recordFilterProps.paginatedRecords.map(r => r.id)));
  }, [selectedRecordIds, recordFilterProps.paginatedRecords]);

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

  const getUpdatesForStatusChange = (newStatus: RecordStatus) => {
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
              updates.submissionDate = null;
              updates.approvalDate = null;
              updates.completedDate = null;
              updates.resultReturnedDate = null;
              updates.exportBatch = null;
              updates.exportDate = null;
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
  };

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
      await Promise.all(targets.map(r => updateRecordApi({ ...r, ...updates })));
      setToast({ type: 'success', message: `Đã cập nhật ${selectedIds.length} hồ sơ thành công!` });
      setSelectedRecordIds(new Set()); 
  };

  const handleQuickUpdate = useCallback(async (id: string, field: keyof RecordFile, value: string) => {
      let updates: any = { [field]: value };
      if (field === 'status') {
          updates = getUpdatesForStatusChange(value as RecordStatus);
      }
      setRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
      const record = records.find(r => r.id === id); 
      if (record) {
          try { await updateRecordApi({ ...record, ...updates }); } catch (e) { console.error("Quick update failed", e); }
      } else {
          const tempRecord = { id } as RecordFile; 
          await updateRecordApi({ ...tempRecord, ...updates });
      }
  }, [records]);

  const handleOpenReturnModal = useCallback((record: RecordFile) => {
      setReturnRecord(record);
      setIsReturnModalOpen(true);
  }, []);

  const handleConfirmReturnResult = useCallback(async (receiptNumber: string, receiverName: string) => {
      if (!returnRecord) return;
      const today = new Date().toISOString().split('T')[0];
      const updates = { resultReturnedDate: today, status: RecordStatus.RETURNED, receiptNumber: receiptNumber, receiverName: receiverName }; 
      setRecords(prev => prev.map(r => r.id === returnRecord.id ? { ...r, ...updates } : r));
      await updateRecordApi({ ...returnRecord, ...updates });
      setToast({ type: 'success', message: `Đã ghi nhận trả kết quả hồ sơ ${returnRecord.code} cho ${receiverName}.` });
      setReturnRecord(null);
  }, [returnRecord]);

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
          const updates = getUpdatesForStatusChange(nextStatus);
          setRecords(prev => prev.map(r => r.id === record.id ? { ...r, ...updates } : r));
          await updateRecordApi({ ...record, ...updates });
      }
  }, []);

  const executeBatchExport = async (batchNumber: number, batchDate: string) => {
      const todayStr = recordFilterProps.filterDate || new Date().toISOString().split('T')[0];
      const candidates = selectedRecordIds.size > 0 ? records.filter(r => selectedRecordIds.has(r.id)) : recordFilterProps.filteredRecords;
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
      const pendingSign = recordFilterProps.filteredRecords.filter(r => r.status === RecordStatus.PENDING_SIGN);
      if (pendingSign.length === 0) { alert("Không có hồ sơ nào đang chờ ký."); return; }
      if(await confirmAction(`Xác nhận chuyển ${pendingSign.length} hồ sơ sang "Đã ký"?`)) {
          const todayStr = new Date().toISOString().split('T')[0];
          const updates = { status: RecordStatus.SIGNED, approvalDate: todayStr, completedDate: null };
          setRecords(prev => prev.map(r => pendingSign.find(p => p.id === r.id) ? { ...r, ...updates } : r));
          await Promise.all(pendingSign.map(r => updateRecordApi({ ...r, ...updates })));
          setToast({ type: 'success', message: `Đã chuyển ${pendingSign.length} hồ sơ sang "Đã ký".` });
      }
  };

  const handleExportReturnedList = () => {
      if (!canPerformAction) return;
      exportReturnedListToExcel(recordFilterProps.filteredRecords, recordFilterProps.filterFromDate, recordFilterProps.filterToDate, recordFilterProps.filterWard);
  };

  if (!currentUser) return <Login onLogin={setCurrentUser} users={users} />;

  return (
    <MainLayout
        currentUser={currentUser}
        currentView={currentView}
        setCurrentView={setCurrentView}
        onLogout={() => setCurrentUser(null)}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        setIsSystemSettingsOpen={setIsSystemSettingsOpen}
        isGeneratingReport={isGeneratingReport}
        // Removed isUpdateAvailable passing to Sidebar as it is handled by Modal now
        isUpdateAvailable={false} 
        latestVersion={latestVersion}
        updateUrl={updateUrl}
        unreadMessages={unreadMessages}
        warningCount={recordFilterProps.warningCount}
        activeRemindersCount={activeRemindersCount}
        connectionStatus={connectionStatus}
        // New Props for Update Modal
        showUpdateModal={isUpdateAvailable && !updateDeferred}
        updateVersion={latestVersion}
        updateDownloadStatus={updateStatus}
        updateProgress={updateProgress}
        updateSpeed={updateSpeed} // Pass new prop
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
            handleAddOrUpdateRecord={handleAddOrUpdateRecord}
            handleDeleteRecord={handleDeleteRecord}
            handleUpdateUser={handleUpdateUser}
            handleDeleteUser={handleDeleteUser}
            handleSaveEmployee={handleSaveEmployee}
            handleDeleteEmployee={handleDeleteEmployee}
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
        />

        {toast && (
            <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-xl text-white font-bold animate-fade-in-up z-50 flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                {toast.message}
            </div>
        )}
    </MainLayout>
  );
}

export default App;
