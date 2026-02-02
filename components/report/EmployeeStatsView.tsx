
import React, { useState, useMemo } from 'react';
import { RecordFile, Employee, RecordStatus } from '../../types';
import { isRecordOverdue, isRecordApproaching } from '../../utils/appHelpers';
import { generateEmployeeEvaluation } from '../../services/geminiService';
import { User as UserIcon, AlertOctagon, Sparkles, Loader2, ListFilter, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

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

    // Calculate Stats
    const stats = useMemo(() => {
        const targetRecords = selectedEmpId 
            ? recordsInTimeRange.filter(r => r.assignedTo === selectedEmpId)
            : recordsInTimeRange;

        const total = targetRecords.length;
        
        let completedCount = 0;
        let processingCount = 0;
        let overduePendingCount = 0;
        let overdueCompletedCount = 0;
        
        const overdueRecords: { record: RecordFile, daysOver: number }[] = [];

        targetRecords.forEach(r => {
            // Xác định đã xong hay chưa (bao gồm đã xuất hồ sơ hoặc trạng thái cuối)
            const isFinished = [
                RecordStatus.HANDOVER, 
                RecordStatus.RETURNED, 
                RecordStatus.WITHDRAWN, 
                RecordStatus.SIGNED
            ].includes(r.status) || !!r.exportBatch || !!r.exportDate;

            if (isFinished) {
                completedCount++;
                // Kiểm tra trễ hạn cho hồ sơ đã xong
                if (r.deadline && r.completedDate) {
                    const d = new Date(r.deadline); d.setHours(0,0,0,0);
                    const c = new Date(r.completedDate); c.setHours(0,0,0,0);
                    if (c > d) {
                        overdueCompletedCount++;
                    }
                }
            } else {
                processingCount++;
                // Kiểm tra trễ hạn cho hồ sơ chưa xong
                if (r.deadline) {
                    const d = new Date(r.deadline); d.setHours(0,0,0,0);
                    const today = new Date(); today.setHours(0,0,0,0);
                    if (today > d) {
                        overduePendingCount++;
                        
                        // Tính số ngày trễ để hiển thị chi tiết
                        const diffTime = today.getTime() - d.getTime();
                        const daysOver = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        overdueRecords.push({ record: r, daysOver });
                    }
                }
            }
        });

        // Tìm hồ sơ trễ lâu nhất (trong danh sách chưa xong)
        overdueRecords.sort((a, b) => b.daysOver - a.daysOver);
        const longestOverdue = overdueRecords.length > 0 ? overdueRecords[0] : null;
        
        // Lọc hồ sơ trễ quá lâu (> 10 ngày)
        const longOverdueList = overdueRecords.filter(item => item.daysOver > 10);

        return {
            total,
            completedCount,
            processingCount,
            overduePendingCount,
            overdueCompletedCount,
            longestOverdue,
            longOverdueList,
            totalOverdue: overduePendingCount + overdueCompletedCount
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

        // Chuẩn bị dữ liệu cho AI
        const aiStats = {
            total: stats.total,
            onTime: stats.completedCount - stats.overdueCompletedCount,
            approaching: 0, // Không tính trong view này
            overdue: stats.overduePendingCount,
            onTimeRate: stats.total > 0 ? (((stats.completedCount - stats.overdueCompletedCount) / stats.total) * 100).toFixed(1) : 0
        };

        const result = await generateEmployeeEvaluation(
            empName,
            aiStats,
            badRecordsSimple,
            `Từ ${new Date(fromDate).toLocaleDateString('vi-VN')} đến ${new Date(toDate).toLocaleDateString('vi-VN')}`
        );
        
        setAiEvaluation(result);
        setIsGenerating(false);
    };

    return (
        <div className="flex flex-col h-full bg-slate-100 p-4 overflow-y-auto">
            
            {/* 1. EMPLOYEE SELECTOR */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex items-center gap-4 sticky top-0 z-10">
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

            {/* 2. STATS CARDS GRID - UPDATED UI */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in mb-6">
                    {/* BLUE CARD: TOTAL */}
                    <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
                        <div className="bg-blue-200 p-3 rounded-xl text-blue-600">
                            <ListFilter size={24}/>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-blue-800 leading-none mb-1">{stats.total}</div>
                            <div className="text-xs text-blue-600 font-bold uppercase tracking-wider">Tổng Hồ Sơ</div>
                        </div>
                    </div>

                    {/* GREEN CARD: COMPLETED */}
                    <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
                        <div className="bg-emerald-200 p-3 rounded-xl text-emerald-600">
                            <CheckCircle2 size={24}/>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-emerald-800 leading-none mb-1">{stats.completedCount}</div>
                            <div className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Đã Xong</div>
                        </div>
                    </div>

                    {/* ORANGE CARD: PROCESSING */}
                    <div className="bg-orange-50/50 border border-orange-100 p-4 rounded-xl flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
                        <div className="bg-orange-200 p-3 rounded-xl text-orange-600">
                            <Clock size={24}/>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-orange-800 leading-none mb-1">{stats.processingCount}</div>
                            <div className="text-xs text-orange-600 font-bold uppercase tracking-wider">Đang Xử Lý</div>
                        </div>
                    </div>

                    {/* RED CARD: OVERDUE (SPLIT) */}
                    <div className="bg-red-50/50 border border-red-100 p-4 rounded-xl flex items-center gap-3 shadow-sm hover:shadow-md transition-all">
                        <div className="bg-white p-2.5 rounded-lg text-red-500 shadow-sm border border-red-100">
                            <AlertTriangle size={24}/>
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between items-center text-red-700 font-bold text-sm mb-1">
                                <span>Chưa xong:</span>
                                <span className="text-lg">{stats.overduePendingCount}</span>
                            </div>
                            <div className="w-full h-px bg-red-200 mb-1.5"></div>
                            <div className="flex justify-between items-center text-red-400 text-xs font-medium">
                                <span>Đã xong (Trễ):</span>
                                <span>{stats.overdueCompletedCount}</span>
                            </div>
                            <div className="text-[9px] text-red-500 uppercase font-black text-right mt-1 tracking-widest opacity-60">Tổng Trễ Hạn</div>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. DETAILED ANALYSIS */}
            {selectedEmpId ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up flex-1 min-h-0">
                    {/* PROBLEM RECORDS */}
                    <div className="space-y-4 flex flex-col h-full overflow-hidden">
                        {/* Longest Overdue */}
                        <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm relative overflow-hidden shrink-0">
                            <div className="absolute top-0 right-0 p-4 opacity-5"><AlertOctagon size={100} className="text-red-500" /></div>
                            <h4 className="font-bold text-red-700 flex items-center gap-2 mb-3 uppercase text-sm">
                                <AlertOctagon size={18}/> Hồ sơ tồn đọng lâu nhất
                            </h4>
                            {stats.longestOverdue ? (
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="text-2xl font-black text-red-800">{stats.longestOverdue.record.code}</div>
                                        <div className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">
                                            Trễ {stats.longestOverdue.daysOver} ngày
                                        </div>
                                    </div>
                                    <div className="text-gray-700 font-medium">{stats.longestOverdue.record.customerName}</div>
                                    <div className="mt-2 text-xs text-gray-500">
                                        Ngày nhận: {new Date(stats.longestOverdue.record.receivedDate!).toLocaleDateString('vi-VN')} • 
                                        Hẹn trả: <span className="text-red-600 font-bold">{new Date(stats.longestOverdue.record.deadline!).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 text-green-600 py-2">
                                    <CheckCircle2 size={32} />
                                    <span className="font-medium">Tuyệt vời! Không có hồ sơ nào đang trễ hạn.</span>
                                </div>
                            )}
                        </div>

                        {/* List of Long Overdue */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                            <div className="p-4 bg-gray-50 border-b border-gray-200 shrink-0">
                                <h4 className="font-bold text-gray-700 text-sm uppercase flex items-center gap-2">
                                    <ListFilter size={16} /> Danh sách trễ hạn nguy cấp ({'>'}10 ngày)
                                </h4>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {stats.longOverdueList.length > 0 ? (
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-white text-gray-500 font-medium text-xs uppercase sticky top-0 shadow-sm">
                                            <tr>
                                                <th className="p-3 bg-gray-50">Mã HS</th>
                                                <th className="p-3 bg-gray-50">Khách hàng</th>
                                                <th className="p-3 bg-gray-50 text-center">Số ngày</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {stats.longOverdueList.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-red-50 transition-colors">
                                                    <td className="p-3 font-medium text-blue-600">{item.record.code}</td>
                                                    <td className="p-3 text-gray-700">{item.record.customerName}</td>
                                                    <td className="p-3 text-center font-bold text-red-600 bg-red-50/50">{item.daysOver}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm italic p-6">
                                        <CheckCircle2 size={40} className="mb-2 text-green-200" />
                                        <p>Không có hồ sơ nào trễ quá 10 ngày.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* AI ANALYSIS */}
                    <div className="flex flex-col bg-white rounded-xl border border-purple-200 shadow-sm h-full overflow-hidden">
                        <div className="p-4 bg-purple-50 border-b border-purple-100 flex justify-between items-center shrink-0">
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
                        <div className="p-6 flex-1 bg-gradient-to-b from-purple-50/30 to-white overflow-y-auto custom-scrollbar">
                            {aiEvaluation ? (
                                <div 
                                    className="prose prose-sm max-w-none text-gray-800 font-serif leading-relaxed animate-fade-in"
                                    dangerouslySetInnerHTML={{ __html: aiEvaluation }}
                                />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60 min-h-[200px]">
                                    <Sparkles size={48} className="mb-3 text-purple-200"/>
                                    <p className="text-center text-sm font-medium">Bấm "Phân tích ngay" để AI tổng hợp số liệu<br/>và đánh giá hiệu quả làm việc.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border border-dashed border-slate-300 text-gray-400 m-4">
                    <UserIcon size={48} className="mb-3 opacity-20"/>
                    <p className="text-sm font-medium">Vui lòng chọn một nhân viên cụ thể ở trên để xem chi tiết.</p>
                </div>
            )}
        </div>
    );
};

export default EmployeeStatsView;
