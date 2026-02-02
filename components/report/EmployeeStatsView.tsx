
import React, { useState, useMemo } from 'react';
import { RecordFile, Employee, RecordStatus } from '../../types';
import { isRecordOverdue, isRecordApproaching } from '../../utils/appHelpers';
import { generateEmployeeEvaluation } from '../../services/geminiService';
import { User as UserIcon, AlertOctagon, Sparkles, Loader2, ListFilter, CheckCircle2, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

interface EmployeeStatsViewProps {
    records: RecordFile[];
    employees: Employee[];
    fromDate: string;
    toDate: string;
    selectedEmpId: string;
    setSelectedEmpId: (id: string) => void;
}

const EmployeeStatsView: React.FC<EmployeeStatsViewProps> = ({ 
    records, employees, fromDate, toDate, selectedEmpId, setSelectedEmpId 
}) => {
    const [aiEvaluation, setAiEvaluation] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Filter records by date range first
    const recordsInTimeRange = useMemo(() => {
        const start = new Date(fromDate); start.setHours(0,0,0,0);
        const end = new Date(toDate); end.setHours(23,59,59,999);
        return records.filter(r => {
            if (!r.receivedDate) return false;
            const rDate = new Date(r.receivedDate);
            return rDate >= start && rDate <= end;
        });
    }, [records, fromDate, toDate]);

    // Calculate Stats for Details & AI only (Rendering cards handled by parent)
    const stats = useMemo(() => {
        const targetRecords = selectedEmpId 
            ? recordsInTimeRange.filter(r => r.assignedTo === selectedEmpId)
            : recordsInTimeRange;

        const total = targetRecords.length;
        
        let onTime = 0;
        let overdue = 0;
        let approaching = 0;
        
        const overdueRecords: { record: RecordFile, daysOver: number }[] = [];

        targetRecords.forEach(r => {
            // Check overdue details for AI
            if (isRecordOverdue(r)) {
                overdue++;
                if (r.deadline) {
                    const d = new Date(r.deadline); d.setHours(0,0,0,0);
                    const today = new Date(); today.setHours(0,0,0,0);
                    const diffTime = today.getTime() - d.getTime();
                    const daysOver = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    overdueRecords.push({ record: r, daysOver });
                }
            } else if (isRecordApproaching(r)) {
                approaching++;
            } else {
                // Check if completed late
                if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.WITHDRAWN || r.status === RecordStatus.SIGNED) {
                    if (r.deadline && r.completedDate) {
                        const d = new Date(r.deadline); d.setHours(0,0,0,0);
                        const c = new Date(r.completedDate); c.setHours(0,0,0,0);
                        if (c > d) overdue++; else onTime++;
                    } else {
                        onTime++;
                    }
                } else {
                    onTime++;
                }
            }
        });

        // Tìm hồ sơ trễ lâu nhất
        overdueRecords.sort((a, b) => b.daysOver - a.daysOver);
        const longestOverdue = overdueRecords.length > 0 ? overdueRecords[0] : null;
        
        // Lọc hồ sơ trễ quá lâu (> 10 ngày)
        const longOverdueList = overdueRecords.filter(item => item.daysOver > 10);

        return {
            total,
            onTime,
            overdue,
            approaching,
            onTimeRate: total > 0 ? ((onTime / total) * 100).toFixed(1) : '0',
            longestOverdue,
            longOverdueList
        };
    }, [recordsInTimeRange, selectedEmpId]);

    const handleGenerateReview = async () => {
        if (!stats || !selectedEmpId) return;
        setIsGenerating(true);
        const emp = employees.find(e => e.id === selectedEmpId);
        const empName = emp ? emp.name : "Nhân viên";
        
        const badRecordsSimple = stats.longOverdueList.map(i => ({
            code: i.record.code,
            customer: i.record.customerName,
            daysOverdue: i.daysOver
        }));

        const result = await generateEmployeeEvaluation(
            empName,
            stats,
            badRecordsSimple,
            `Từ ${new Date(fromDate).toLocaleDateString('vi-VN')} đến ${new Date(toDate).toLocaleDateString('vi-VN')}`
        );
        
        setAiEvaluation(result);
        setIsGenerating(false);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 p-4 overflow-y-auto">
            
            {/* 1. EMPLOYEE SELECTOR (Sticky) */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4 flex items-center gap-4 sticky top-0 z-10">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <UserIcon size={24} />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        {selectedEmpId ? 'Đang xem dữ liệu của:' : 'Chọn nhân viên để xem chi tiết & đánh giá:'}
                    </label>
                    <div className="relative">
                        <select 
                            className="w-full md:w-1/2 p-2.5 border border-gray-300 rounded-lg font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
                            value={selectedEmpId}
                            onChange={(e) => { setSelectedEmpId(e.target.value); setAiEvaluation(''); }}
                        >
                            <option value="">-- Tất cả nhân viên (Tổng hợp) --</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name} - {emp.department}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* 2. STATS CARDS GRID (Thêm vào đây để đồng bộ kích thước với tab khác) */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in mb-6">
                    <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center gap-3">
                        <div className="bg-blue-200 p-2 rounded-lg text-blue-700"><ListFilter size={20}/></div>
                        <div>
                            <div className="text-2xl font-bold text-blue-800">{stats.total}</div>
                            <div className="text-xs text-blue-600 uppercase font-bold">Tổng hồ sơ (NV)</div>
                        </div>
                    </div>
                    <div className="bg-green-50 border border-green-100 p-3 rounded-xl flex items-center gap-3">
                        <div className="bg-green-200 p-2 rounded-lg text-green-700"><CheckCircle2 size={20}/></div>
                        <div>
                            <div className="text-2xl font-bold text-green-800">{stats.onTime}</div>
                            <div className="text-xs text-green-600 uppercase font-bold">Đúng hạn ({stats.onTimeRate}%)</div>
                        </div>
                    </div>
                    <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl flex items-center gap-3">
                        <div className="bg-orange-200 p-2 rounded-lg text-orange-700"><Clock size={20}/></div>
                        <div>
                            <div className="text-2xl font-bold text-orange-800">{stats.approaching}</div>
                            <div className="text-xs text-orange-600 uppercase font-bold">Sắp tới hạn</div>
                        </div>
                    </div>
                    {/* Thẻ trễ hạn (Được đơn giản hóa để khớp kích thước) */}
                    <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-3">
                        <div className="bg-red-200 p-2 rounded-lg text-red-700"><AlertTriangle size={20}/></div>
                        <div>
                            <div className="text-2xl font-bold text-red-800">{stats.overdue}</div>
                            <div className="text-xs text-red-600 uppercase font-bold">Tổng Trễ hạn</div>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. DETAILED ANALYSIS (CHỈ HIỆN KHI ĐÃ CHỌN NHÂN VIÊN) */}
            {selectedEmpId ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up">
                    {/* PROBLEM RECORDS */}
                    <div className="space-y-4">
                        {/* Longest Overdue */}
                        <div className="bg-red-100 p-5 rounded-xl border border-red-200 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10"><AlertOctagon size={100} /></div>
                            <h4 className="font-bold text-red-800 flex items-center gap-2 mb-3">
                                <AlertOctagon size={20}/> Hồ sơ trễ hạn lâu nhất
                            </h4>
                            {stats.longestOverdue ? (
                                <div>
                                    <div className="text-2xl font-bold text-red-900 mb-1">{stats.longestOverdue.record.code}</div>
                                    <div className="text-red-800 font-medium">{stats.longestOverdue.record.customerName}</div>
                                    <div className="mt-3 inline-flex items-center gap-2 bg-red-200 text-red-800 px-3 py-1 rounded-lg text-sm font-bold">
                                        <Loader2 size={16} className="hidden"/> {/* Dummy to keep import valid */}
                                        Trễ {stats.longestOverdue.daysOver} ngày
                                    </div>
                                    <div className="mt-2 text-sm text-red-700 italic">
                                        Hẹn: {new Date(stats.longestOverdue.record.deadline!).toLocaleDateString('vi-VN')}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-red-600 italic">Không có hồ sơ nào đang trễ hạn.</p>
                            )}
                        </div>

                        {/* List of Long Overdue */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="p-4 bg-gray-50 border-b border-gray-200">
                                <h4 className="font-bold text-gray-700 text-sm uppercase">Danh sách trễ hạn quá lâu ({'>'}10 ngày)</h4>
                            </div>
                            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                {stats.longOverdueList.length > 0 ? (
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-medium text-xs uppercase sticky top-0">
                                            <tr>
                                                <th className="p-3">Mã HS</th>
                                                <th className="p-3">Khách hàng</th>
                                                <th className="p-3 text-center">Số ngày</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {stats.longOverdueList.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-red-50">
                                                    <td className="p-3 font-medium text-blue-600">{item.record.code}</td>
                                                    <td className="p-3 text-gray-700">{item.record.customerName}</td>
                                                    <td className="p-3 text-center font-bold text-red-600">{item.daysOver}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-6 text-center text-gray-400 text-sm italic">
                                        Tốt! Không có hồ sơ nào trễ quá 10 ngày.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* AI ANALYSIS */}
                    <div className="flex flex-col bg-white rounded-xl border border-purple-200 shadow-sm h-full">
                        <div className="p-4 bg-purple-50 border-b border-purple-100 flex justify-between items-center rounded-t-xl">
                            <h4 className="font-bold text-purple-800 flex items-center gap-2">
                                <Sparkles size={18}/> Đánh giá hiệu quả (AI)
                            </h4>
                            <button 
                                onClick={handleGenerateReview} 
                                disabled={isGenerating}
                                className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-purple-700 flex items-center gap-1 disabled:opacity-50 transition-all shadow-sm"
                            >
                                {isGenerating ? <Loader2 className="animate-spin" size={14}/> : <Sparkles size={14}/>} 
                                {aiEvaluation ? 'Phân tích lại' : 'Phân tích ngay'}
                            </button>
                        </div>
                        <div className="p-6 flex-1 bg-purple-50/10">
                            {aiEvaluation ? (
                                <div 
                                    className="prose prose-sm max-w-none text-gray-700 font-serif leading-relaxed animate-fade-in"
                                    dangerouslySetInnerHTML={{ __html: aiEvaluation }}
                                />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60 min-h-[200px]">
                                    <Sparkles size={48} className="mb-3 text-purple-200"/>
                                    <p className="text-center text-sm">Bấm "Phân tích ngay" để AI đánh giá<br/>hiệu quả làm việc của nhân viên này.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-48 bg-slate-100 rounded-xl border border-dashed border-slate-300 text-gray-400">
                    <UserIcon size={32} className="mb-2 opacity-50"/>
                    <p className="text-sm font-medium">Chọn một nhân viên cụ thể để xem chi tiết các hồ sơ trễ hạn và sử dụng AI đánh giá.</p>
                </div>
            )}
        </div>
    );
};

export default EmployeeStatsView;
