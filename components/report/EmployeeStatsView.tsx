import React, { useState, useMemo } from 'react';
import { RecordFile, Employee, RecordStatus, WorkSchedule } from '../../types';
import { generateEmployeeEvaluation } from '../../services/geminiService';
import { 
    User as UserIcon, AlertOctagon, Sparkles, Loader2, ListFilter, 
    CheckCircle2, Clock, AlertTriangle, Briefcase, FileSpreadsheet, 
    Calendar, ChevronRight, CheckCircle, ArrowLeft, Layers, 
    Folder, HelpCircle 
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { STATUS_LABELS } from '../../constants';

interface EmployeeStatsViewProps {
    records: RecordFile[];
    employees: Employee[];
    schedules: WorkSchedule[];
    fromDate: string;
    toDate: string;
    selectedEmpId: string;
    setSelectedEmpId: (id: string) => void;
}

const EmployeeStatsView: React.FC<EmployeeStatsViewProps> = ({ 
    records, employees, schedules = [], fromDate, toDate, selectedEmpId, setSelectedEmpId 
}) => {
    const [aiEvaluation, setAiEvaluation] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [recordListTab, setRecordListTab] = useState<'uncompleted' | 'completed'>('uncompleted');

    // Helper: format dates
    const formatLocalDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('vi-VN');
        } catch {
            return dateStr;
        }
    };

    // Filter records by date range
    const recordsInTimeRange = useMemo(() => {
        const start = new Date(fromDate); start.setHours(0,0,0,0);
        const end = new Date(toDate); end.setHours(23,59,59,999);
        return records.filter(r => {
            if (!r.receivedDate) return false;
            const rDate = new Date(r.receivedDate);
            return rDate >= start && rDate <= end;
        });
    }, [records, fromDate, toDate]);

    // Filter schedules by date range
    const schedulesInTimeRange = useMemo(() => {
        const start = new Date(fromDate); start.setHours(0,0,0,0);
        const end = new Date(toDate); end.setHours(23,59,59,999);
        return schedules.filter(s => {
            if (!s.date) return false;
            const sDate = new Date(s.date);
            return sDate >= start && sDate <= end;
        });
    }, [schedules, fromDate, toDate]);

    // Calculate report statistics for each employee
    const employeeStatsList = useMemo(() => {
        return employees.map(emp => {
            const empRecords = recordsInTimeRange.filter(r => r.assignedTo === emp.id);
            const total = empRecords.length;
            
            let completed = 0;
            let uncompleted = 0;
            let overdue = 0;
            
            // Record types count for this employee
            const typesMap: { [key: string]: { total: number, completed: number, uncompleted: number } } = {};
            const uncompletedList: RecordFile[] = [];
            const completedList: RecordFile[] = [];
            
            empRecords.forEach(r => {
                const isFinished = [
                    RecordStatus.HANDOVER, 
                    RecordStatus.RETURNED, 
                    RecordStatus.WITHDRAWN, 
                    RecordStatus.SIGNED
                ].includes(r.status) || !!r.exportBatch || !!r.exportDate;

                const rType = r.recordType || 'Đo đạc / Khác';
                if (!typesMap[rType]) {
                    typesMap[rType] = { total: 0, completed: 0, uncompleted: 0 };
                }
                typesMap[rType].total++;

                if (isFinished) {
                    completed++;
                    typesMap[rType].completed++;
                    completedList.push(r);
                } else {
                    uncompleted++;
                    typesMap[rType].uncompleted++;
                    uncompletedList.push(r);
                    if (r.deadline) {
                        const d = new Date(r.deadline); d.setHours(0,0,0,0);
                        const today = new Date(); today.setHours(0,0,0,0);
                        if (today > d) {
                            overdue++;
                        }
                    }
                }
            });
            
            // Filter schedules for this employee where their name is mentioned as executor
            const empSchedules = schedulesInTimeRange.filter(s => {
                if (!s.executors) return false;
                return s.executors.toLowerCase().includes(emp.name.toLowerCase());
            });
            
            return {
                employee: emp,
                total,
                completed,
                uncompleted,
                overdue,
                typesMap,
                uncompletedList,
                completedList,
                schedulesCount: empSchedules.length,
                schedules: empSchedules
            };
        });
    }, [employees, recordsInTimeRange, schedulesInTimeRange]);

    // Summary statistics for ALL employees
    const overallSummary = useMemo(() => {
        let total = 0;
        let completed = 0;
        let uncompleted = 0;
        let overdue = 0;
        
        employeeStatsList.forEach(emp => {
            total += emp.total;
            completed += emp.completed;
            uncompleted += emp.uncompleted;
            overdue += emp.overdue;
        });

        return {
            total,
            completed,
            uncompleted,
            overdue,
            schedulesCount: schedulesInTimeRange.length
        };
    }, [employeeStatsList, schedulesInTimeRange]);

    // Selected employee stats
    const selectedEmpStats = useMemo(() => {
        if (!selectedEmpId) return null;
        return employeeStatsList.find(item => item.employee.id === selectedEmpId) || null;
    }, [employeeStatsList, selectedEmpId]);

    // AI Evaluation generation
    const handleGenerateReview = async () => {
        if (!selectedEmpStats) return;
        setIsGenerating(true);
        const empName = selectedEmpStats.employee.name;
        
        const overdueList = selectedEmpStats.uncompletedList
            .filter(r => {
                if (!r.deadline) return false;
                const d = new Date(r.deadline); d.setHours(0,0,0,0);
                const today = new Date(); today.setHours(0,0,0,0);
                return today > d;
            })
            .map(r => {
                let daysOver = 0;
                if (r.deadline) {
                    const diffTime = new Date().setHours(0,0,0,0) - new Date(r.deadline).setHours(0,0,0,0);
                    daysOver = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
                }
                return {
                    code: r.code,
                    customer: r.customerName,
                    daysOverdue: daysOver
                };
            });

        const aiStats = {
            total: selectedEmpStats.total,
            onTime: selectedEmpStats.completed,
            approaching: 0, 
            overdue: selectedEmpStats.overdue,
            onTimeRate: selectedEmpStats.total > 0 ? ((selectedEmpStats.completed / selectedEmpStats.total) * 100).toFixed(1) : '0'
        };

        const result = await generateEmployeeEvaluation(
            empName,
            aiStats,
            overdueList,
            `Từ ${new Date(fromDate).toLocaleDateString('vi-VN')} đến ${new Date(toDate).toLocaleDateString('vi-VN')}`
        );
        
        setAiEvaluation(result);
        setIsGenerating(false);
    };

    // Excel Export for single employee report
    const handleExportEmployeeReport = () => {
        if (!selectedEmpStats) return;
        const emp = selectedEmpStats.employee;
        
        // Tab 1: Metadata & Summary
        const summaryData = [
            ['BÁO CÁO CHI TIẾT HIỆU SUẤT NHÂN VIÊN'],
            ['Nhân viên:', emp.name],
            ['Tổ / Phòng ban:', emp.department],
            ['Chức vụ:', emp.position || 'Nhân viên'],
            ['Thời gian báo cáo:', `Từ ngày ${formatLocalDate(fromDate)} đến ngày ${formatLocalDate(toDate)}`],
            [],
            ['CHỈ SỐ THỐNG KÊ'],
            ['Tổng số hồ sơ phụ trách', selectedEmpStats.total],
            ['Đã hoàn thành', selectedEmpStats.completed, `${selectedEmpStats.total > 0 ? ((selectedEmpStats.completed / selectedEmpStats.total) * 100).toFixed(1) : 0}%`],
            ['Chưa hoàn thành (đang xử lý)', selectedEmpStats.uncompleted, `${selectedEmpStats.total > 0 ? ((selectedEmpStats.uncompleted / selectedEmpStats.total) * 100).toFixed(1) : 0}%`],
            ['Hồ sơ trễ hạn', selectedEmpStats.overdue],
            ['Số buổi công tác', selectedEmpStats.schedulesCount],
            [],
            ['CƠ CẤU LOẠI HỒ SƠ'],
            ['Loại hồ sơ', 'Tổng số', 'Đã hoàn thành', 'Chưa hoàn thành']
        ];

        Object.entries(selectedEmpStats.typesMap).forEach(([type, stats]) => {
            summaryData.push([type, stats.total, stats.completed, stats.uncompleted]);
        });

        // Tab 2: Record List (Uncompleted)
        const uncompletedData = selectedEmpStats.uncompletedList.map((r, idx) => ({
            'STT': idx + 1,
            'Mã hồ sơ': r.code,
            'Chủ sử dụng': r.customerName,
            'Địa chỉ': r.address || r.ward || '',
            'Loại hồ sơ': r.recordType || 'Đo đạc / Khác',
            'Ngày nhận': formatLocalDate(r.receivedDate),
            'Hẹn trả': formatLocalDate(r.deadline),
            'Trạng thái': STATUS_LABELS[r.status] || r.status,
            'Ghi chú': r.notes || r.content || ''
        }));

        // Tab 3: Record List (Completed)
        const completedData = selectedEmpStats.completedList.map((r, idx) => ({
            'STT': idx + 1,
            'Mã hồ sơ': r.code,
            'Chủ sử dụng': r.customerName,
            'Địa chỉ': r.address || r.ward || '',
            'Loại hồ sơ': r.recordType || 'Đo đạc / Khác',
            'Ngày nhận': formatLocalDate(r.receivedDate),
            'Hẹn trả': formatLocalDate(r.deadline),
            'Ngày hoàn thành': formatLocalDate(r.completedDate),
            'Trạng thái': STATUS_LABELS[r.status] || r.status,
            'Ghi chú': r.notes || r.content || ''
        }));

        // Tab 4: Work Schedules
        const scheduleData = selectedEmpStats.schedules.map((s, idx) => ({
            'STT': idx + 1,
            'Ngày công tác': formatLocalDate(s.date),
            'Địa bàn công tác': s.location || 'Chưa chọn',
            'Nội dung công tác': s.content,
            'Cơ quan phối hợp': s.partner || 'Không',
            'Nhân sự tham gia': s.executors
        }));

        const wb = XLSX.utils.book_new();
        
        // Add worksheets
        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Tóm tắt hiệu suất");

        if (uncompletedData.length > 0) {
            const wsUncompleted = XLSX.utils.json_to_sheet(uncompletedData);
            XLSX.utils.book_append_sheet(wb, wsUncompleted, "Hồ sơ chưa hoàn thành");
        }
        if (completedData.length > 0) {
            const wsCompleted = XLSX.utils.json_to_sheet(completedData);
            XLSX.utils.book_append_sheet(wb, wsCompleted, "Hồ sơ đã hoàn thành");
        }
        if (scheduleData.length > 0) {
            const wsSchedules = XLSX.utils.json_to_sheet(scheduleData);
            XLSX.utils.book_append_sheet(wb, wsSchedules, "Lịch công tác");
        }

        XLSX.writeFile(wb, `BC_NhanVien_${emp.name}_${fromDate}_to_${toDate}.xlsx`);
    };

    return (
        <div className="flex flex-col h-full bg-slate-100 p-6 overflow-y-auto">
            
            {/* 1. SELECTION BAR */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
                        <Briefcase size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-800 text-sm uppercase">Báo cáo nhân viên chi tiết</h4>
                        <p className="text-xs text-gray-500">Thống kê số lượng, phân loại hồ sơ và lịch công tác nhân sự</p>
                    </div>
                </div>
                
                <div className="w-full md:w-96">
                    <div className="relative">
                        <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <select 
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 bg-white transition-shadow shadow-sm cursor-pointer hover:border-indigo-300"
                            value={selectedEmpId}
                            onChange={(e) => { setSelectedEmpId(e.target.value); setAiEvaluation(''); }}
                        >
                            <option value="">-- Tổng hợp tất cả nhân viên --</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name} - {emp.department}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* 2. DYNAMIC VIEW */}
            {!selectedEmpId ? (
                /* --- CONSOLIDATED VIEW (TỔNG HỢP TẤT CẢ) --- */
                <div className="space-y-6 animate-fade-in">
                    
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                            <div className="bg-indigo-100 p-3 rounded-lg text-indigo-600"><Layers size={20}/></div>
                            <div>
                                <div className="text-2xl font-black text-gray-800">{overallSummary.total}</div>
                                <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Tổng hồ sơ giao</div>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                            <div className="bg-green-100 p-3 rounded-lg text-green-600"><CheckCircle size={20}/></div>
                            <div>
                                <div className="text-2xl font-black text-green-700">
                                    {overallSummary.completed}
                                    <span className="text-xs text-gray-400 ml-1 font-medium">
                                        ({overallSummary.total > 0 ? ((overallSummary.completed / overallSummary.total) * 100).toFixed(0) : 0}%)
                                    </span>
                                </div>
                                <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Đã hoàn thành</div>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                            <div className="bg-orange-100 p-3 rounded-lg text-orange-600"><Clock size={20}/></div>
                            <div>
                                <div className="text-2xl font-black text-orange-700">
                                    {overallSummary.uncompleted}
                                    <span className="text-xs text-gray-400 ml-1 font-medium">
                                        ({overallSummary.total > 0 ? ((overallSummary.uncompleted / overallSummary.total) * 100).toFixed(0) : 0}%)
                                    </span>
                                </div>
                                <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Chưa hoàn thành</div>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                            <div className="bg-red-100 p-3 rounded-lg text-red-600"><AlertTriangle size={20}/></div>
                            <div>
                                <div className="text-2xl font-black text-red-700">{overallSummary.overdue}</div>
                                <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Trễ hạn (Đang xử lý)</div>
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
                            <div className="bg-blue-100 p-3 rounded-lg text-blue-600"><Calendar size={20}/></div>
                            <div>
                                <div className="text-2xl font-black text-blue-700">{overallSummary.schedulesCount}</div>
                                <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Lịch công tác kì này</div>
                            </div>
                        </div>
                    </div>

                    {/* Consolidated Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-4 bg-gray-50/75 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 text-sm uppercase flex items-center gap-2">
                                <ListFilter size={16} className="text-indigo-600" /> Bảng tổng hợp báo cáo nhân sự chi tiết
                            </h3>
                            <span className="text-xs text-gray-500 font-semibold">
                                Khoảng thời gian: <span className="text-indigo-700 font-bold">{formatLocalDate(fromDate)}</span> - <span className="text-indigo-700 font-bold">{formatLocalDate(toDate)}</span>
                            </span>
                        </div>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead className="bg-gray-100 text-[11px] text-gray-500 font-bold uppercase tracking-wider border-b border-gray-200">
                                    <tr>
                                        <th className="p-4">Nhân sự</th>
                                        <th className="p-4 text-center">Tổng hồ sơ</th>
                                        <th className="p-4">Phân loại loại hồ sơ</th>
                                        <th className="p-4 text-center">Đã hoàn thành</th>
                                        <th className="p-4 text-center">Chưa hoàn thành</th>
                                        <th className="p-4 text-center">Lịch công tác</th>
                                        <th className="p-4 text-center">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {employeeStatsList.map(item => {
                                        const completionRate = item.total > 0 ? (item.completed / item.total) * 100 : 0;
                                        
                                        // Get compact type badges
                                        const typeBadges = Object.entries(item.typesMap).map(([type, stats]) => (
                                            <span key={type} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded border border-gray-200" title={type}>
                                                <span className="max-w-[120px] truncate">{type}</span>
                                                <strong className="text-indigo-600 font-bold bg-indigo-50 px-1 rounded">{stats.total}</strong>
                                            </span>
                                        ));

                                        return (
                                            <tr key={item.employee.id} className="hover:bg-slate-50/80 transition-colors">
                                                {/* Nhân viên */}
                                                <td className="p-4">
                                                    <div className="font-bold text-gray-900 leading-tight">{item.employee.name}</div>
                                                    <div className="text-xs text-gray-400 font-medium mt-0.5">{item.employee.department} {item.employee.position ? ` - ${item.employee.position}` : ''}</div>
                                                </td>
                                                {/* Tổng hồ sơ */}
                                                <td className="p-4 text-center">
                                                    <div className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 font-bold text-sm px-2.5 py-1 rounded border border-indigo-100">
                                                        <Folder size={14} />
                                                        {item.total}
                                                    </div>
                                                </td>
                                                {/* Phân loại loại hồ sơ */}
                                                <td className="p-4">
                                                    {typeBadges.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1.5 max-w-sm">
                                                            {typeBadges}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">Không có hồ sơ</span>
                                                    )}
                                                </td>
                                                {/* Đã hoàn thành */}
                                                <td className="p-4 text-center">
                                                    <div className="flex flex-col items-center justify-center">
                                                        <span className="font-bold text-green-700 text-sm">{item.completed} hồ sơ</span>
                                                        <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.2 rounded border border-green-100 font-bold mt-1">
                                                            {completionRate.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </td>
                                                {/* Chưa hoàn thành */}
                                                <td className="p-4 text-center">
                                                    <div className="flex flex-col items-center justify-center">
                                                        <span className="font-semibold text-gray-700">{item.uncompleted} hồ sơ</span>
                                                        {item.overdue > 0 && (
                                                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded border border-red-200 font-bold mt-1">
                                                                {item.overdue} trễ hạn
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                {/* Lịch công tác */}
                                                <td className="p-4 text-center">
                                                    <div className="inline-flex items-center gap-1 text-slate-700 font-bold text-xs bg-slate-100 px-2.5 py-1 rounded">
                                                        <Calendar size={12} className="text-slate-500" />
                                                        {item.schedulesCount} buổi
                                                    </div>
                                                </td>
                                                {/* Hành động */}
                                                <td className="p-4 text-center">
                                                    <button 
                                                        onClick={() => setSelectedEmpId(item.employee.id)}
                                                        className="inline-flex items-center gap-1 bg-white text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 hover:border-indigo-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
                                                    >
                                                        Xem báo cáo <ChevronRight size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                /* --- INDIVIDUAL DETAILED REPORT (BÁO CÁO CHI TIẾT NHÂN VIÊN) --- */
                selectedEmpStats && (
                    <div className="space-y-6 animate-fade-in">
                        
                        {/* Header details with Back & Excel export */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => { setSelectedEmpId(''); setAiEvaluation(''); }}
                                    className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                                    title="Quay lại danh sách tổng hợp"
                                >
                                    <ArrowLeft size={18} />
                                </button>
                                <div>
                                    <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Thông tin báo cáo nhân viên</div>
                                    <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2 mt-0.5">
                                        {selectedEmpStats.employee.name}
                                        <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-bold">
                                            {selectedEmpStats.employee.department}
                                        </span>
                                    </h2>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button 
                                    onClick={handleExportEmployeeReport}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-green-600 text-white hover:bg-green-700 px-4 py-2.5 rounded-lg font-bold text-sm shadow-sm transition-colors"
                                >
                                    <FileSpreadsheet size={16} /> Xuất Báo Cáo Excel
                                </button>
                            </div>
                        </div>

                        {/* Bento Quantity Metrics */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-slate-800 text-white p-5 rounded-xl shadow-sm relative overflow-hidden">
                                <div className="text-3xl font-black">{selectedEmpStats.total}</div>
                                <div className="text-xs text-slate-300 font-bold uppercase tracking-wider mt-1">Tổng hồ sơ phụ trách</div>
                                <div className="absolute right-3 bottom-3 text-white/5"><Folder size={80} /></div>
                            </div>
                            <div className="bg-green-700 text-white p-5 rounded-xl shadow-sm relative overflow-hidden">
                                <div className="text-3xl font-black">
                                    {selectedEmpStats.completed}
                                    <span className="text-base font-semibold text-green-200 ml-2">
                                        ({selectedEmpStats.total > 0 ? ((selectedEmpStats.completed / selectedEmpStats.total) * 100).toFixed(1) : 0}%)
                                    </span>
                                </div>
                                <div className="text-xs text-green-100 font-bold uppercase tracking-wider mt-1">Hồ sơ đã hoàn thành</div>
                                <div className="absolute right-3 bottom-3 text-white/5"><CheckCircle2 size={80} /></div>
                            </div>
                            <div className="bg-orange-600 text-white p-5 rounded-xl shadow-sm relative overflow-hidden">
                                <div className="text-3xl font-black">
                                    {selectedEmpStats.uncompleted}
                                    <span className="text-base font-semibold text-orange-200 ml-2">
                                        ({selectedEmpStats.total > 0 ? ((selectedEmpStats.uncompleted / selectedEmpStats.total) * 100).toFixed(1) : 0}%)
                                    </span>
                                </div>
                                <div className="text-xs text-orange-100 font-bold uppercase tracking-wider mt-1">Hồ sơ chưa hoàn thành</div>
                                <div className="absolute right-3 bottom-3 text-white/5"><Clock size={80} /></div>
                            </div>
                            <div className={`p-5 rounded-xl shadow-sm relative overflow-hidden text-white ${selectedEmpStats.overdue > 0 ? 'bg-rose-600' : 'bg-teal-600'}`}>
                                <div className="text-3xl font-black">
                                    {selectedEmpStats.overdue > 0 ? `${selectedEmpStats.overdue} hồ sơ` : '0 - An toàn'}
                                </div>
                                <div className="text-xs text-rose-100 font-bold uppercase tracking-wider mt-1">Hồ sơ trễ hạn (Đang xử lý)</div>
                                <div className="absolute right-3 bottom-3 text-white/5"><AlertTriangle size={80} /></div>
                            </div>
                        </div>

                        {/* Two-Column Grid: Record types breakdown & Work schedule */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            {/* COLUMN 1: LOẠI HỒ SƠ PHỤ TRÁCH */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col h-[380px]">
                                <h3 className="font-extrabold text-gray-800 text-sm uppercase flex items-center gap-2 border-b border-gray-100 pb-3 mb-3">
                                    <Layers size={16} className="text-indigo-600" /> Cơ cấu & phân loại loại hồ sơ phụ trách
                                </h3>
                                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                                    {Object.keys(selectedEmpStats.typesMap).length > 0 ? (
                                        Object.entries(selectedEmpStats.typesMap).map(([type, stats]) => {
                                            const typeCompRate = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
                                            return (
                                                <div key={type} className="space-y-1.5 p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="font-extrabold text-gray-900 truncate pr-4">{type}</span>
                                                        <span className="font-bold text-gray-500 shrink-0">
                                                            Tổng số: <strong className="text-indigo-700">{stats.total}</strong>
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Progress representation */}
                                                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden flex">
                                                        <div 
                                                            className="bg-green-600 h-full rounded-l" 
                                                            style={{ width: `${typeCompRate}%` }}
                                                            title={`Đã xong: ${typeCompRate.toFixed(0)}%`}
                                                        />
                                                        <div 
                                                            className="bg-orange-500 h-full rounded-r" 
                                                            style={{ width: `${100 - typeCompRate}%` }}
                                                            title={`Đang xử lý: ${(100 - typeCompRate).toFixed(0)}%`}
                                                        />
                                                    </div>
                                                    
                                                    <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 mt-0.5 uppercase tracking-wide">
                                                        <span className="text-green-600 flex items-center gap-0.5">
                                                            Đã xong: {stats.completed}
                                                        </span>
                                                        <span className="text-orange-600 flex items-center gap-0.5">
                                                            Đang xử lý: {stats.uncompleted}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400 italic text-xs">
                                            <p>Chưa có thông tin phân bổ loại hồ sơ.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* COLUMN 2: LỊCH CÔNG TÁC TRONG KÌ */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col h-[380px]">
                                <h3 className="font-extrabold text-gray-800 text-sm uppercase flex items-center gap-2 border-b border-gray-100 pb-3 mb-3">
                                    <Calendar size={16} className="text-indigo-600" /> Nhật ký lịch công tác thực tế
                                </h3>
                                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                    {selectedEmpStats.schedules.length > 0 ? (
                                        selectedEmpStats.schedules.map((s, idx) => (
                                            <div key={s.id || idx} className="p-3 bg-indigo-50/30 rounded-lg border border-indigo-100/50 flex gap-3 relative hover:bg-indigo-50/50 transition-colors">
                                                <div className="bg-white border border-indigo-200 text-indigo-700 w-10 h-10 rounded flex flex-col items-center justify-center shrink-0">
                                                    <span className="text-[10px] uppercase font-bold tracking-wider leading-none">Tháng</span>
                                                    <span className="text-sm font-extrabold leading-none mt-0.5">
                                                        {s.date ? new Date(s.date).getMonth() + 1 : '-'}
                                                    </span>
                                                </div>
                                                <div className="min-w-0 flex-1 space-y-1">
                                                    <div className="font-bold text-gray-900 text-xs flex items-center justify-between gap-2">
                                                        <span>Ngày: {formatLocalDate(s.date)}</span>
                                                        {s.location && (
                                                            <span className="text-[10px] font-extrabold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200 shrink-0">
                                                                📍 {s.location}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-700 leading-relaxed font-semibold">
                                                        {s.content}
                                                    </p>
                                                    {s.partner && (
                                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">
                                                            Đối tác: {s.partner}
                                                        </div>
                                                    )}
                                                    <div className="text-[10px] text-gray-400 italic">
                                                        Nhân sự khác: {s.executors}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400 italic text-xs">
                                            <Calendar size={32} className="opacity-20 mb-2 text-indigo-900" />
                                            <p>Không có lịch công tác nào được đăng ký trong khoảng thời gian này.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Record Lists Section (Đang xử lý / Đã hoàn thành) */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                            <div className="border-b border-gray-200 bg-gray-50/75 flex px-4">
                                <button
                                    onClick={() => setRecordListTab('uncompleted')}
                                    className={`px-4 py-3 text-xs font-bold border-b-2 uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                        recordListTab === 'uncompleted' 
                                            ? 'border-orange-600 text-orange-600' 
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    Hồ sơ đang xử lý ({selectedEmpStats.uncompletedList.length})
                                </button>
                                <button
                                    onClick={() => setRecordListTab('completed')}
                                    className={`px-4 py-3 text-xs font-bold border-b-2 uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                                        recordListTab === 'completed' 
                                            ? 'border-green-600 text-green-700' 
                                            : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    Hồ sơ đã hoàn thành ({selectedEmpStats.completedList.length})
                                </button>
                            </div>

                            <div className="max-h-96 overflow-y-auto">
                                {recordListTab === 'uncompleted' ? (
                                    selectedEmpStats.uncompletedList.length > 0 ? (
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead className="bg-slate-100 font-bold uppercase text-[10px] text-gray-500 border-b border-gray-200 sticky top-0 shadow-sm z-10">
                                                <tr>
                                                    <th className="p-3">Mã hồ sơ</th>
                                                    <th className="p-3">Chủ sử dụng</th>
                                                    <th className="p-3">Địa chỉ</th>
                                                    <th className="p-3">Loại hồ sơ</th>
                                                    <th className="p-3">Ngày nhận</th>
                                                    <th className="p-3">Hẹn trả</th>
                                                    <th className="p-3 text-center">Trạng thái</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {selectedEmpStats.uncompletedList.map(r => {
                                                    const d = r.deadline ? new Date(r.deadline) : null;
                                                    const today = new Date(); today.setHours(0,0,0,0);
                                                    const isOverdue = d ? today > d : false;
                                                    return (
                                                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                                            <td className="p-3 font-bold text-blue-600">{r.code}</td>
                                                            <td className="p-3 font-bold text-gray-800">{r.customerName}</td>
                                                            <td className="p-3 text-gray-600 truncate max-w-xs">{r.address || r.ward || '-'}</td>
                                                            <td className="p-3 text-gray-600 font-medium">{r.recordType || 'Đo đạc / Khác'}</td>
                                                            <td className="p-3 text-gray-500">{formatLocalDate(r.receivedDate)}</td>
                                                            <td className={`p-3 font-semibold ${isOverdue ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                                                                {formatLocalDate(r.deadline)} {isOverdue && '[Trễ]'}
                                                            </td>
                                                            <td className="p-3 text-center">
                                                                <span className="bg-amber-50 text-amber-800 border border-amber-200 font-bold rounded px-1.5 py-0.5">
                                                                    {STATUS_LABELS[r.status]}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="p-8 text-center text-gray-400 italic">Không có hồ sơ nào đang xử lý.</div>
                                    )
                                ) : (
                                    selectedEmpStats.completedList.length > 0 ? (
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead className="bg-slate-100 font-bold uppercase text-[10px] text-gray-500 border-b border-gray-200 sticky top-0 shadow-sm z-10">
                                                <tr>
                                                    <th className="p-3">Mã hồ sơ</th>
                                                    <th className="p-3">Chủ sử dụng</th>
                                                    <th className="p-3">Địa chỉ</th>
                                                    <th className="p-3">Loại hồ sơ</th>
                                                    <th className="p-3">Ngày nhận</th>
                                                    <th className="p-3">Hẹn trả</th>
                                                    <th className="p-3">Ngày hoàn thành</th>
                                                    <th className="p-3 text-center">Trạng thái</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {selectedEmpStats.completedList.map(r => (
                                                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                                        <td className="p-3 font-bold text-blue-600">{r.code}</td>
                                                        <td className="p-3 font-bold text-gray-800">{r.customerName}</td>
                                                        <td className="p-3 text-gray-600 truncate max-w-xs">{r.address || r.ward || '-'}</td>
                                                        <td className="p-3 text-gray-600 font-medium">{r.recordType || 'Đo đạc / Khác'}</td>
                                                        <td className="p-3 text-gray-500">{formatLocalDate(r.receivedDate)}</td>
                                                        <td className="p-3 text-gray-500">{formatLocalDate(r.deadline)}</td>
                                                        <td className="p-3 text-green-700 font-bold">{formatLocalDate(r.completedDate)}</td>
                                                        <td className="p-3 text-center">
                                                            <span className="bg-green-50 text-green-800 border border-green-200 font-bold rounded px-1.5 py-0.5">
                                                                {STATUS_LABELS[r.status]}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="p-8 text-center text-gray-400 italic">Không có hồ sơ nào đã hoàn thành.</div>
                                    )
                                )}
                            </div>
                        </div>

                        {/* AI Analysis and Performance appraisal panel */}
                        <div className="flex flex-col bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden">
                            <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center shrink-0">
                                <h4 className="font-bold text-indigo-800 flex items-center gap-2 text-sm uppercase">
                                    <Sparkles size={16} className="text-indigo-600"/> Nhận xét, đánh giá tiến độ thông minh (AI)
                                </h4>
                                <button 
                                    onClick={handleGenerateReview} 
                                    disabled={isGenerating}
                                    className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center gap-1 disabled:opacity-50 transition-all shadow-sm active:scale-95"
                                >
                                    {isGenerating ? <Loader2 className="animate-spin" size={14}/> : <Sparkles size={14}/>} 
                                    {aiEvaluation ? 'Phân tích lại' : 'Đánh giá bằng AI'}
                                </button>
                            </div>
                            <div className="p-6 bg-white overflow-y-auto">
                                {aiEvaluation ? (
                                    <div 
                                        className="prose prose-sm max-w-none text-gray-800 font-serif leading-relaxed animate-fade-in"
                                        dangerouslySetInnerHTML={{ __html: aiEvaluation }}
                                    />
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-gray-400 opacity-60 py-8">
                                        <div className="bg-indigo-50 p-3 rounded-full mb-2">
                                            <Sparkles size={24} className="text-indigo-400"/>
                                        </div>
                                        <p className="text-center text-xs font-semibold">Bấm "Đánh giá bằng AI" để tự động tổng hợp số liệu hiệu quả và lập dự thảo nhận xét cho nhân viên.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                )
            )}
        </div>
    );
};

export default EmployeeStatsView;
