import { localDateKey } from '../utils/dateUtils';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
    BarChart3, FileSpreadsheet, Loader2, Sparkles, Download, CalendarDays, 
    Printer, Layout, FileText, ListFilter, CheckCircle2, Clock, AlertTriangle, 
    Settings, Key, X, Save, MapPin, UserCheck, ChevronLeft, ChevronRight, 
    PieChart, CheckCircle, Ruler, FolderArchive, FileCheck2, ClipboardCheck, Search
} from 'lucide-react';
import { RecordFile, RecordStatus, Employee, User, UserRole } from '../types';
import { getNormalizedWard, STATUS_LABELS, MEASUREMENT_RECORD_TYPES } from '../constants';
import { isRecordOverdue, removeVietnameseTones, showToast } from '../utils/appHelpers';
import { saveGeminiKey, getGeminiKey } from '../services/geminiService';
import { fetchArchiveRecords } from '../services/apiArchive';
import EmployeeStatsView from './report/EmployeeStatsView';
import WardStatsView from './report/WardStatsView';
import DailyStatsView from './report/DailyStatsView';
import LateRecordsView from './report/LateRecordsView';
import QuantityReportView from './report/QuantityReportView';
import ExecutionReportView from './report/ExecutionReportView';
import HandoverComparisonView from './report/HandoverComparisonView';
import { AiReportCardView } from './report/AiReportCardView';
import { fetchWorkSchedules } from '../services/apiWorkSchedule';
import { WorkSchedule } from '../types';

interface ReportSectionProps {
    reportContent: string;
    isGenerating: boolean;
    onGenerate: (fromDate: string, toDate: string, title?: string, data?: RecordFile[]) => void;
    onExportExcel: (fromDate: string, toDate: string, ward: string) => void;
    records: RecordFile[];
    wards: string[]; 
    employees: Employee[];
    currentUser?: User;
}

