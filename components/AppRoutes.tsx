import React from 'react';
import { RecordFile, Employee, User, UserRole, Holiday } from '../types';
import { STATUS_LABELS } from '../constants';
import { COLUMN_DEFS } from '../utils/appHelpers';

// Components
import DashboardView from './DashboardView';
import InternalChat from './InternalChat';
import PersonalProfile from './PersonalProfile';
import ReceiveRecord from './ReceiveRecord';
import ReceiveContract from './ReceiveContract';
import UserManagement from './UserManagement';
import EmployeeManagement from './EmployeeManagement';
import ExcerptManagement from './ExcerptManagement';
import UtilitiesView from './UtilitiesView';
import AccountSettingsView from './AccountSettingsView';
import ReportSection from './ReportSection';
import RecordRow from './RecordRow';
import WorkScheduleView from './WorkScheduleView';
import ArchiveRecords from './ArchiveRecords';
import SystemSettingsView from './SystemSettingsView';
import RecordDetailPanel from './RecordDetailPanel';

// Icons
import { Search, ListChecks, History, FileCheck, Calendar, X, CalendarRange, MapPin, Filter, User as UserIcon, AlertTriangle, Clock, SlidersHorizontal, Plus, FileSpreadsheet, Layers, CheckCircle, FileSignature, UserPlus, FileOutput, CheckSquare, Square, ArrowUpDown, ChevronLeft, ChevronRight, FileText, UserPlus as UserPlusIcon, ClipboardList, Send } from 'lucide-react';

interface AppRoutesProps {
    currentView: string;
    setCurrentView: (view: string) => void;
    currentUser: User;
    records: RecordFile[];
    employees: Employee[];
    users: User[];
    wards: string[];
    holidays: Holiday[]; 
    
    // States & Setters passed from App
    setUnreadMessages: (n: number) => void;
    notificationEnabled: boolean;
    setNotificationEnabled: (enabled: boolean) => void;
    recordToLiquidate: RecordFile | null;
    setRecordToLiquidate: (r: RecordFile | null) => void;
    recordForMapCorrection: RecordFile | null;
    
    // Handlers
    handleViewRecord: (r: RecordFile) => void;
    handleMapCorrectionRequest: (r: RecordFile) => void;
    handleAddOrUpdateRecord: (r: RecordFile) => Promise<boolean>;
    handleDeleteRecord: (id: string) => Promise<boolean>;
    handleUpdateUser: (u: User, isUpdate: boolean) => void;
    handleDeleteUser: (username: string) => void;
    handleSaveEmployee: (emp: Employee) => void;
    handleDeleteEmployee: (id: string) => void;
    handleDeleteAllData: () => Promise<boolean>;
    onRefreshData: () => void;
    setWards: React.Dispatch<React.SetStateAction<string[]>>;
    onResetWards: () => void;
    handleQuickUpdate: (id: string, field: keyof RecordFile, value: string) => void;
    handleUpdateCurrentAccount: (data: any) => Promise<boolean>;
    
    // Report Props
    globalReportContent: string;
    isGeneratingReport: boolean;
    handleGlobalGenerateReport: (from: string, to: string) => void;
    handleExportReportExcel: (from: string, to: string, ward: string) => void;

    // List Logic Props
    filteredRecords: RecordFile[];
    paginatedRecords: RecordFile[];
    totalPages: number;
    warningCount: { overdue: number; approaching: number };
    searchTerm: string;
    setSearchTerm: (s: string) => void;
    
    filterDate: string; setFilterDate: (s: string) => void;
    filterSpecificDate: string; setFilterSpecificDate: (s: string) => void;
    filterFromDate: string; setFilterFromDate: (s: string) => void;
    filterToDate: string; setFilterToDate: (s: string) => void;
    showAdvancedDateFilter: boolean; setShowAdvancedDateFilter: (b: boolean) => void;
    
