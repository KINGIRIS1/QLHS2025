
import React from 'react';
import { RecordFile, Employee, User, UserRole, Holiday, RecordStatus } from '../types';
import { STATUS_LABELS, RECORD_TYPES, EXTENDED_RECORD_TYPES, MEASUREMENT_RECORD_TYPES, OTHER_RECORD_TYPES } from '../constants';
import { COLUMN_DEFS } from '../utils/appHelpers';

// Components
import DashboardView from './DashboardView';
import InternalChat from './InternalChat';
import PersonalProfile from './PersonalProfile';
import ReceiveRecord from './ReceiveRecord';
import ReceiveContract from './ReceiveContract';
import ExcerptManagement from './ExcerptManagement';
import UtilitiesView from './UtilitiesView';
import AccountSettingsView from './AccountSettingsView';
import ReportSection from './ReportSection';
import RecordRow from './RecordRow';
import WorkScheduleView from './WorkScheduleView';
import ArchiveRecords from './ArchiveRecords';
import SystemView from './SystemView';

import DangKyView from './archive/DangKyView';
import WarehouseView from './archive/WarehouseView';
import BlockingRecordsView from './BlockingRecordsView';
import QuickRecordTypeConverterModal from './QuickRecordTypeConverterModal';
import { SendMeasurementFilesView } from './SendMeasurementFilesView';