const ReportSection: React.FC<ReportSectionProps> = ({ 
    reportContent, 
    isGenerating, 
    onGenerate, 
    onExportExcel, 
    records, 
    wards, 
    employees, 
    currentUser 
}) => {
    const isAdmin = currentUser?.role === UserRole.ADMIN;
    const isSubadmin = currentUser?.role === UserRole.SUBADMIN;
    const isOneDoor = currentUser?.role === UserRole.ONEDOOR;
    const isReceptionHandover = currentUser?.role === UserRole.RECEPTION_HANDOVER;

    // So sánh hạn trả 1 cửa chỉ mở cho Admin, Subadmin, Một cửa, Tiếp nhận bàn giao
    const canViewHandoverControl = isAdmin || isSubadmin || isOneDoor || isReceptionHandover;
    
    // State chọn nhân viên (Lifting state up)
    const [selectedEmpId, setSelectedEmpId] = useState<string>('');

    const [activeTab, setActiveTab] = useState<'list' | 'ward_stats' | 'ai' | 'employee' | 'daily_stats' | 'late_records' | 'quantity_report' | 'execution_report' | 'handover_control'>('list');
    const previewRef = useRef<HTMLDivElement>(null);

    const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
    const [apiKey, setApiKey] = useState('');

    const [schedules, setSchedules] = useState<WorkSchedule[]>([]);

    useEffect(() => {
        fetchWorkSchedules().then(res => setSchedules(res));
    }, []);

    // --- NEW LOGIC FOR MAIN TABS (Đo đạc vs Lưu trữ) ---
    const [mainTab, setMainTab] = useState<'measurement' | 'archive'>('measurement');
    const [archiveRecords, setArchiveRecords] = useState<RecordFile[]>([]);

    useEffect(() => {
        if (mainTab === 'archive' && archiveRecords.length === 0) {
            const loadArchive = async () => {
                try {
                    const [saoluc, vaoso, congvan] = await Promise.all([
                        fetchArchiveRecords('saoluc'),
                        fetchArchiveRecords('vaoso'),
                        fetchArchiveRecords('congvan')
                    ]);
                    const all = [...saoluc, ...vaoso, ...congvan];
                    
                    const mapStatus = (s: string): RecordStatus => {
                        switch(s) {
                            case 'draft': return RecordStatus.RECEIVED;
                            case 'assigned': return RecordStatus.ASSIGNED;
                            case 'executed': return RecordStatus.COMPLETED_WORK;
                            case 'pending_sign': return RecordStatus.PENDING_SIGN;
                            case 'signed': return RecordStatus.SIGNED;
                            case 'completed': return RecordStatus.HANDOVER;
                            case 'returned': return RecordStatus.RETURNED;
                            default: return RecordStatus.RECEIVED;
                        }
                    };

                    const getHistoryDate = (history: any[], statusVal: string, fallbackDate: string | null = null): string | null => {
                        if (!Array.isArray(history)) return fallbackDate;
                        const entry = [...history].reverse().find(e => 
                            e.status === statusVal || 
                            (statusVal === 'executed' && (e.action === 'Thực hiện xong' || e.action === 'Đã thực hiện')) ||
                            (statusVal === 'pending_sign' && e.action === 'Trình ký') ||
                            (statusVal === 'signed' && e.action === 'Ký duyệt') ||
                            (statusVal === 'completed' && e.action === 'Đã giao 1 cửa') ||
                            (statusVal === 'returned' && e.action === 'Đã trả kết quả')
                        );
                        if (entry && entry.timestamp) {
                            return entry.timestamp.split('T')[0];
                        }
                        return fallbackDate;
                    };

                    const mapped: RecordFile[] = all.map(r => {
                        const history = r.data?.history || [];
                        const statusMapped = mapStatus(r.status);
                        
                        const workCompletedDate = getHistoryDate(history, 'executed');
                        const submissionDate = getHistoryDate(history, 'pending_sign');
                        const approvalDate = getHistoryDate(history, 'signed');
                        const completedDate = getHistoryDate(history, 'completed', r.data?.ngay_hoan_thanh || null);
                        const resultReturnedDate = getHistoryDate(history, 'returned', r.data?.ngay_tra_ket_qua || null);

                        return {
                            id: r.id,
                            code: r.so_hieu,
                            customerName: r.noi_nhan_gui,
                            ward: r.data?.xa_phuong,
                            mapSheet: r.data?.so_to,
                            landPlot: r.data?.so_thua,
                            receivedDate: r.ngay_thang,
                            deadline: r.data?.hen_tra,
                            status: statusMapped,
                            assignedTo: r.data?.assigned_to,
                            notes: r.trich_yeu,
                            recordType: r.type === 'saoluc' ? 'Sao lục' : r.type === 'vaoso' ? 'Vào sổ' : 'Công văn',
                            address: r.data?.xa_phuong,
                            phoneNumber: '',
                            content: r.trich_yeu,
                            workCompletedDate,
                            submissionDate,
                            approvalDate,
                            completedDate,
                            resultReturnedDate
                        } as RecordFile;
                    });
                    setArchiveRecords(mapped);
                } catch (e) {
                    console.error("Error loading archive records for report", e);
                }
            };
            loadArchive();
        }
    }, [mainTab]);

    const activeRecords = mainTab === 'measurement' ? records : archiveRecords;

    const activeEmployees = useMemo(() => {
        if (mainTab === 'measurement') {
            return employees.filter(e => {
                const dept = e.department?.toLowerCase() || '';
                return dept.includes('đo đạc') || dept.includes('kỹ thuật');
            });
        } else {
            return employees.filter(e => {
                const dept = e.department?.toLowerCase() || '';
                return dept.includes('lưu trữ') || dept.includes('một cửa');
            });
        }
    }, [employees, mainTab]);

    useEffect(() => {
        if (isKeyModalOpen) {
            setApiKey(getGeminiKey());
        }
    }, [isKeyModalOpen]);

    const handleSaveKey = () => {
        saveGeminiKey(apiKey);
        setIsKeyModalOpen(false);
        showToast("Đã lưu API Key thành công!", "success");
    };

    // ==========================================
    // --- INDEPENDENT FILTER STATE FOR TAB 1 (LIST VIEW) ---
    // ==========================================
    const [listDateMode, setListDateMode] = useState<'all' | 'week' | 'month' | 'custom'>('month');
    const [listFromDate, setListFromDate] = useState<string>(() => {
        const now = new Date();
        return localDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
    });
    const [listToDate, setListToDate] = useState<string>(() => {
        return localDateKey();
    });
    const [listSelectedWard, setListSelectedWard] = useState<string>('all');
    const [listRecordTypeFilter, setListRecordTypeFilter] = useState<string>('all');
    const [listSearchQuery, setListSearchQuery] = useState<string>('');
    const [listStatusFilter, setListStatusFilter] = useState<string>('all');

    // Pagination for list tab
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    const handleListQuickDate = (mode: 'week' | 'month' | 'all') => {
        setListDateMode(mode);
        const now = new Date();
        if (mode === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            const start = new Date(now.setDate(diff));
            setListFromDate(localDateKey(start));
            setListToDate(localDateKey());
        } else if (mode === 'month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            setListFromDate(localDateKey(start));
            setListToDate(localDateKey());
        }
    };

    const listFilteredData = useMemo(() => {
        const start = new Date(listFromDate); start.setHours(0,0,0,0);
        const end = new Date(listToDate); end.setHours(23,59,59,999);

        return activeRecords.filter(r => {
            if (listDateMode !== 'all') {
                if (!r.receivedDate) return false;
                const rDate = new Date(r.receivedDate);
                if (rDate < start || rDate > end) return false;
            }

            if (listSelectedWard !== 'all') {
                const rWard = removeVietnameseTones(r.ward || '');
                const sWard = removeVietnameseTones(listSelectedWard);
                if (!rWard.includes(sWard)) return false;
            }

            if (listRecordTypeFilter !== 'all') {
                if (r.recordType !== listRecordTypeFilter) return false;
            }

            if (listStatusFilter !== 'all') {
                if (listStatusFilter === 'overdue') {
                    if (!isRecordOverdue(r)) return false;
                } else if (listStatusFilter === 'completed') {
                    const isDone = r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.SIGNED || !!r.exportBatch;
                    if (!isDone) return false;
                } else if (listStatusFilter === 'processing') {
                    const isDone = r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.SIGNED || !!r.exportBatch;
                    if (isDone || r.status === RecordStatus.WITHDRAWN) return false;
                } else if (r.status !== listStatusFilter) {
                    return false;
                }
            }

            if (listSearchQuery.trim()) {
                const q = removeVietnameseTones(listSearchQuery.toLowerCase());
                const matchCode = removeVietnameseTones(r.code || '').toLowerCase().includes(q);
                const matchName = removeVietnameseTones(r.customerName || '').toLowerCase().includes(q);
                const matchPlot = String(r.landPlot || '').includes(q);
                const matchSheet = String(r.mapSheet || '').includes(q);
                if (!matchCode && !matchName && !matchPlot && !matchSheet) return false;
            }

            return true;
        });
    }, [activeRecords, listDateMode, listFromDate, listToDate, listSelectedWard, listRecordTypeFilter, listStatusFilter, listSearchQuery]);

    // Reset pagination when list data changes
    useEffect(() => {
        setCurrentPage(1);
    }, [listFilteredData]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return listFilteredData.slice(start, start + itemsPerPage);
    }, [listFilteredData, currentPage, itemsPerPage]);

    const totalPages = Math.max(1, Math.ceil(listFilteredData.length / itemsPerPage));

    // Stats for List Tab
    const listStats = useMemo(() => {
        const total = listFilteredData.length;
        const completed = listFilteredData.filter(r => 
            r.status === RecordStatus.HANDOVER || 
            r.status === RecordStatus.RETURNED || 
            r.status === RecordStatus.SIGNED ||
            !!r.exportBatch || !!r.exportDate
        ).length;
        
        const withdrawn = listFilteredData.filter(r => r.status === RecordStatus.WITHDRAWN).length;
        
        const overduePending = listFilteredData.filter(r => {
            if (r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.SIGNED || r.exportBatch) return false;
            return isRecordOverdue(r);
        }).length;
        
        const overdueCompleted = listFilteredData.filter(r => {
            const isDone = r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.SIGNED || !!r.exportBatch;
            if (!isDone) return false;
            if (!r.deadline || !r.completedDate) return false;
            const d = new Date(r.deadline); d.setHours(0,0,0,0);
            const c = new Date(r.completedDate); c.setHours(0,0,0,0);
            return c > d;
        }).length;

        const processing = total - completed - withdrawn;
        
        const totalPlotCount = listFilteredData.reduce((sum, r) => {
            const isNonPlotType = ['Sao lục', 'Công văn'].includes(r.recordType || '');
            const defaultCount = isNonPlotType ? 0 : 1;
            const count = r.plotCount !== undefined && r.plotCount !== null && String(r.plotCount).trim() !== ''
                ? Number(r.plotCount)
                : defaultCount;
            return sum + (isNaN(count) ? defaultCount : count);
        }, 0);

        return { total, completed, withdrawn, overduePending, overdueCompleted, processing, totalPlotCount };
    }, [listFilteredData]);

    const handleExportExcelClick = () => {
        const from = listDateMode === 'all' ? '2000-01-01' : listFromDate;
        const to = listDateMode === 'all' ? localDateKey() : listToDate;
        onExportExcel(from, to, listSelectedWard);
    };

    const handleGenerateClick = (
        customFromDate?: string, 
        customToDate?: string, 
        customType?: string, 
        customRecords?: RecordFile[]
    ) => {
        const genFrom = customFromDate || listFromDate;
        const genTo = customToDate || listToDate;
        const genType = customType || 'month';
        const genRecords = customRecords || listFilteredData;

        const currentKey = getGeminiKey();
        if (!currentKey && !process.env.API_KEY) {
            setIsKeyModalOpen(true);
            return;
        }

        setActiveTab('ai');
        
        let title = "BÁO CÁO TÌNH HÌNH TIẾP NHẬN VÀ GIẢI QUYẾT HỒ SƠ";
        if (genType === 'week') title = "BÁO CÁO KẾT QUẢ CÔNG TÁC TUẦN";
        if (genType === 'month') title = "BÁO CÁO KẾT QUẢ CÔNG TÁC THÁNG";

        onGenerate(genFrom, genTo, title, genRecords);
    };

    const handlePrint = () => {
        if (!previewRef.current) return;
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(`
                <html>
                <head>
                    <title>Báo cáo</title>
                    <style>
                        @page { size: A4 portrait; margin: 2cm; }
                        body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.3; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { border: 1px solid black; padding: 5px; text-align: left; font-size: 11pt; }
                        th { text-align: center; font-weight: bold; background-color: #f0f0f0; }
                    </style>
                </head>
                <body>${reportContent}</body>
                </html>
            `);
            doc.close();
            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
                document.body.removeChild(iframe);
            }, 500);
        }
    };

    const formatDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('vi-VN') : '-';

    return (
        <div className="flex flex-col h-full overflow-hidden relative bg-slate-50">
            {/* MAIN TAB SWITCHER */}
            <div className="bg-white border-b border-gray-200 flex px-4 pt-2 gap-1 shrink-0">
                <button 
                    onClick={() => setMainTab('measurement')}
                    className={`px-5 py-2.5 text-xs md:text-sm font-bold rounded-t-lg border-t border-l border-r transition-all flex items-center gap-2 ${mainTab === 'measurement' ? 'bg-blue-50 border-gray-200 text-blue-700 border-b-transparent relative top-[1px]' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'}`}
                >
                    <Ruler size={16} /> Báo cáo Đo đạc
                </button>
                <button 
                    onClick={() => setMainTab('archive')}
                    className={`px-5 py-2.5 text-xs md:text-sm font-bold rounded-t-lg border-t border-l border-r transition-all flex items-center gap-2 ${mainTab === 'archive' ? 'bg-orange-50 border-gray-200 text-orange-700 border-b-transparent relative top-[1px]' : 'bg-gray-50 border-transparent text-gray-500 hover:bg-gray-100'}`}
                >
                    <FolderArchive size={16} /> Báo cáo Lưu trữ
                </button>
            </div>

            {/* Content Tabs Header */}
            <div className="flex bg-white border-b border-gray-200 px-4 overflow-x-auto custom-scrollbar shrink-0">
                <button 
                    onClick={() => setActiveTab('list')}
                    className={`px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${activeTab === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <ListFilter size={15}/> Danh sách kết quả ({listFilteredData.length})
                </button>
                <button 
                    onClick={() => setActiveTab('ward_stats')}
                    className={`px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${activeTab === 'ward_stats' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <PieChart size={15}/> Thống kê theo Xã
                </button>
                <button 
                    onClick={() => setActiveTab('employee')}
                    className={`px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${activeTab === 'employee' ? 'border-orange-600 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <UserCheck size={15}/> Thống kê nhân viên
                </button>
                <button 
                    onClick={() => setActiveTab('quantity_report')}
                    className={`px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${activeTab === 'quantity_report' ? 'border-violet-600 text-violet-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <ListFilter size={15}/> Báo cáo số lượng
                </button>
                <button 
                    onClick={() => setActiveTab('execution_report')}
                    className={`px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${activeTab === 'execution_report' ? 'border-amber-600 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <ClipboardCheck size={15}/> Báo cáo HS thực hiện
                </button>
                <button 
                    onClick={() => setActiveTab('daily_stats')}
                    className={`px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${activeTab === 'daily_stats' ? 'border-pink-600 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <CalendarDays size={15}/> Thống kê theo ngày
                </button>
                <button 
                    onClick={() => setActiveTab('late_records')}
                    className={`px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${activeTab === 'late_records' ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <AlertTriangle size={15}/> Hồ sơ trễ hạn
                </button>
                {canViewHandoverControl && (
                    <button 
                        onClick={() => setActiveTab('handover_control')}
                        className={`px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${activeTab === 'handover_control' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <FileCheck2 size={15}/> So sánh hạn trả 1 cửa
                    </button>
                )}
                <button 
                    onClick={() => setActiveTab('ai')}
                    className={`px-4 py-2.5 text-xs md:text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-1.5 ${activeTab === 'ai' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <Sparkles size={15}/> Văn bản Báo cáo (AI)
                </button>
            </div>

            {/* TAB CONTENT CONTAINER */}
            <div className="flex-1 overflow-hidden bg-slate-100 p-0">
                {activeTab === 'list' && (
                    <div className="bg-white rounded-none h-full overflow-hidden flex flex-col animate-fade-in-up">
                        {/* Independent List Toolbar & Filter Bar */}
                        <div className="p-3.5 border-b border-gray-200 bg-slate-50 flex flex-col gap-3 shrink-0">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    {/* Quick Date Presets */}
                                    <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                                        <button 
                                            onClick={() => handleListQuickDate('week')} 
                                            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${listDateMode === 'week' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-blue-700'}`}
                                        >
                                            <CalendarDays size={13} /> Tuần này
                                        </button>
                                        <button 
                                            onClick={() => handleListQuickDate('month')} 
                                            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${listDateMode === 'month' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-blue-700'}`}
                                        >
                                            <Layout size={13} /> Tháng này
                                        </button>
                                        <button 
                                            onClick={() => handleListQuickDate('all')} 
                                            className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${listDateMode === 'all' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-blue-700'}`}
                                        >
                                            Tất cả
                                        </button>
                                    </div>

                                    {/* Date Range Inputs */}
                                    <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg px-2.5 py-1 text-xs shadow-sm">
                                        <span className="text-gray-400 font-medium">Từ:</span>
                                        <input 
                                            type="date" 
                                            value={listFromDate} 
                                            disabled={listDateMode === 'all'}
                                            onChange={(e) => { setListFromDate(e.target.value); setListDateMode('custom'); }} 
                                            className="text-xs outline-none text-gray-700 font-medium disabled:opacity-50" 
                                        />
                                        <span className="text-gray-400 font-medium">Đến:</span>
                                        <input 
                                            type="date" 
                                            value={listToDate} 
                                            disabled={listDateMode === 'all'}
                                            onChange={(e) => { setListToDate(e.target.value); setListDateMode('custom'); }} 
                                            className="text-xs outline-none text-gray-700 font-medium disabled:opacity-50" 
                                        />
                                    </div>

                                    {/* Ward Filter */}
                                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 border border-gray-300 rounded-lg shadow-sm">
                                        <MapPin size={14} className="text-gray-500" />
                                        <select 
                                            value={listSelectedWard} 
                                            onChange={(e) => setListSelectedWard(e.target.value)} 
                                            className="text-xs outline-none bg-transparent text-gray-700 font-medium cursor-pointer max-w-[140px]"
                                        >
                                            <option value="all">Tất cả Xã/Phường</option>
                                            {wards.map(w => (
                                                <option key={w} value={w}>{w}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Record Type Filter */}
                                    <select
                                        value={listRecordTypeFilter}
                                        onChange={(e) => setListRecordTypeFilter(e.target.value)}
                                        className="text-xs px-2.5 py-1 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium shadow-sm outline-none max-w-[160px]"
                                    >
                                        <option value="all">Tất cả loại hồ sơ</option>
                                        {MEASUREMENT_RECORD_TYPES.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>

                                    {/* Status Filter */}
                                    <select
                                        value={listStatusFilter}
                                        onChange={(e) => setListStatusFilter(e.target.value)}
                                        className="text-xs px-2.5 py-1 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium shadow-sm outline-none"
                                    >
                                        <option value="all">Tất cả trạng thái</option>
                                        <option value="completed">Đã hoàn thành / Bàn giao</option>
                                        <option value="processing">Đang xử lý</option>
                                        <option value="overdue">Hồ sơ trễ hạn</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2 ml-auto">
                                    {/* Search Input */}
                                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 border border-gray-300 rounded-lg shadow-sm text-xs">
                                        <Search size={14} className="text-gray-400" />
                                        <input 
                                            type="text" 
                                            placeholder="Tìm mã HS, tên, thửa..."
                                            value={listSearchQuery}
                                            onChange={(e) => setListSearchQuery(e.target.value)}
                                            className="text-xs outline-none w-36 md:w-44 text-gray-700"
                                        />
                                    </div>

                                    <button 
                                        onClick={handleExportExcelClick} 
                                        className="flex items-center gap-1.5 bg-green-600 text-white px-3.5 py-1.5 rounded-lg hover:bg-green-700 font-bold text-xs shadow-sm transition-colors" 
                                        title="Xuất Excel danh sách đang lọc"
                                    >
                                        <FileSpreadsheet size={15} /> Xuất Excel
                                    </button>
                                </div>
                            </div>

                            {/* Metrics Summary Strip for List View */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                                <div className="bg-white border border-blue-100 p-2.5 rounded-lg flex items-center gap-2.5 shadow-2xs">
                                    <div className="bg-blue-100 p-1.5 rounded-md text-blue-700"><ListFilter size={16}/></div>
                                    <div>
                                        <div className="text-base font-bold text-blue-900 leading-tight">{listStats.total}</div>
                                        <div className="text-[10px] text-blue-600 font-semibold uppercase">Tổng hồ sơ</div>
                                    </div>
                                </div>
                                <div className="bg-white border border-green-100 p-2.5 rounded-lg flex items-center gap-2.5 shadow-2xs">
                                    <div className="bg-green-100 p-1.5 rounded-md text-green-700"><CheckCircle2 size={16}/></div>
                                    <div>
                                        <div className="text-base font-bold text-green-900 leading-tight">{listStats.completed}</div>
                                        <div className="text-[10px] text-green-600 font-semibold uppercase">Đã xong</div>
                                    </div>
                                </div>
                                <div className="bg-white border border-orange-100 p-2.5 rounded-lg flex items-center gap-2.5 shadow-2xs">
                                    <div className="bg-orange-100 p-1.5 rounded-md text-orange-700"><Clock size={16}/></div>
                                    <div>
                                        <div className="text-base font-bold text-orange-900 leading-tight">{listStats.processing}</div>
                                        <div className="text-[10px] text-orange-600 font-semibold uppercase">Đang xử lý</div>
                                    </div>
                                </div>
                                <div className="bg-white border border-amber-100 p-2.5 rounded-lg flex items-center gap-2.5 shadow-2xs">
                                    <div className="bg-amber-100 p-1.5 rounded-md text-amber-700"><Ruler size={16}/></div>
                                    <div>
                                        <div className="text-base font-bold text-amber-900 leading-tight">{listStats.totalPlotCount}</div>
                                        <div className="text-[10px] text-amber-600 font-semibold uppercase">Tổng số thửa</div>
                                    </div>
                                </div>
                                <div className="bg-white border border-red-100 p-2.5 rounded-lg flex items-center gap-2.5 shadow-2xs">
                                    <div className="bg-red-100 p-1.5 rounded-md text-red-700"><AlertTriangle size={16}/></div>
                                    <div>
                                        <div className="text-base font-bold text-red-900 leading-tight flex items-baseline gap-1.5">
                                            <span>{listStats.overduePending}</span>
                                            {listStats.overdueCompleted > 0 && (
                                                <span className="text-[11px] text-orange-600 font-normal">({listStats.overdueCompleted} trễ xong)</span>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-red-600 font-semibold uppercase">Trễ hạn chưa xong</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* List Table */}
                        <div className="flex-1 overflow-auto p-3">
                            <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-2xs">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold sticky top-0 shadow-xs z-10">
                                        <tr>
                                            <th className="p-2.5 w-10 text-center">#</th>
                                            <th className="p-2.5 w-28">Mã HS</th>
                                            <th className="p-2.5 w-44">Chủ sử dụng</th>
                                            <th className="p-2.5 w-28">Xã/Phường</th>
                                            <th className="p-2.5 w-14 text-center">Tờ</th>
                                            <th className="p-2.5 w-14 text-center">Thửa</th>
                                            <th className="p-2.5 w-24">Ngày nhận</th>
                                            <th className="p-2.5 w-24">Hẹn trả</th>
                                            <th className="p-2.5 w-24">Hoàn thành</th>
                                            <th className="p-2.5 w-32">NV Xử lý</th>
                                            <th className="p-2.5 w-28 text-center">Trạng thái</th>
                                            <th className="p-2.5">Ghi chú</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {paginatedData.length > 0 ? paginatedData.map((r, i) => {
                                            const emp = employees.find(e => e.id === r.assignedTo);
                                            const isOverdue = isRecordOverdue(r);
                                            const rowIndex = (currentPage - 1) * itemsPerPage + i + 1;
                                            
                                            let isCompletedLate = false;
                                            if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.SIGNED) {
                                                if (r.deadline && r.completedDate) {
                                                    const d = new Date(r.deadline); d.setHours(0,0,0,0);
                                                    const c = new Date(r.completedDate); c.setHours(0,0,0,0);
                                                    if (c > d) isCompletedLate = true;
                                                }
                                            }

                                            return (
                                            <tr key={r.id} className="hover:bg-blue-50/50 transition-colors">
                                                <td className="p-2.5 text-center text-gray-400">{rowIndex}</td>
                                                <td className="p-2.5 font-bold text-blue-600">{r.code}</td>
                                                <td className="p-2.5 font-medium text-gray-900">{r.customerName}</td>
                                                <td className="p-2.5 text-gray-600">{getNormalizedWard(r.ward)}</td>
                                                <td className="p-2.5 text-center text-gray-600">{r.mapSheet || '-'}</td>
                                                <td className="p-2.5 text-center text-gray-600">{r.landPlot || '-'}</td>
                                                <td className="p-2.5 text-gray-600">{formatDate(r.receivedDate)}</td>
                                                <td className={`p-2.5 font-medium ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-600'}`}>{formatDate(r.deadline)}</td>
                                                <td className={`p-2.5 font-medium ${isCompletedLate ? 'text-orange-600' : 'text-green-700'}`}>
                                                    {formatDate(r.completedDate)}
                                                </td>
                                                <td className="p-2.5 text-gray-600 text-xs truncate" title={emp?.name}>{emp ? emp.name : '-'}</td>
                                                <td className="p-2.5 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                                        r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED ? 'bg-green-50 text-green-700 border-green-200' : 
                                                        r.status === RecordStatus.WITHDRAWN ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                                        isOverdue ? 'bg-red-50 text-red-700 border-red-200' :
                                                        'bg-blue-50 text-blue-700 border-blue-100'
                                                    }`}>
                                                        {STATUS_LABELS[r.status]}
                                                    </span>
                                                </td>
                                                <td className="p-2.5 text-gray-500 italic truncate max-w-xs">
                                                    {isCompletedLate && <span className="text-[10px] text-orange-600 font-bold mr-1">[Trễ xong]</span>}
                                                    {r.notes || r.content}
                                                </td>
                                            </tr>
                                        )}) : (
                                            <tr>
                                                <td colSpan={12} className="p-8 text-center text-gray-400">
                                                    Không tìm thấy hồ sơ nào phù hợp với bộ lọc hiện tại.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Pagination Footer */}
                        {listFilteredData.length > 0 && (
                            <div className="border-t border-gray-200 p-2.5 bg-gray-50 flex justify-between items-center shrink-0">
                                <span className="text-xs text-gray-500">
                                    Hiển thị <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> - <strong>{Math.min(currentPage * itemsPerPage, listFilteredData.length)}</strong> trên tổng <strong>{listFilteredData.length}</strong>
                                </span>
                                <div className="flex items-center gap-1">
                                    <div className="flex items-center mr-4 gap-2">
                                        <span className="text-xs text-gray-500">Số lượng:</span>
                                        <select 
                                            value={itemsPerPage} 
                                            onChange={(e) => setItemsPerPage(Number(e.target.value))} 
                                            className="border border-gray-300 rounded px-2 py-0.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                        >
                                            <option value={20}>20</option>
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                            <option value={500}>500</option>
                                        </select>
                                    </div>
                                    <button 
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                                        disabled={currentPage === 1} 
                                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="text-xs font-medium mx-2">Trang {currentPage} / {totalPages}</span>
                                    <button 
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                                        disabled={currentPage === totalPages} 
                                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'ward_stats' && (
                    <WardStatsView records={activeRecords} />
                )}

                {activeTab === 'employee' && (
                    <EmployeeStatsView 
                        records={activeRecords}
                        employees={activeEmployees}
                        schedules={schedules}
                        selectedEmpId={selectedEmpId}
                        setSelectedEmpId={setSelectedEmpId}
                    />
                )}

                {activeTab === 'quantity_report' && (
                    <QuantityReportView
                        records={activeRecords}
                        employees={activeEmployees}
                        schedules={schedules}
                        fromDate={listFromDate}
                        toDate={listToDate}
                    />
                )}

                {activeTab === 'execution_report' && (
                    <ExecutionReportView
                        records={activeRecords}
                        employees={activeEmployees}
                        schedules={schedules}
                        fromDate={listFromDate}
                        toDate={listToDate}
                    />
                )}

                {activeTab === 'daily_stats' && (
                    <DailyStatsView 
                        records={activeRecords} 
                        employees={employees} 
                        wards={wards} 
                    />
                )}

                {activeTab === 'late_records' && (
                    <LateRecordsView
                        records={activeRecords}
                        employees={activeEmployees}
                        wards={wards}
                    />
                )}

                {activeTab === 'handover_control' && canViewHandoverControl && (
                    <HandoverComparisonView
                        records={activeRecords}
                        employees={employees}
                        wards={wards}
                        fromDate={listFromDate}
                        toDate={listToDate}
                    />
                )}

                {activeTab === 'ai' && (
                    <div className="h-full w-full overflow-y-auto custom-scrollbar">
                        <AiReportCardView
                            reportContent={reportContent}
                            isGenerating={isGenerating}
                            onGenerate={handleGenerateClick}
                            onPrint={handlePrint}
                            onOpenKeyModal={() => setIsKeyModalOpen(true)}
                            records={activeRecords}
                        />
                    </div>
                )}
            </div>

            {/* API Key Modal */}
            {isKeyModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in-up">
                        <div className="p-5 border-b flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <Key className="text-purple-600" size={20} /> Cấu hình Gemini API Key
                            </h3>
                            <button onClick={() => setIsKeyModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                Để sử dụng tính năng viết báo cáo tự động, bạn cần nhập Google Gemini API Key.
                                Key này sẽ được lưu trong trình duyệt của bạn.
                            </p>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">API Key</label>
                                <input 
                                    type="password" 
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                    placeholder="Dán API Key vào đây..."
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button onClick={() => setIsKeyModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium text-sm">Hủy</button>
                                <button onClick={handleSaveKey} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-bold text-sm shadow-sm">
                                    <Save size={16} /> Lưu Cấu Hình
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportSection;