    filterWard: string; setFilterWard: (s: string) => void;
    filterStatus: string; setFilterStatus: (s: string) => void;
    filterEmployee: string; setFilterEmployee: (s: string) => void;
    warningFilter: string; setWarningFilter: React.Dispatch<React.SetStateAction<any>>;
    handoverTab: string; setHandoverTab: React.Dispatch<React.SetStateAction<any>>;
    
    sortConfig: any; setSortConfig: (c: any) => void;
    currentPage: number; setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
    itemsPerPage: number; setItemsPerPage: React.Dispatch<React.SetStateAction<number>>;
    
    selectedRecordIds: Set<string>;
    toggleSelectAll: () => void;
    toggleSelectRecord: (id: string) => void;
    visibleColumns: Record<string, boolean>;
    setVisibleColumns: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    
    // Modal Openers
    setIsModalOpen: (b: boolean) => void;
    setEditingRecord: (r: RecordFile | null) => void;
    setIsImportModalOpen: (b: boolean) => void;
    setIsBulkUpdateModalOpen: (b: boolean) => void;
    setIsAddToBatchModalOpen: (b: boolean) => void;
    handleExportReturnedList: () => void;
    handleConfirmSignBatch: () => void;
    setAssignTargetRecords: (r: RecordFile[]) => void;
    setIsAssignModalOpen: (b: boolean) => void;
    setExportModalType: (t: 'handover' | 'check_list') => void;
    setIsExportModalOpen: (b: boolean) => void;
    setDeletingRecord: (r: RecordFile | null) => void;
    setIsDeleteModalOpen: (b: boolean) => void;
    advanceStatus: (r: RecordFile) => void;
    handleOpenReturnModal: (r: RecordFile) => void;
}