// Icons
import { Search, ListChecks, History, FileCheck, Calendar, X, CalendarRange, MapPin, Filter, User as UserIcon, AlertTriangle, Clock, SlidersHorizontal, Plus, FileSpreadsheet, Layers, CheckCircle, FileSignature, UserPlus, FileOutput, CheckSquare, Square, ArrowUpDown, ChevronLeft, ChevronRight, FileText, UserPlus as UserPlusIcon, ClipboardList, Send, RefreshCw, RotateCcw, Compass, FolderOpen } from 'lucide-react';

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
    handleUpdateReturnResult?: (record: RecordFile, receiptNumber: string, resultReturnedDate: string, receiverName: string) => Promise<boolean>;
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
    handleQuickUpdate: (id: string, field: keyof RecordFile, value: any, additionalUpdates?: Partial<RecordFile>) => void;
    handleUpdateCurrentAccount: (data: any) => Promise<boolean>;
    
    // Report Props
    globalReportContent: string;
    isGeneratingReport: boolean;
    handleGlobalGenerateReport: (fromDate: string, toDate: string, title?: string, data?: RecordFile[]) => void;
    handleExportReportExcel: (from: string, to: string, ward: string) => void;

    // List Logic Props
    filteredRecords: RecordFile[];
    paginatedRecords: RecordFile[];
    totalPages: number;
    warningCount: { overdue: number; approaching: number };
    searchTerm: string;
    setSearchTerm: (s: string) => void;
    
    // Advanced Search Fields
    advCode?: string; setAdvCode?: (s: string) => void;
    advMapSheet?: string; setAdvMapSheet?: (s: string) => void;
    advLandPlot?: string; setAdvLandPlot?: (s: string) => void;
    advWard?: string; setAdvWard?: (s: string) => void;
    advPhone?: string; setAdvPhone?: (s: string) => void;
    advRecordType?: string; setAdvRecordType?: (s: string) => void;
    showAdvancedSearch?: boolean; setShowAdvancedSearch?: (b: boolean) => void;
    clearAdvancedSearch?: () => void;
    
    filterDate: string; setFilterDate: (s: string) => void;
    filterSpecificDate: string; setFilterSpecificDate: (s: string) => void;
    filterFromDate: string; setFilterFromDate: (s: string) => void;
    filterToDate: string; setFilterToDate: (s: string) => void;
    showAdvancedDateFilter: boolean; setShowAdvancedDateFilter: (b: boolean) => void;
    
    filterWard: string; setFilterWard: (s: string) => void;
    filterStatus: string; setFilterStatus: (s: string) => void;
    filterEmployee: string; setFilterEmployee: (s: string) => void;
    filterRecordType: string; setFilterRecordType: (s: string) => void;
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
    handleWithdrawSelectedRecords?: () => void;
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
    const canPerformAction = isAdmin || isSubadmin || currentUser.role === UserRole.TEAM_LEADER || currentUser.role === UserRole.ONEDOOR || currentUser.role === UserRole.RECEPTION_HANDOVER;
    
    const isDoDacEmployee = currentUser.role === UserRole.EMPLOYEE && 
        (employees.find(e => e.id === currentUser.employeeId)?.department || '').trim().toLowerCase().includes('đo đạc');

    const [showColumnSelector, setShowColumnSelector] = React.useState(false);
    const [isQuickConvertModalOpen, setIsQuickConvertModalOpen] = React.useState(false);
    const [showActionsDropdown, setShowActionsDropdown] = React.useState(false);

    // --- RENDER RECORD LIST (Extracted to be used in switch) ---
    const renderRecordList = () => {
        // Kiểm tra xem có đang ở chế độ xem Hồ sơ đo đạc (bao gồm tất cả các tab con)
        const isMeasurementView = ['all_records', 'assign_tasks', 'check_list', 'handover_list', 'completed_work_list'].includes(currentView);
        const isOtherView = ['other_records', 'other_assign_tasks', 'other_check_list', 'other_handover_list'].includes(currentView);
        
        let title = 'Danh sách Hồ sơ';
        if (currentView === 'check_list' || currentView === 'other_check_list') title = 'Danh sách Trình Ký';
        else if (currentView === 'handover_list' || currentView === 'other_handover_list') title = 'Danh sách Giao 1 cửa';
        else if (currentView === 'assign_tasks' || currentView === 'other_assign_tasks') title = 'Hồ sơ chưa giao';
        else if (currentView === 'completed_work_list') title = 'Hồ sơ đang trình kiểm tra';
        else if (currentView === 'all_records' || currentView === 'other_records') title = 'Tất cả hồ sơ';

        return (
            <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col flex-1 h-full animate-fade-in-up">
                
                {/* SUB-HEADER TABS FOR MEASUREMENT RECORDS */}
                {isMeasurementView && (
                    <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 overflow-x-auto">
                        <div className="flex items-center">
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

                            <button 
                                onClick={() => props.setCurrentView('completed_work_list')}
                                className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === 'completed_work_list' ? 'border-cyan-600 text-cyan-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                <CheckSquare size={16} /> Đang trình kiểm tra
                            </button>

                            {(isAdmin || isSubadmin || currentUser.role === UserRole.RECEPTION_HANDOVER) && (
                                <button 
                                    onClick={() => props.setCurrentView('check_list')}
                                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === 'check_list' ? 'border-purple-600 text-purple-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    <ClipboardList size={16} /> Trình ký
                                </button>
                            )}

                            {(isAdmin || isSubadmin || currentUser.role === UserRole.ONEDOOR || currentUser.role === UserRole.RECEPTION_HANDOVER) && (
                                <button 
                                    onClick={() => props.setCurrentView('handover_list')}
                                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === 'handover_list' ? 'border-green-600 text-green-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    <Send size={16} /> Giao 1 cửa
                                </button>
                            )}
                        </div>

                        {/* HIGHLIGHTED CATEGORY BADGE AT TOP-RIGHT */}
                        <div className="py-1 px-2.5 ml-auto shrink-0 flex items-center">
                            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white rounded-lg shadow-sm font-black text-xs sm:text-sm tracking-wide uppercase border border-blue-400/30">
                                <Compass size={16} className="text-blue-200 shrink-0" />
                                <span>Hồ sơ đo đạc</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* SUB-HEADER TABS FOR OTHER RECORDS */}
                {isOtherView && (
                    <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 overflow-x-auto">
                        <div className="flex items-center">
                            <button 
                                onClick={() => props.setCurrentView('other_records')}
                                className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === 'other_records' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                <FileText size={16} /> Tất cả hồ sơ
                            </button>
                            
                            {(isAdmin || isSubadmin || currentUser.role === UserRole.TEAM_LEADER) && (
                                <button 
                                    onClick={() => props.setCurrentView('other_assign_tasks')}
                                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === 'other_assign_tasks' ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    <UserPlusIcon size={16} /> Chưa giao
                                </button>
                            )}

                            {(isAdmin || isSubadmin || currentUser.role === UserRole.RECEPTION_HANDOVER) && (
                                <button 
                                    onClick={() => props.setCurrentView('other_check_list')}
                                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === 'other_check_list' ? 'border-purple-600 text-purple-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    <ClipboardList size={16} /> Trình ký
                                </button>
                            )}

                            {(isAdmin || isSubadmin || currentUser.role === UserRole.ONEDOOR || currentUser.role === UserRole.RECEPTION_HANDOVER) && (
                                <button 
                                    onClick={() => props.setCurrentView('other_handover_list')}
                                    className={`px-4 py-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${currentView === 'other_handover_list' ? 'border-green-600 text-green-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    <Send size={16} /> Giao 1 cửa
                                </button>
                            )}
                        </div>

                        {/* HIGHLIGHTED CATEGORY BADGE AT TOP-RIGHT */}
                        <div className="py-1 px-2.5 ml-auto shrink-0 flex items-center">
                            <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-white rounded-lg shadow-sm font-black text-xs sm:text-sm tracking-wide uppercase border border-amber-400/30">
                                <FolderOpen size={16} className="text-amber-200 shrink-0" />
                                <span>Hồ sơ khác</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="p-3 border-b border-gray-100 flex flex-col gap-2 bg-slate-50/50">
                    {/* COMPACT SINGLE ROW TOOLBAR WITH DISTINCT BORDERED REGIONS */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-2.5 rounded-xl border border-gray-200 shadow-xs relative">
                        
                        {/* REGION 1: WARNING BADGES & SUB-TABS (VÙNG CẢNH BÁO) */}
                        {((currentUser?.role !== UserRole.ONEDOOR && (currentView === 'all_records' || currentView === 'other_records')) || currentView === 'handover_list' || currentView === 'other_handover_list' || !canPerformAction) && (
                            <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200 shrink-0">
                                {!canPerformAction && (
                                    <span className="text-[10px] font-medium text-gray-500 px-2 py-0.5 bg-white rounded-md border border-gray-200">Chỉ xem</span>
                                )}

                                {/* Sub-tabs for handover */}
                                {(currentView === 'handover_list' || currentView === 'other_handover_list') && (
                                    <div className="flex bg-white rounded-lg p-0.5 border border-gray-200 text-xs shadow-2xs">
                                        {currentUser?.role !== UserRole.ONEDOOR && (
                                            <button onClick={() => props.setHandoverTab('today')} className={`px-2 py-1 rounded-md font-bold transition-all ${props.handoverTab === 'today' ? 'bg-green-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}>Chờ giao</button>
                                        )}
                                        <button onClick={() => props.setHandoverTab('history')} className={`px-2 py-1 rounded-md font-bold transition-all ${props.handoverTab === 'history' ? 'bg-green-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}>Lịch sử</button>
                                        <button onClick={() => props.setHandoverTab('returned')} className={`px-2 py-1 rounded-md font-bold transition-all ${props.handoverTab === 'returned' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}>Đã trả KQ</button>
                                    </div>
                                )}

                                {/* Warning Badges (Overdue & Approaching) */}
                                {currentUser?.role !== UserRole.ONEDOOR && (currentView === 'all_records' || currentView === 'other_records') && (
                                    <div className="flex items-center gap-1.5">
                                        <button 
                                            onClick={() => props.setWarningFilter((prev: any) => prev === 'overdue' ? 'none' : 'overdue')} 
                                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all ${props.warningFilter === 'overdue' ? 'bg-red-600 text-white ring-2 ring-red-300' : 'bg-red-50 text-red-600 border border-red-200/80 hover:bg-red-100'}`}
                                            title="Hồ sơ quá hạn"
                                        >
                                            <AlertTriangle size={13} className="shrink-0" />
                                            <span>{props.warningCount.overdue}</span>
                                        </button>

                                        <button 
                                            onClick={() => props.setWarningFilter((prev: any) => prev === 'approaching' ? 'none' : 'approaching')} 
                                            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black transition-all ${props.warningFilter === 'approaching' ? 'bg-orange-500 text-white ring-2 ring-orange-300' : 'bg-orange-50 text-orange-600 border border-orange-200/80 hover:bg-orange-100'}`}
                                            title="Hồ sơ sắp đến hạn"
                                        >
                                            <Clock size={13} className="shrink-0" />
                                            <span>{props.warningCount.approaching}</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* REGION 2: SEARCH & ADVANCED FILTERS (VÙNG TÌM KIẾM) */}
                        <div className="flex-1 flex flex-wrap items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200 min-w-[240px]">
                            <div className="flex items-center bg-white border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all pl-2.5 pr-1 py-1 relative shrink-0 shadow-2xs">
                                <Search className="text-gray-400 shrink-0 mr-1.5" size={15} />
                                <input 
                                    type="text" 
                                    placeholder="Tìm kiếm hồ sơ..." 
                                    className="w-28 sm:w-36 md:w-44 bg-transparent text-xs sm:text-sm text-gray-800 placeholder-gray-400 outline-none pr-1" 
                                    value={props.searchTerm} 
                                    onChange={(e) => props.setSearchTerm(e.target.value)} 
                                />
                                
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => props.setShowAdvancedSearch?.(!props.showAdvancedSearch)}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap border ${props.showAdvancedSearch ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-200' : (
                                            (props.advCode || props.advMapSheet || props.advLandPlot || (props.advWard && props.advWard !== 'all') || props.advPhone || (props.advRecordType && props.advRecordType !== 'all') || props.filterSpecificDate || (props.filterStatus && props.filterStatus !== 'all') || (props.filterEmployee && props.filterEmployee !== 'all'))
                                            ? 'bg-slate-800 text-white border-slate-800' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                        )}`}
                                        title="Bật/Tắt tìm kiếm nâng cao"
                                    >
                                        <SlidersHorizontal size={13} />
                                        <span>Nâng cao{
                                            ((props.advCode ? 1 : 0) + (props.advMapSheet ? 1 : 0) + (props.advLandPlot ? 1 : 0) + (props.advWard && props.advWard !== 'all' ? 1 : 0) + (props.advPhone ? 1 : 0) + (props.advRecordType && props.advRecordType !== 'all' ? 1 : 0) + (props.filterSpecificDate ? 1 : 0) + (props.filterStatus && props.filterStatus !== 'all' ? 1 : 0) + (props.filterEmployee && props.filterEmployee !== 'all' ? 1 : 0)) > 0
                                            ? ` (${(props.advCode ? 1 : 0) + (props.advMapSheet ? 1 : 0) + (props.advLandPlot ? 1 : 0) + (props.advWard && props.advWard !== 'all' ? 1 : 0) + (props.advPhone ? 1 : 0) + (props.advRecordType && props.advRecordType !== 'all' ? 1 : 0) + (props.filterSpecificDate ? 1 : 0) + (props.filterStatus && props.filterStatus !== 'all' ? 1 : 0) + (props.filterEmployee && props.filterEmployee !== 'all' ? 1 : 0)})` : ''
                                        }</span>
                                    </button>
                                </div>
                            </div>

                            {/* EXPANDED ADVANCED SEARCH PANEL */}
                            {props.showAdvancedSearch && (
                                <div className="flex-1 min-w-[280px] flex flex-col gap-1.5 bg-blue-50/90 p-2 rounded-xl border border-blue-200 animate-fade-in text-xs shadow-2xs">
                                    {/* FIRST ROW: Mã HS, Tờ, Thửa, Số ĐT + Đặt lại */}
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <input
                                            type="text"
                                            placeholder="Mã HS..."
                                            value={props.advCode || ''}
                                            onChange={(e) => props.setAdvCode?.(e.target.value)}
                                            className="w-20 sm:w-24 px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Tờ..."
                                            value={props.advMapSheet || ''}
                                            onChange={(e) => props.setAdvMapSheet?.(e.target.value)}
                                            className="w-12 sm:w-16 px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Thửa..."
                                            value={props.advLandPlot || ''}
                                            onChange={(e) => props.setAdvLandPlot?.(e.target.value)}
                                            className="w-12 sm:w-16 px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                        />
                                        <input
                                            type="text"
                                            placeholder="Số ĐT..."
                                            value={props.advPhone || ''}
                                            onChange={(e) => props.setAdvPhone?.(e.target.value)}
                                            className="w-24 sm:w-28 px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                        />

                                        {/* Reset button (Tầng 1) */}
                                        <button
                                            onClick={() => {
                                                props.clearAdvancedSearch?.();
                                                props.setFilterSpecificDate?.('');
                                                props.setFilterStatus?.('all');
                                                props.setFilterEmployee?.('all');
                                                props.setFilterWard?.('');
                                                props.setFilterRecordType?.('all');
                                            }}
                                            title="Đặt lại tất cả tìm kiếm nâng cao"
                                            className="p-1 text-gray-600 hover:text-red-600 bg-white rounded-lg border border-gray-200 hover:bg-red-50 transition-colors shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2 shadow-2xs cursor-pointer ml-auto"
                                        >
                                            <X size={13} />
                                            <span>Đặt lại</span>
                                        </button>
                                    </div>

                                    {/* SECOND ROW: Bộ lọc (Xã/Phường, Loại HS, Ngày tiếp nhận, Trạng thái, Cán bộ) */}
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-blue-200/60">
                                        {/* Xã / Phường */}
                                        <select
                                            value={props.advWard || props.filterWard || ''}
                                            onChange={(e) => {
                                                props.setAdvWard?.(e.target.value);
                                                props.setFilterWard?.(e.target.value);
                                            }}
                                            className="w-28 sm:w-32 px-1.5 py-1 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                                        >
                                            <option value="">Tất cả Xã/Phường...</option>
                                            {wards.map(w => <option key={w} value={w}>{w}</option>)}
                                        </select>

                                        {/* Loại HS */}
                                        <select
                                            value={props.advRecordType || props.filterRecordType || 'all'}
                                            onChange={(e) => {
                                                props.setAdvRecordType?.(e.target.value);
                                                props.setFilterRecordType?.(e.target.value);
                                            }}
                                            className="w-28 sm:w-32 px-1.5 py-1 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                                        >
                                            <option value="all">Mọi loại HS...</option>
                                            {(() => {
                                                const typesToDisplay = isOtherView 
                                                    ? OTHER_RECORD_TYPES 
                                                    : isMeasurementView 
                                                        ? MEASUREMENT_RECORD_TYPES 
                                                        : RECORD_TYPES;
                                                return typesToDisplay.map(type => (
                                                    <option key={type} value={type}>{type}</option>
                                                ));
                                            })()}
                                        </select>

                                        {/* Ngày tiếp nhận */}
                                        <div className="flex items-center gap-1 bg-white px-2 py-0.5 border border-gray-200 rounded-lg text-xs shrink-0 h-7">
                                            <Calendar size={12} className="text-gray-400 shrink-0" />
                                            <input
                                                type="date"
                                                value={props.filterSpecificDate || ''}
                                                onChange={(e) => props.setFilterSpecificDate?.(e.target.value)}
                                                className="bg-transparent text-xs text-gray-700 outline-none cursor-pointer"
                                                title="Ngày tiếp nhận"
                                            />
                                            {props.filterSpecificDate && (
                                                <button onClick={() => props.setFilterSpecificDate?.('')} className="text-gray-400 hover:text-red-500 p-0.5">
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Trạng thái */}
                                        {(currentView === 'all_records' || currentView === 'other_records') && (
                                            <select
                                                value={props.filterStatus || 'all'}
                                                onChange={(e) => props.setFilterStatus?.(e.target.value)}
                                                className="w-28 sm:w-32 px-1.5 py-1 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                                            >
                                                <option value="all">Mọi trạng thái...</option>
                                                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                                                    <option key={key} value={key}>{label}</option>
                                                ))}
                                            </select>
                                        )}

                                        {/* Cán bộ thụ lý */}
                                        {(canPerformAction || isDoDacEmployee) && (currentView === 'all_records' || currentView === 'other_records') && (
                                            <select
                                                value={props.filterEmployee || 'all'}
                                                onChange={(e) => props.setFilterEmployee?.(e.target.value)}
                                                className="w-28 sm:w-32 px-1.5 py-1 bg-white border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                                            >
                                                <option value="all">Tất cả cán bộ...</option>
                                                <option value="unassigned">Chưa giao</option>
                                                {(() => {
                                                    const isMeasurement = currentView === 'all_records';
                                                    let filteredEmps = employees;
                                                    if (isMeasurement) {
                                                        filteredEmps = employees.filter(emp => {
                                                            const dept = (emp.department || '').toLowerCase();
                                                            const pos = (emp.position || '').toLowerCase();
                                                            const surveyKeywords = ['đo đạc', 'tổ đo', 'nội nghiệp', 'ngoại nghiệp', 'kỹ thuật', 'địa chính', 'bản đồ'];
                                                            const excludeKeywords = ['văn thư', 'kế toán', 'một cửa', 'tiếp nhận', 'hành chính', 'bảo vệ', 'tạp vụ', 'pháp chế', 'lưu trữ', 'thông tin lưu trữ'];
                                                            if (excludeKeywords.some(k => dept.includes(k) || pos.includes(k))) return false;
                                                            return surveyKeywords.some(k => dept.includes(k) || pos.includes(k));
                                                        });
                                                        if (props.filterEmployee && props.filterEmployee !== 'all' && props.filterEmployee !== 'unassigned') {
                                                            const selectedEmp = employees.find(e => e.id === props.filterEmployee);
                                                            if (selectedEmp && !filteredEmps.some(e => e.id === selectedEmp.id)) {
                                                                filteredEmps = [...filteredEmps, selectedEmp];
                                                            }
                                                        }
                                                    }
                                                    return filteredEmps.map(emp => (
                                                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                                                    ));
                                                })()}
                                            </select>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* REGION 3: ACTION BUTTONS (VÙNG THAO TÁC) */}
                        <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200 ml-auto flex-wrap shrink-0">
                            {/* BULK ACTION BUTTONS WHEN RECORDS ARE SELECTED OR FOR SPECIFIC VIEWS */}
                            {(isAdmin || isSubadmin || currentUser.role === UserRole.RECEPTION_HANDOVER) && props.selectedRecordIds.size > 0 && props.handleWithdrawSelectedRecords && (
                                <button 
                                    onClick={props.handleWithdrawSelectedRecords} 
                                    className="flex items-center gap-1.5 bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all animate-pulse whitespace-nowrap"
                                >
                                    <RotateCcw size={14} />
                                    <span>Rút Hồ Sơ ({props.selectedRecordIds.size})</span>
                                </button>
                            )}

                            {canPerformAction && (currentView === 'assign_tasks' || currentView === 'other_assign_tasks' || currentView === 'all_records' || currentView === 'other_records') && props.selectedRecordIds.size > 0 && (
                                <button 
                                    onClick={() => {
                                        const targets = records.filter(r => props.selectedRecordIds.has(r.id));
                                        props.setAssignTargetRecords(targets);
                                        props.setIsAssignModalOpen(true);
                                    }}
                                    className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all animate-pulse whitespace-nowrap"
                                >
                                    <UserPlus size={14} />
                                    <span>Giao Nhân Viên ({props.selectedRecordIds.size})</span>
                                </button>
                            )}

                            {canPerformAction && (currentView === 'handover_list' || currentView === 'other_handover_list') && props.handoverTab === 'today' && props.selectedRecordIds.size > 0 && (
                                <button 
                                    onClick={() => props.setIsAddToBatchModalOpen(true)} 
                                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all animate-pulse whitespace-nowrap"
                                >
                                    <CheckCircle size={14} />
                                    <span>Chốt Danh Sách Giao ({props.selectedRecordIds.size})</span>
                                </button>
                            )}

                            {canPerformAction && (currentView === 'handover_list' || currentView === 'other_handover_list') && props.handoverTab === 'returned' && (
                                <button 
                                    onClick={props.handleExportReturnedList} 
                                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all whitespace-nowrap"
                                >
                                    <FileSpreadsheet size={14} />
                                    <span>Xuất Excel (Đã trả KQ)</span>
                                </button>
                            )}

                            {canPerformAction && (currentView === 'check_list' || currentView === 'other_check_list') && (
                                (() => {
                                    const pendingRecords = props.filteredRecords.filter(r => r.status === RecordStatus.PENDING_SIGN);
                                    if (pendingRecords.length === 0) return null;
                                    
                                    const selectedPending = pendingRecords.filter(r => props.selectedRecordIds.has(r.id));
                                    const hasSelection = props.selectedRecordIds.size > 0;
                                    const label = hasSelection 
                                        ? `Ký Duyệt Đã Chọn (${selectedPending.length})` 
                                        : `Ký Duyệt Tất Cả (${pendingRecords.length})`;

                                    return (
                                        <button 
                                            onClick={props.handleConfirmSignBatch} 
                                            disabled={hasSelection && selectedPending.length === 0}
                                            className={`flex items-center gap-1.5 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-all whitespace-nowrap ${
                                                hasSelection && selectedPending.length === 0 
                                                    ? 'bg-purple-300 cursor-not-allowed' 
                                                    : 'bg-purple-600 hover:bg-purple-700'
                                            }`}
                                        >
                                            <FileSignature size={14} />
                                            <span>{label}</span>
                                        </button>
                                    );
                                })()
                            )}

                            {(currentView !== 'handover_list' && currentView !== 'other_handover_list' || props.handoverTab !== 'returned') && currentView !== 'assign_tasks' && currentView !== 'other_assign_tasks' && currentView !== 'all_records' && currentView !== 'other_records' && (
                                <button 
                                    onClick={() => { props.setExportModalType(currentView === 'check_list' || currentView === 'other_check_list' ? 'check_list' : 'handover'); props.setIsExportModalOpen(true); }} 
                                    className="flex items-center gap-1.5 bg-white text-gray-700 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-xs font-medium shadow-xs whitespace-nowrap"
                                >
                                    <FileOutput size={14} />
                                    <span>Xuất Danh Sách</span>
                                </button>
                            )}

                            {/* Primary Add/Receive Button */}
                            {canPerformAction && (
                                <button 
                                    onClick={() => { props.setIsModalOpen(true); props.setEditingRecord(null); }} 
                                    className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 shadow-sm text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
                                >
                                    <Plus size={15} />
                                    <span>Nhập hồ sơ</span>
                                </button>
                            )}

                            {/* Actions Dropdown */}
                            <div className="relative">
                                <button 
                                    onClick={() => setShowActionsDropdown(!showActionsDropdown)} 
                                    className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold transition-all whitespace-nowrap"
                                >
                                    <span>Thao tác</span>
                                    <ChevronLeft size={13} className={`transition-transform duration-200 ${showActionsDropdown ? '-rotate-90' : 'rotate-180'}`} />
                                </button>

                                {showActionsDropdown && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 py-1 space-y-0.5 text-xs animate-fade-in">
                                        {canPerformAction && (
                                            <button 
                                                onClick={() => { props.setIsImportModalOpen(true); setShowActionsDropdown(false); }} 
                                                className="w-full text-left px-3.5 py-2 hover:bg-green-50 text-gray-700 hover:text-green-700 flex items-center gap-2 font-medium"
                                            >
                                                <FileSpreadsheet size={14} className="text-green-600" />
                                                <span>Xuất Excel</span>
                                            </button>
                                        )}

                                        {canPerformAction && currentView === 'all_records' && (
                                            <button 
                                                onClick={() => { setIsQuickConvertModalOpen(true); setShowActionsDropdown(false); }} 
                                                className="w-full text-left px-3.5 py-2 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 flex items-center gap-2 font-medium"
                                            >
                                                <RefreshCw size={14} className="text-indigo-600" />
                                                <span>Chuyển nhanh loại HS</span>
                                            </button>
                                        )}

                                        {(isAdmin || isSubadmin) && props.selectedRecordIds.size > 0 && (
                                            <button 
                                                onClick={() => { props.setIsBulkUpdateModalOpen(true); setShowActionsDropdown(false); }} 
                                                className="w-full text-left px-3.5 py-2 hover:bg-orange-50 text-orange-700 flex items-center gap-2 font-bold"
                                            >
                                                <Layers size={14} className="text-orange-600" />
                                                <span>Xử lý hàng loạt ({props.selectedRecordIds.size})</span>
                                            </button>
                                        )}

                                        {(currentView === 'all_records' || currentView === 'other_records') && (
                                            <button 
                                                onClick={() => { setShowColumnSelector(!showColumnSelector); setShowActionsDropdown(false); }} 
                                                className="w-full text-left px-3.5 py-2 hover:bg-gray-100 text-gray-700 flex items-center gap-2 font-medium border-t border-gray-100 mt-0.5 pt-2"
                                            >
                                                <SlidersHorizontal size={14} className="text-gray-500" />
                                                <span>Tùy chỉnh cột</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto min-h-0 bg-white">
                    <table className="w-full text-left table-fixed min-w-[1200px] border-collapse">
                        <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase sticky top-0 shadow-sm z-10">
                            <tr>
                                <th className="p-3 w-10 text-center">
                                    {canPerformAction ? (
                                        (() => {
                                            const selectableRecords = props.paginatedRecords.filter(r => {
                                                const isHandover = (r.exportBatch || r.exportDate) && r.status !== RecordStatus.WITHDRAWN && r.status !== RecordStatus.RETURNED;
                                                return r.status !== RecordStatus.RETURNED && r.status !== RecordStatus.HANDOVER && !isHandover;
                                            });
                                            const isAllSelected = selectableRecords.length > 0 && selectableRecords.every(r => props.selectedRecordIds.has(r.id));
                                            return (
                                                <button onClick={props.toggleSelectAll}>
                                                    {isAllSelected ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-gray-400" />}
                                                </button>
                                            );
                                        })()
                                    ) : '#'}
                                </th>
                                {COLUMN_DEFS.map(col => props.visibleColumns[col.key] && (
                                    <th key={col.key} className={`p-3 cursor-pointer hover:bg-gray-100 transition-colors group select-none ${col.className || ''}`} onClick={() => { if (props.sortConfig.key === col.sortKey) { props.setSortConfig({ key: col.sortKey, direction: props.sortConfig.direction === 'asc' ? 'desc' : 'asc' }); } else { props.setSortConfig({ key: col.sortKey, direction: 'asc' }); } }}>
                                        <div className={`flex items-center gap-1 ${col.className?.includes('text-center') ? 'justify-center' : ''}`}>
                                            {col.label}
                                            {props.sortConfig.key === col.sortKey ? (props.sortConfig.direction === 'asc' ? <ArrowUpDown size={14} className="text-blue-600" /> : <ArrowUpDown size={14} className="text-blue-600 rotate-180" />) : <ArrowUpDown size={14} className="text-gray-300 opacity-0 group-hover:opacity-100" />}
                                        </div>
                                    </th>
                                ))}
                                {canPerformAction && <th className="p-3 w-28 text-center bg-gray-50 sticky right-0 shadow-l">Thao Tác</th>}
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
                                    canPerformAction={canPerformAction} 
                                    onToggleSelect={props.toggleSelectRecord} 
                                    onView={props.handleViewRecord} 
                                    onEdit={(rec) => { props.setEditingRecord(rec); props.setIsModalOpen(true); }} 
                                    onDelete={isAdmin ? (rec) => { props.setDeletingRecord(rec); props.setIsDeleteModalOpen(true); } : undefined} 
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
            <QuickRecordTypeConverterModal
                isOpen={isQuickConvertModalOpen}
                onClose={() => setIsQuickConvertModalOpen(false)}
                records={records}
                onSuccess={props.onRefreshData}
            />
            </>
        );
    };

    switch (currentView) {
        case 'dashboard':
            return <DashboardView records={records} currentUser={currentUser} />;
        // case 'internal_chat':
        //     return (
        //         <InternalChat
        //             currentUser={currentUser}
        //             wards={wards}
        //             employees={employees}
        //             users={users}
        //             onResetUnread={() => props.setUnreadMessages(0)}
        //             notificationEnabled={props.notificationEnabled}
        //         />
        //     );
        case 'blocking_records':
            return (
                <BlockingRecordsView 
                    currentUser={currentUser}
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
                    employees={employees}
                    records={records}
                    onUpdateStatus={(r, status, additionalUpdates) => props.handleQuickUpdate(r.id, 'status', status, additionalUpdates)}
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
                    onReturnResult={props.handleOpenReturnModal}
                    onUpdateReturnResult={props.handleUpdateReturnResult}
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


        case 'excerpt_management':
            return (
                <ExcerptManagement
                    currentUser={currentUser}
                    records={records}
                    onUpdateRecord={(id, num, type) => props.handleQuickUpdate(id, type === 'trichluc' ? 'excerptNumber' : 'measurementNumber', num)}
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
        case 'send_measurement_files':
            return (
                <SendMeasurementFilesView
                    currentUser={currentUser}
                    records={records}
                    onUpdateRecord={(updated) => props.handleAddOrUpdateRecord(updated)}
                />
            );
        case 'archive_records':
            return (
                <ArchiveRecords currentUser={currentUser} wards={wards} />
            );
        case 'warehouse_records':
            return (
                <WarehouseView currentUser={currentUser} />
            );
        case 'dangky_records':
            return (
                <DangKyView currentUser={currentUser} wards={wards} />
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
        case 'system_dashboard':
            return (
                <SystemView
                    currentUser={currentUser}
                    users={users}
                    employees={employees}
                    onAddUser={(u) => props.handleUpdateUser(u, false)}
                    onUpdateUser={(u) => props.handleUpdateUser(u, true)}
                    onDeleteUser={props.handleDeleteUser}
                    onSaveEmployee={props.handleSaveEmployee}
                    onDeleteEmployee={props.handleDeleteEmployee}
                    wards={wards}
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
                    currentUser={currentUser}
                />
            );
        default:
            // This now handles 'all_records', 'assign_tasks', 'check_list', 'handover_list'
            return renderRecordList();
    }
};

export default AppRoutes;