const AppRoutes: React.FC<AppRoutesProps> = (props) => {
    // Simplify destructuring to avoid TS errors with complex objects
    const { 
        currentView, currentUser, records, employees, users, wards, holidays
    } = props;

    const isAdmin = currentUser.role === UserRole.ADMIN;
    const isSubadmin = currentUser.role === UserRole.SUBADMIN;
    const canPerformAction = isAdmin || isSubadmin || currentUser.role === UserRole.TEAM_LEADER || currentUser.role === UserRole.ONEDOOR;

    const [showColumnSelector, setShowColumnSelector] = React.useState(false);
    const [selectedRecord, setSelectedRecord] = React.useState<RecordFile | null>(null);

    // --- RENDER RECORD LIST (Extracted to be used in switch) ---
    const renderRecordList = () => {
        // Kiểm tra xem có đang ở chế độ xem Hồ sơ đo đạc (bao gồm tất cả các tab con)
        const isMeasurementView = ['all_records', 'assign_tasks', 'check_list', 'handover_list'].includes(currentView);
        
        let title = 'Danh sách Hồ sơ';
        if (currentView === 'check_list') title = 'Danh sách Trình Ký';
        else if (currentView === 'handover_list') title = 'Danh sách Giao 1 cửa';
        else if (currentView === 'assign_tasks') title = 'Hồ sơ chưa giao';
        else if (currentView === 'all_records') title = 'Hồ sơ đo đạc';

        return (
            <div className="flex flex-1 h-full overflow-hidden gap-0">
                {/* LEFT SIDE: LIST */}
                <div className={`flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 animate-fade-in-up ${selectedRecord ? 'w-2/3 rounded-r-none border-r-0' : 'w-full'}`}>
                    
                    {/* SUB-HEADER TABS FOR MEASUREMENT RECORDS */}
                    {isMeasurementView && (
                        <div className="flex border-b border-gray-200 bg-gray-50 px-4 overflow-x-auto shrink-0">
                            <button 
                                onClick={() => props.setCurrentView('all_records')}
                                className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === 'all_records' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                <FileText size={16} /> Tất cả hồ sơ
                            </button>
                            
                            {(isAdmin || isSubadmin || currentUser.role === UserRole.TEAM_LEADER) && (
                                <button 
                                    onClick={() => props.setCurrentView('assign_tasks')}
                                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === 'assign_tasks' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    <UserPlusIcon size={16} /> Chưa giao
                                </button>
                            )}

                            {(isAdmin || isSubadmin) && (
                                <button 
                                    onClick={() => props.setCurrentView('check_list')}
                                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === 'check_list' ? 'border-purple-600 text-purple-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    <ClipboardList size={16} /> Trình ký
                                </button>
                            )}

                            {(isAdmin || isSubadmin || currentUser.role === UserRole.ONEDOOR) && (
                                <button 
                                    onClick={() => props.setCurrentView('handover_list')}
                                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === 'handover_list' ? 'border-green-600 text-green-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    <Send size={16} /> Giao 1 cửa
                                </button>
                            )}
                        </div>
                    )}

                    <div className="p-4 border-b border-gray-100 flex flex-col gap-4 shrink-0">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                {title}
                                {!canPerformAction && <span className="text-xs font-normal text-gray-500 px-2 py-0.5 bg-gray-100 rounded-full border">Chỉ xem</span>}
                            </h2>
                            <div className="relative flex-1 sm:w-64 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                <input type="text" placeholder="Tìm kiếm..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={props.searchTerm} onChange={(e) => props.setSearchTerm(e.target.value)} />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-2 rounded-lg relative">
                             {currentView === 'handover_list' && (
                                 <div className="flex bg-white rounded-md border border-gray-200 p-1 mr-2 shadow-sm">
                                     {currentUser?.role !== UserRole.ONEDOOR && (
                                        <button onClick={() => props.setHandoverTab('today')} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${props.handoverTab === 'today' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><ListChecks size={16} /> Chờ giao</button>
                                     )}
                                     <button onClick={() => props.setHandoverTab('history')} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${props.handoverTab === 'history' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><History size={16} /> Lịch sử</button>
                                     <button onClick={() => props.setHandoverTab('returned')} className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${props.handoverTab === 'returned' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}><FileCheck size={16} /> Đã trả KQ</button>
                                 </div>
                             )}
                             
                             {currentView !== 'handover_list' && !props.showAdvancedDateFilter && ( <div className="flex items-center gap-2 bg-white px-2 py-1.5 border border-gray-200 rounded-md shadow-sm"><Calendar size={16} className="text-gray-500" /><input type="date" value={props.filterSpecificDate} onChange={(e) => props.setFilterSpecificDate(e.target.value)} className="text-sm outline-none bg-transparent text-gray-700" title="Lọc theo ngày tiếp nhận" />{props.filterSpecificDate && (<button onClick={() => props.setFilterSpecificDate('')} className="text-gray-400 hover:text-red-500"><X size={14} /></button>)}</div>)}
                             
                             {currentView === 'handover_list' && props.handoverTab === 'history' && (
                                 <div className="flex items-center gap-2 bg-white px-2 py-1.5 border border-gray-200 rounded-md shadow-sm">
                                     <Calendar size={16} className="text-gray-500" />
                                     <span className="text-xs text-gray-500 font-bold uppercase">Ngày giao:</span>
                                     <input type="date" value={props.filterDate} onChange={(e) => props.setFilterDate(e.target.value)} className="text-sm outline-none bg-transparent text-gray-700" />
                                     {props.filterDate && (<button onClick={() => props.setFilterDate('')} className="text-gray-400 hover:text-red-500"><X size={14} /></button>)}
                                 </div>
                             )}

                             {currentView === 'handover_list' && props.handoverTab === 'returned' && (
                                <div className="flex items-center gap-2 bg-white px-2 py-1.5 border border-gray-200 rounded-md shadow-sm">
                                    <span className="text-xs text-gray-500 font-bold uppercase">Ngày trả:</span>
                                    <input type="date" value={props.filterFromDate} onChange={(e) => props.setFilterFromDate(e.target.value)} className="text-sm outline-none bg-transparent text-gray-700 border border-gray-300 rounded px-1" title="Từ ngày" />
                                    <span className="text-gray-400">-</span>
                                    <input type="date" value={props.filterToDate} onChange={(e) => props.setFilterToDate(e.target.value)} className="text-sm outline-none bg-transparent text-gray-700 border border-gray-300 rounded px-1" title="Đến ngày" />
                                    {(props.filterFromDate || props.filterToDate) && (<button onClick={() => { props.setFilterFromDate(''); props.setFilterToDate(''); }} className="text-gray-400 hover:text-red-500"><X size={14} /></button>)}
                                </div>
                             )}

                             {currentView !== 'handover_list' && <button onClick={() => props.setShowAdvancedDateFilter(!props.showAdvancedDateFilter)} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm border ${props.showAdvancedDateFilter ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}><CalendarRange size={16} /></button>}
                             
                             <div className="flex items-center gap-2 bg-white px-2 py-1.5 border border-gray-200 rounded-md shadow-sm"><MapPin size={16} className="text-gray-500" /><select value={props.filterWard} onChange={(e) => props.setFilterWard(e.target.value)} className="text-sm outline-none bg-transparent text-gray-700 font-medium cursor-pointer border-none focus:ring-0 max-w-[120px]"><option value="all">Tất cả Xã</option>{wards.map(w => (<option key={w} value={w}>{w}</option>))}</select></div>
                             
                             {currentView === 'all_records' && (
                                <div className="flex items-center gap-2 bg-white px-2 py-1.5 border border-gray-200 rounded-md shadow-sm">
                                    <Filter size={16} className="text-gray-500" />
                                    <select value={props.filterStatus} onChange={(e) => props.setFilterStatus(e.target.value)} className="text-sm outline-none bg-transparent text-gray-700 font-medium cursor-pointer border-none focus:ring-0 max-w-[120px]">
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
                                    <select value={props.filterEmployee} onChange={(e) => props.setFilterEmployee(e.target.value)} className="text-sm outline-none bg-transparent text-gray-700 font-medium cursor-pointer border-none focus:ring-0 max-w-[120px]">
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
                                    <button onClick={() => props.setWarningFilter((prev: any) => prev === 'overdue' ? 'none' : 'overdue')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-colors shadow-sm border ${props.warningFilter === 'overdue' ? 'bg-red-600 text-white' : 'bg-white text-red-600'}`}><AlertTriangle size={16} /> {props.warningCount.overdue}</button>
                                    <button onClick={() => props.setWarningFilter((prev: any) => prev === 'approaching' ? 'none' : 'approaching')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-colors shadow-sm border ${props.warningFilter === 'approaching' ? 'bg-orange-500 text-white' : 'bg-white text-orange-600'}`}><Clock size={16} /> {props.warningCount.approaching}</button>
                                </div>
                             )}

                             {canPerformAction && (
                                <>
                                    <div className="h-6 w-px bg-gray-300 mx-2"></div>
                                    <button onClick={() => { props.setIsModalOpen(true); props.setEditingRecord(null); }} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 shadow-sm text-sm font-bold"><Plus size={16} /> Nhập</button>
                                    <button onClick={() => props.setIsImportModalOpen(true)} className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 shadow-sm text-sm font-bold"><FileSpreadsheet size={16} /> Excel</button>
                                </>
                             )}

                             {(isAdmin || isSubadmin) && props.selectedRecordIds.size > 0 && (
                                <button 
                                    onClick={() => props.setIsBulkUpdateModalOpen(true)} 
                                    className="ml-2 flex items-center gap-1 bg-orange-600 text-white px-3 py-1.5 rounded-md hover:bg-orange-700 shadow-sm text-sm font-bold animate-pulse"
                                >
                                    <Layers size={16} /> Admin: Xử lý hàng loạt ({props.selectedRecordIds.size})
                                </button>
                             )}

                             {currentView === 'all_records' && (
                                <div className="relative ml-auto">
                                    <button onClick={() => setShowColumnSelector(!showColumnSelector)} className="p-2 bg-white border border-gray-200 rounded-md hover:bg-gray-100"><SlidersHorizontal size={16} /></button>
                                    {showColumnSelector && (
                                        <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-2">
                                            {COLUMN_DEFS.map(col => (
                                                <label key={col.key} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                                    <input type="checkbox" checked={props.visibleColumns[col.key]} onChange={() => props.setVisibleColumns(prev => ({ ...prev, [col.key]: !prev[col.key] }))} className="rounded text-blue-600 focus:ring-blue-500" />
                                                    <span className="text-sm text-gray-700">{col.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                             )}
                        </div>

                        {props.showAdvancedDateFilter && (
                            <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200 animate-fade-in text-sm">
                                <span className="text-gray-600 font-medium">Từ ngày:</span>
                                <input type="date" className="border rounded px-2 py-1" value={props.filterFromDate} onChange={(e) => props.setFilterFromDate(e.target.value)} />
                                <span className="text-gray-600 font-medium">Đến ngày:</span>
                                <input type="date" className="border rounded px-2 py-1" value={props.filterToDate} onChange={(e) => props.setFilterToDate(e.target.value)} />
                                {(props.filterFromDate || props.filterToDate) && <button onClick={() => { props.setFilterFromDate(''); props.setFilterToDate(''); }} className="text-red-500 hover:underline text-xs">Xóa</button>}
                            </div>
                        )}
                        
                        <div className="flex justify-end gap-3 mt-2">
                            {canPerformAction && currentView === 'handover_list' && props.handoverTab === 'today' && props.selectedRecordIds.size > 0 && (
                                <button onClick={() => props.setIsAddToBatchModalOpen(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-bold shadow-md transition-all animate-pulse">
                                    <CheckCircle size={18} /> Chốt Danh Sách Giao ({props.selectedRecordIds.size})
                                </button>
                            )}
                            {canPerformAction && currentView === 'handover_list' && props.handoverTab === 'returned' && (
                                <button onClick={props.handleExportReturnedList} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 font-bold shadow-md transition-all">
                                    <FileSpreadsheet size={18} /> Xuất Excel (Đã trả KQ)
                                </button>
                            )}
                            {canPerformAction && currentView === 'check_list' && props.filteredRecords.length > 0 && (
                                <button onClick={props.handleConfirmSignBatch} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-bold shadow-md">
                                    <FileSignature size={18} /> Ký Duyệt Tất Cả ({props.filteredRecords.length})
                                </button>
                            )}
                            {canPerformAction && (currentView === 'assign_tasks' || currentView === 'all_records') && props.selectedRecordIds.size > 0 && (
                                <button 
                                    onClick={() => {
                                        const targets = records.filter(r => props.selectedRecordIds.has(r.id));
                                        props.setAssignTargetRecords(targets);
                                        props.setIsAssignModalOpen(true);
                                    }}
                                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-bold shadow-md transition-all animate-pulse"
                                >
                                    <UserPlus size={18} /> Giao Nhân Viên ({props.selectedRecordIds.size})
                                </button>
                            )}
                            {(currentView !== 'handover_list' || props.handoverTab !== 'returned') && currentView !== 'assign_tasks' && currentView !== 'all_records' && (
                                <button onClick={() => { props.setExportModalType(currentView === 'check_list' ? 'check_list' : 'handover'); props.setIsExportModalOpen(true); }} className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium shadow-sm">
                                    <FileOutput size={18} /> Xuất Danh Sách
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto min-h-0 bg-white">
                        <table className="w-full text-left table-fixed min-w-[1000px] border-collapse">
                            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase sticky top-0 shadow-sm z-10">
                                <tr>
                                    <th className="p-3 w-10 text-center">
                                        {canPerformAction ? <button onClick={props.toggleSelectAll}>{props.selectedRecordIds.size === props.paginatedRecords.length && props.paginatedRecords.length > 0 ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-gray-400" />}</button> : '#'}
                                    </th>
                                    {COLUMN_DEFS.map(col => props.visibleColumns[col.key] && (
                                        <th key={col.key} className={`p-3 cursor-pointer hover:bg-gray-100 transition-colors group select-none ${col.className || ''}`} onClick={() => { if (props.sortConfig.key === col.sortKey) { props.setSortConfig({ key: col.sortKey, direction: props.sortConfig.direction === 'asc' ? 'desc' : 'asc' }); } else { props.setSortConfig({ key: col.sortKey, direction: 'asc' }); } }}>
                                            <div className={`flex items-center gap-1 ${col.className?.includes('text-center') ? 'justify-center' : ''}`}>
                                                {col.label}
                                                {props.sortConfig.key === col.sortKey ? (props.sortConfig.direction === 'asc' ? <ArrowUpDown size={14} className="text-blue-600" /> : <ArrowUpDown size={14} className="text-blue-600 rotate-180" />) : <ArrowUpDown size={14} className="text-gray-300 opacity-0 group-hover:opacity-100" />}
                                            </div>
                                        </th>
                                    ))}
                                    {/* Removed "Thao Tác" Header */}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {props.paginatedRecords.length > 0 ? props.paginatedRecords.map(r => (
                                    <RecordRow 
                                        key={r.id} 
                                        record={r} 
                                        employees={employees} 
                                        visibleColumns={props.visibleColumns} 
                                        isSelected={props.selectedRecordIds.has(r.id)} 
                                        isActive={selectedRecord?.id === r.id}
                                        canPerformAction={canPerformAction} 
                                        onToggleSelect={props.toggleSelectRecord} 
                                        onSelect={setSelectedRecord} 
                                        onEdit={(rec) => { props.setEditingRecord(rec); props.setIsModalOpen(true); }} 
                                        onDelete={(rec) => { props.setDeletingRecord(rec); props.setIsDeleteModalOpen(true); }} 
                                        onAdvanceStatus={props.advanceStatus}
                                        onQuickUpdate={props.handleQuickUpdate}
                                        onReturnResult={props.handleOpenReturnModal}
                                        onMapCorrection={props.handleMapCorrectionRequest}
                                    />
                                )) : (
                                    <tr><td colSpan={Object.values(props.visibleColumns).filter(v => v).length + 2} className="p-8 text-center text-gray-400 italic">Không có dữ liệu hiển thị.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {props.paginatedRecords.length > 0 && (
                        <div className="border-t border-gray-200 p-3 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 text-xs text-gray-600">
                            <div className="flex items-center gap-4">
                                <span>Tổng số: <strong>{props.filteredRecords.length}</strong> bản ghi</span>
                                <div className="flex items-center gap-2">
                                    <span>Hiển thị</span>
                                    <select value={props.itemsPerPage} onChange={(e) => props.setItemsPerPage(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1 bg-white outline-none">
                                        <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => props.setCurrentPage(Math.max(props.currentPage - 1, 1))} disabled={props.currentPage === 1} className="p-1.5 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"><ChevronLeft size={16} /></button>
                                <span className="font-medium">Trang {props.currentPage} / {props.totalPages}</span>
                                <button onClick={() => props.setCurrentPage(Math.min(props.currentPage + 1, props.totalPages))} disabled={props.currentPage === props.totalPages} className="p-1.5 border rounded bg-white hover:bg-gray-100 disabled:opacity-50"><ChevronRight size={16} /></button>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT SIDE: DETAIL PANEL */}
                {selectedRecord && (
                    <div className="w-1/3 h-full bg-white shadow-xl z-20 animate-slide-in-right border-l border-gray-200">
                        <RecordDetailPanel 
                            record={selectedRecord}
                            employees={employees}
                            onClose={() => setSelectedRecord(null)}
                            onEdit={(r) => { props.setEditingRecord(r); props.setIsModalOpen(true); }}
                            onPrint={(r) => { /* Handle print logic here if needed, or open a print modal */ alert('Tính năng in đang phát triển'); }}
                            onDelete={(r) => { props.setDeletingRecord(r); props.setIsDeleteModalOpen(true); }}
                        />
                    </div>
                )}
            </div>
        );
    };

    switch (currentView) {
        case 'dashboard':
            return <DashboardView records={records} />;
        case 'internal_chat':
            return (
                <InternalChat
                    currentUser={currentUser}
                    wards={wards}
                    employees={employees}
                    users={users}
                    onResetUnread={() => props.setUnreadMessages(0)}
                    notificationEnabled={props.notificationEnabled}
                />
            );
        case 'work_schedule':
            return (
                <WorkScheduleView 
                    currentUser={currentUser}
                />
            );
        case 'personal_profile':
            return (
                <PersonalProfile
                    user={currentUser}
                    records={records}
                    onUpdateStatus={(r, status) => props.handleQuickUpdate(r.id, 'status', status)}
                    onViewRecord={props.handleViewRecord}
                    onCreateLiquidation={(r) => { 
                        props.setRecordToLiquidate(r); 
                        props.setCurrentView('receive_contract'); 
                    }}
                    onMapCorrection={props.handleMapCorrectionRequest}
                />
            );
        case 'receive_record':
            return (
                <ReceiveRecord
                    onSave={props.handleAddOrUpdateRecord}
                    onDelete={props.handleDeleteRecord}
                    wards={wards}
                    employees={employees}
                    currentUser={currentUser}
                    records={records}
                    holidays={holidays}
                />
            );
        case 'receive_contract':
            return (
                <ReceiveContract
                    onSave={(r) => props.handleAddOrUpdateRecord(r)}
                    wards={wards}
                    currentUser={currentUser}
                    records={records}
                    recordToLiquidate={props.recordToLiquidate}
                    onClearRecordToLiquidate={() => props.setRecordToLiquidate(null)}
                />
            );
        case 'user_management':
            if (!isAdmin) return null;
            return (
                <UserManagement
                    users={users}
                    employees={employees}
                    onAddUser={(u) => props.handleUpdateUser(u, false)}
                    onUpdateUser={(u) => props.handleUpdateUser(u, true)}
                    onDeleteUser={props.handleDeleteUser}
                />
            );
        case 'employee_management':
            return (
                <EmployeeManagement
                    employees={employees}
                    onSaveEmployee={props.handleSaveEmployee}
                    onDeleteEmployee={props.handleDeleteEmployee}
                    wards={wards}
                    currentUser={currentUser}
                />
            );
        case 'excerpt_management':
            return (
                <ExcerptManagement
                    currentUser={currentUser}
                    records={records}
                    onUpdateRecord={(id, num) => props.handleQuickUpdate(id, 'excerptNumber', num)}
                    wards={wards}
                    onAddWard={(w) => props.setWards(prev => [...prev, w])}
                    onDeleteWard={(w) => props.setWards(prev => prev.filter(x => x !== w))}
                    onResetWards={props.onResetWards}
                />
            );
        case 'utilities':
            return (
                <UtilitiesView
                    currentUser={currentUser}
                    initialRecordForCorrection={props.recordForMapCorrection}
                />
            );
        case 'archive_records':
            return (
                <ArchiveRecords currentUser={currentUser} wards={wards} />
            );
        case 'account_settings':
            return (
                <AccountSettingsView
                    currentUser={currentUser}
                    linkedEmployee={employees.find(e => e.id === currentUser.employeeId)}
                    onUpdate={props.handleUpdateCurrentAccount}
                    notificationEnabled={props.notificationEnabled}
                    setNotificationEnabled={props.setNotificationEnabled}
                />
            );
        case 'system_settings':
            if (!isAdmin) return null;
            return (
                <SystemSettingsView
                    onDeleteAllData={props.handleDeleteAllData}
                    onHolidaysChanged={props.onRefreshData}
                />
            );
        case 'reports':
            return (
                <ReportSection
                    reportContent={props.globalReportContent}
                    isGenerating={props.isGeneratingReport}
                    onGenerate={props.handleGlobalGenerateReport}
                    onExportExcel={props.handleExportReportExcel}
                    records={records}
                    employees={employees}
                    wards={wards}
                />
            );
        default:
            // This now handles 'all_records', 'assign_tasks', 'check_list', 'handover_list'
            return renderRecordList();
    }
};

export default AppRoutes;
