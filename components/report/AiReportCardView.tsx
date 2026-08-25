import React, { useState, useRef, useMemo } from 'react';
import { RecordFile, RecordStatus } from '../../types';
import { getNormalizedWard, getShortRecordType } from '../../constants';
import { 
    Sparkles, FileText, CheckCircle2, Clock, AlertTriangle, FileCheck2, 
    History, MapPin, FolderArchive, Printer, Settings, Loader2, Camera, 
    Check, LayoutGrid, FileCode, TrendingUp, Award, Layers, BarChart3,
    AlertCircle, ChevronRight, PieChart, ShieldAlert, CalendarDays, Layout
} from 'lucide-react';

interface AiReportCardViewProps {
    reportContent: string;
    isGenerating: boolean;
    onGenerate: (fromDate?: string, toDate?: string, reportType?: string, records?: RecordFile[]) => void;
    onPrint: () => void;
    onOpenKeyModal: () => void;
    records: RecordFile[];
    reportType?: 'week' | 'month' | 'custom';
    fromDate?: string;
    toDate?: string;
    timeLabel?: string;
}

export const AiReportCardView: React.FC<AiReportCardViewProps> = ({
    reportContent,
    isGenerating,
    onGenerate,
    onPrint,
    onOpenKeyModal,
    records,
    reportType: initialReportType = 'month',
    fromDate: initialFromDate,
    toDate: initialToDate,
    timeLabel
}) => {
    // Mode toggle: 'cards' = Card Dashboard layout; 'a4' = Classic A4 Print document
    const [viewMode, setViewMode] = useState<'cards' | 'a4'>('cards');

    // Screenshot state
    const [isCapturing, setIsCapturing] = useState(false);
    const [captureSuccess, setCaptureSuccess] = useState(false);
    const reportCardRef = useRef<HTMLDivElement>(null);

    // Independent Date Filter
    const [localReportType, setLocalReportType] = useState<'week' | 'month' | 'all' | 'custom'>(initialReportType);
    const [localFromDate, setLocalFromDate] = useState<string>(() => {
        if (initialFromDate) return initialFromDate;
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    });
    const [localToDate, setLocalToDate] = useState<string>(() => {
        if (initialToDate) return initialToDate;
        return new Date().toISOString().split('T')[0];
    });

    const handleQuickDate = (mode: 'week' | 'month' | 'all') => {
        setLocalReportType(mode);
        const now = new Date();
        if (mode === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            const start = new Date(now.setDate(diff));
            setLocalFromDate(start.toISOString().split('T')[0]);
            setLocalToDate(new Date().toISOString().split('T')[0]);
        } else if (mode === 'month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            setLocalFromDate(start.toISOString().split('T')[0]);
            setLocalToDate(new Date().toISOString().split('T')[0]);
        }
    };

    const filteredRecords = useMemo(() => {
        if (localReportType === 'all') return records;
        const start = new Date(localFromDate); start.setHours(0, 0, 0, 0);
        const end = new Date(localToDate); end.setHours(23, 59, 59, 999);
        return records.filter(r => {
            if (!r.receivedDate) return false;
            const rDate = new Date(r.receivedDate);
            return rDate >= start && rDate <= end;
        });
    }, [records, localReportType, localFromDate, localToDate]);

    // Tính toán số liệu tổng quan chi tiết từ danh sách hồ sơ
    const stats = useMemo(() => {
        const total = filteredRecords.length;
        let done = 0;
        let processing = 0;
        let pendingSign = 0;
        let overduePending = 0;
        let overdueCompleted = 0;
        let withdrawn = 0;

        const wardStats: Record<string, { total: number; done: number; pending: number; overdue: number }> = {};
        const typeStats: Record<string, number> = {};
        const wardTypeDetails: Record<string, Record<string, number>> = {};
        const overdueRecordsList: RecordFile[] = [];

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        filteredRecords.forEach(r => {
            const isCompleted = r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED;
            
            if (isCompleted) done++;
            else if (r.status === RecordStatus.PENDING_SIGN) pendingSign++;
            else if (r.status === RecordStatus.WITHDRAWN) withdrawn++;
            else processing++;

            let isOverdue = false;
            if (r.deadline) {
                const deadlineDate = new Date(r.deadline);
                deadlineDate.setHours(0, 0, 0, 0);

                if (isCompleted) {
                    if (r.completedDate) {
                        const finishedDate = new Date(r.completedDate);
                        finishedDate.setHours(0, 0, 0, 0);
                        if (finishedDate > deadlineDate) overdueCompleted++;
                    }
                } else if (r.status !== RecordStatus.WITHDRAWN) {
                    if (today > deadlineDate) {
                        overduePending++;
                        isOverdue = true;
                        overdueRecordsList.push(r);
                    }
                }
            }

            // Loại hồ sơ
            const typeName = getShortRecordType(r.recordType) || 'Khác';
            typeStats[typeName] = (typeStats[typeName] || 0) + 1;

            // Xã phường
            const wardName = getNormalizedWard(r.ward) || 'Khác';
            if (!wardStats[wardName]) {
                wardStats[wardName] = { total: 0, done: 0, pending: 0, overdue: 0 };
            }
            wardStats[wardName].total++;
            if (isCompleted) wardStats[wardName].done++;
            else wardStats[wardName].pending++;
            if (isOverdue) wardStats[wardName].overdue++;

            // Chi tiết loại hồ sơ theo từng xã
            if (!wardTypeDetails[wardName]) {
                wardTypeDetails[wardName] = {};
            }
            wardTypeDetails[wardName][typeName] = (wardTypeDetails[wardName][typeName] || 0) + 1;
        });

        const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
        const onTimeRate = total > 0 ? Math.round(((total - overduePending - overdueCompleted) / total) * 100) : 100;

        return {
            total,
            done,
            processing,
            pendingSign,
            overduePending,
            overdueCompleted,
            withdrawn,
            completionRate,
            onTimeRate,
            wardStats,
            typeStats,
            wardTypeDetails,
            overdueRecordsList
        };
    }, [filteredRecords]);

    // Trích xuất các đoạn nhận xét từ HTML Gemini nếu có
    const extractedSections = useMemo(() => {
        if (!reportContent) return null;

        // Clean HTML tags to text for key takeaways
        const parser = new DOMParser();
        const doc = parser.parseFromString(reportContent, 'text/html');

        // Tìm các thẻ paragraph hoặc list items trong báo cáo
        const paragraphs = Array.from(doc.querySelectorAll('p, li, td'))
            .map(el => el.textContent?.trim() || '')
            .filter(t => t.length > 10);

        return {
            fullText: doc.body.textContent || '',
            paragraphs
        };
    }, [reportContent]);

    // Xử lý chụp ảnh thẻ báo cáo
    const handleCaptureScreenshot = async () => {
        if (!reportCardRef.current) return;
        setIsCapturing(true);
        try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(reportCardRef.current, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#f8fafc'
            });

            const fileName = `Bao_Cao_The_${localReportType}_${localFromDate}_den_${localToDate}.png`;
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = fileName;
            link.href = dataUrl;
            link.click();

            setCaptureSuccess(true);
            setTimeout(() => setCaptureSuccess(false), 3000);
        } catch (err) {
            console.error('Lỗi khi chụp hình báo cáo:', err);
            alert('Có lỗi khi tạo ảnh chụp báo cáo.');
        } finally {
            setIsCapturing(false);
        }
    };

    return (
        <div className="w-full flex flex-col items-center p-3 md:p-5 gap-4">
            {/* TOOLBAR BÁO CÁO */}
            <div className="w-full bg-white p-3.5 md:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 shrink-0">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                            <span className="font-extrabold text-base text-slate-800 tracking-tight">
                                Báo Cáo Tiến Độ Đo Đạc
                            </span>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                                {localReportType === 'week' ? 'Báo cáo Tuần' : localReportType === 'month' ? 'Báo cáo Tháng' : localReportType === 'all' ? 'Tất cả' : 'Tùy chỉnh'}
                            </span>
                        </div>
                        <div className="text-xs text-slate-500 font-medium">
                            {localReportType === 'all' ? (
                                <span>Toàn bộ dữ liệu ({filteredRecords.length} hồ sơ)</span>
                            ) : (
                                <span>Từ <strong className="text-slate-700">{localFromDate}</strong> đến <strong className="text-slate-700">{localToDate}</strong> ({filteredRecords.length} hồ sơ)</span>
                            )}
                        </div>
                    </div>

                    {/* Quick Date Filters */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button 
                            onClick={() => handleQuickDate('week')} 
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${localReportType === 'week' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-indigo-700'}`}
                        >
                            <CalendarDays size={13} /> Tuần này
                        </button>
                        <button 
                            onClick={() => handleQuickDate('month')} 
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${localReportType === 'month' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-indigo-700'}`}
                        >
                            <Layout size={13} /> Tháng này
                        </button>
                        <button 
                            onClick={() => handleQuickDate('all')} 
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${localReportType === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-indigo-700'}`}
                        >
                            Tất cả
                        </button>
                    </div>

                    {/* Custom Date Input */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
                        <span className="text-slate-400 font-medium">Từ:</span>
                        <input 
                            type="date" 
                            value={localFromDate} 
                            disabled={localReportType === 'all'}
                            onChange={(e) => { setLocalFromDate(e.target.value); setLocalReportType('custom'); }} 
                            className="text-xs outline-none bg-transparent text-slate-700 font-medium disabled:opacity-50" 
                        />
                        <span className="text-slate-400 font-medium">Đến:</span>
                        <input 
                            type="date" 
                            value={localToDate} 
                            disabled={localReportType === 'all'}
                            onChange={(e) => { setLocalToDate(e.target.value); setLocalReportType('custom'); }} 
                            className="text-xs outline-none bg-transparent text-slate-700 font-medium disabled:opacity-50" 
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-end">
                    {/* View Switcher Toggle */}
                    <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200 text-xs font-bold">
                        <button
                            onClick={() => setViewMode('cards')}
                            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                                viewMode === 'cards' 
                                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200' 
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <LayoutGrid size={14} /> Thẻ trực quan
                        </button>
                        <button
                            onClick={() => setViewMode('a4')}
                            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                                viewMode === 'a4' 
                                    ? 'bg-white text-indigo-700 shadow-xs border border-slate-200' 
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <FileCode size={14} /> Mẫu in A4
                        </button>
                    </div>

                    <button 
                        onClick={onOpenKeyModal} 
                        className="flex items-center gap-1.5 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 px-3 py-2 rounded-xl font-semibold text-xs transition-all shadow-xs" 
                        title="Cấu hình API Key Gemini"
                    >
                        <Settings size={14} /> AI Key
                    </button>

                    <button 
                        onClick={() => onGenerate(localFromDate, localToDate, localReportType, filteredRecords)} 
                        disabled={isGenerating} 
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md shadow-purple-500/20 hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50 active:scale-95"
                    >
                        {isGenerating ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                        Tạo báo cáo AI
                    </button>

                    {viewMode === 'cards' && (
                        <button
                            type="button"
                            onClick={handleCaptureScreenshot}
                            disabled={isCapturing}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 shadow-xs ${
                                captureSuccess 
                                    ? 'bg-emerald-600 text-white' 
                                    : 'bg-slate-800 hover:bg-slate-900 text-white'
                            }`}
                            title="Chụp ảnh toàn bộ báo cáo dạng thẻ"
                        >
                            {isCapturing ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : captureSuccess ? (
                                <Check size={14} />
                            ) : (
                                <Camera size={14} />
                            )}
                            <span>{captureSuccess ? 'Đã lưu ảnh' : 'Chụp hình'}</span>
                        </button>
                    )}

                    <button 
                        onClick={onPrint} 
                        className="flex items-center gap-1.5 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 px-3.5 py-2 rounded-xl font-semibold text-xs shadow-xs"
                    >
                        <Printer size={14} /> In
                    </button>
                </div>
            </div>

            {/* NỘI DUNG CHÍNH (MODE 1: CARDS DASHBOARD, MODE 2: A4 DOCUMENT) */}
            {viewMode === 'cards' ? (
                <div ref={reportCardRef} className="w-full flex flex-col gap-5 p-2 bg-slate-50 rounded-2xl">
                    
                    {/* 1. THẺ CHỈ SỐ TỔNG QUAN (METRIC STAT CARDS GRID) */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                        {/* Thẻ Total */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-all border-t-4 border-t-blue-500">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Hồ Sơ</span>
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                    <FileText size={18} />
                                </div>
                            </div>
                            <div>
                                <span className="text-2xl font-black text-slate-900">{stats.total}</span>
                                <span className="text-[11px] text-slate-400 block mt-0.5">Hồ sơ trong kỳ</span>
                            </div>
                        </div>

                        {/* Thẻ Đã Xong */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-all border-t-4 border-t-emerald-500">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Đã Hoàn Thành</span>
                                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                                    <CheckCircle2 size={18} />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-2xl font-black text-emerald-700">{stats.done}</span>
                                    <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                        {stats.completionRate}%
                                    </span>
                                </div>
                                <span className="text-[11px] text-slate-400 block mt-0.5">Đã giao kết quả</span>
                            </div>
                        </div>

                        {/* Thẻ Đang Xử Lý */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-all border-t-4 border-t-amber-500">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Đang Xử Lý</span>
                                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                                    <Clock size={18} />
                                </div>
                            </div>
                            <div>
                                <span className="text-2xl font-black text-amber-700">{stats.processing}</span>
                                <span className="text-[11px] text-slate-400 block mt-0.5">Đo đạc & Biên vẽ</span>
                            </div>
                        </div>

                        {/* Thẻ Trình Ký */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-all border-t-4 border-t-purple-500">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Trình Ký</span>
                                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                                    <FileCheck2 size={18} />
                                </div>
                            </div>
                            <div>
                                <span className="text-2xl font-black text-purple-700">{stats.pendingSign}</span>
                                <span className="text-[11px] text-slate-400 block mt-0.5">Chờ lãnh đạo ký</span>
                            </div>
                        </div>

                        {/* Thẻ Trễ Hạn Chưa Xong */}
                        <div className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between hover:shadow-md transition-all border-t-4 border-t-red-500 ${
                            stats.overduePending > 0 ? 'bg-red-50/40 border-red-200' : 'bg-white border-slate-200'
                        }`}>
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-red-700 uppercase tracking-wider">Trễ Chưa Xong</span>
                                <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                                    <AlertTriangle size={18} />
                                </div>
                            </div>
                            <div>
                                <span className="text-2xl font-black text-red-600">{stats.overduePending}</span>
                                <span className="text-[11px] text-red-500 font-medium block mt-0.5">Tồn đọng trễ hẹn</span>
                            </div>
                        </div>

                        {/* Thẻ Trễ Hạn Đã Xong */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-all border-t-4 border-t-orange-400">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Trễ Đã Xong</span>
                                <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                                    <History size={18} />
                                </div>
                            </div>
                            <div>
                                <span className="text-2xl font-black text-orange-600">{stats.overdueCompleted}</span>
                                <span className="text-[11px] text-slate-400 block mt-0.5">Xong nhưng trễ hẹn</span>
                            </div>
                        </div>
                    </div>

                    {/* 2. THẺ NHẬN XÉT ĐÁNH GIÁ TỰ ĐỘNG TỪ GEMINI AI */}
                    <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-5 md:p-6 text-white shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="flex items-center justify-between mb-4 relative z-10 border-b border-indigo-700/60 pb-3.5">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-2xl shadow-lg shadow-purple-500/30">
                                    <Sparkles size={22} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-base md:text-lg tracking-tight text-white flex items-center gap-2">
                                        Nhận Xét & Đánh Giá Tự Động Từ Gemini AI
                                    </h3>
                                    <p className="text-xs text-indigo-200">
                                        Phân tích tiến độ tự động dựa trên số liệu thực tế trong kỳ
                                    </p>
                                </div>
                            </div>
                            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold bg-indigo-950/80 border border-indigo-500/30 text-indigo-200 px-3 py-1 rounded-full">
                                <Award size={13} className="text-amber-400" /> Powered by Gemini
                            </span>
                        </div>

                        {/* Content Card AI */}
                        <div className="relative z-10 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 md:p-5 text-indigo-50 leading-relaxed text-sm">
                            {reportContent ? (
                                <div className="prose prose-invert max-w-none space-y-3 font-sans">
                                    <div 
                                        className="text-slate-100 text-sm leading-relaxed"
                                        dangerouslySetInnerHTML={{ __html: reportContent }} 
                                    />
                                </div>
                            ) : (
                                <div className="py-8 flex flex-col items-center justify-center text-center text-indigo-200">
                                    <Sparkles size={40} className="mb-2 text-indigo-300 opacity-60 animate-pulse" />
                                    <p className="font-semibold text-sm">Chưa có nội dung đánh giá từ AI.</p>
                                    <p className="text-xs text-indigo-300 max-w-md mt-1">
                                        Bấm vào nút <strong>"Tạo báo cáo AI"</strong> phía trên để nhận đánh giá tiến độ chi tiết.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3. GRID BÁO CÁO THEO ĐỊA BÀN (WARD CARDS GRID) */}
                    <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col gap-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                <MapPin size={20} className="text-indigo-600" /> Báo Cáo Thẻ Theo Địa Bàn Xã/Phường
                            </h3>
                            <span className="text-xs font-semibold text-slate-500">
                                Tổng cộng: <strong>{Object.keys(stats.wardStats).length}</strong> địa bàn
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                            {Object.entries(stats.wardStats)
                                .sort((a, b) => b[1].total - a[1].total)
                                .map(([wardName, data]) => {
                                    const wardCompletion = data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
                                    return (
                                        <div key={wardName} className="bg-slate-50 hover:bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between gap-3 group">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                        <MapPin size={16} />
                                                    </div>
                                                    <span className="font-bold text-slate-800 text-sm">{wardName}</span>
                                                </div>
                                                <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-slate-200 text-slate-700">
                                                    {data.total} HS
                                                </span>
                                            </div>

                                            {/* Progress Bar */}
                                            <div>
                                                <div className="flex justify-between text-xs mb-1 font-semibold">
                                                    <span className="text-slate-500">Tiến độ hoàn thành</span>
                                                    <span className={wardCompletion >= 80 ? 'text-emerald-600' : wardCompletion >= 50 ? 'text-blue-600' : 'text-amber-600'}>
                                                        {wardCompletion}%
                                                    </span>
                                                </div>
                                                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full transition-all duration-500 ${
                                                            wardCompletion >= 80 ? 'bg-emerald-500' : wardCompletion >= 50 ? 'bg-blue-500' : 'bg-amber-500'
                                                        }`}
                                                        style={{ width: `${wardCompletion}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Indicators */}
                                            <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-200/60 text-center text-xs">
                                                <div className="bg-emerald-50 p-1.5 rounded-xl border border-emerald-100">
                                                    <span className="text-[10px] text-emerald-600 font-bold block">Đã Xong</span>
                                                    <span className="font-extrabold text-emerald-800">{data.done}</span>
                                                </div>
                                                <div className="bg-amber-50 p-1.5 rounded-xl border border-amber-100">
                                                    <span className="text-[10px] text-amber-600 font-bold block">Đang Làm</span>
                                                    <span className="font-extrabold text-amber-800">{data.pending}</span>
                                                </div>
                                                <div className={`p-1.5 rounded-xl border ${data.overdue > 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                    <span className="text-[10px] font-bold block">Trễ Hạn</span>
                                                    <span className="font-extrabold">{data.overdue}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>

                    {/* 4. PHÂN LOẠI HỒ SƠ VÀ CHI TIẾT THEO XÃ (2 COLUMNS) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        
                        {/* 4A. Thẻ Thống kê Loại Hồ Sơ */}
                        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col gap-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                    <FolderArchive size={20} className="text-purple-600" /> Báo Cáo Phân Loại Hồ Sơ
                                </h3>
                                <span className="text-xs font-semibold text-slate-500">
                                    {Object.keys(stats.typeStats).length} Loại
                                </span>
                            </div>

                            <div className="flex flex-col gap-2.5">
                                {Object.entries(stats.typeStats)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([typeName, count]) => {
                                        const typePercent = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                                        return (
                                            <div key={typeName} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                    <div className="p-2 bg-purple-100 text-purple-700 rounded-xl shrink-0">
                                                        <Layers size={16} />
                                                    </div>
                                                    <div className="truncate">
                                                        <span className="font-bold text-slate-800 text-xs block truncate">{typeName}</span>
                                                        <div className="w-32 sm:w-48 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                                                            <div className="h-full bg-purple-600 rounded-full" style={{ width: `${typePercent}%` }} />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className="font-extrabold text-slate-900 text-sm block">{count} HS</span>
                                                    <span className="text-[10px] text-slate-400 font-bold">{typePercent}% tổng số</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>

                        {/* 4B. Chi tiết từng loại hồ sơ theo xã */}
                        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col gap-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                    <BarChart3 size={20} className="text-teal-600" /> Chi Tiết Loại Hồ Sơ Từng Địa Bàn
                                </h3>
                            </div>

                            <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                                {Object.entries(stats.wardTypeDetails)
                                    .sort((a, b) => {
                                        const totalA = Object.values(a[1]).reduce((sum, n) => sum + n, 0);
                                        const totalB = Object.values(b[1]).reduce((sum, n) => sum + n, 0);
                                        return totalB - totalA;
                                    })
                                    .map(([wardName, typesMap]) => (
                                        <div key={wardName} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                                    <MapPin size={14} className="text-teal-600" /> {wardName}
                                                </span>
                                                <span className="text-[11px] font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                                                    {Object.values(typesMap).reduce((a, b) => a + b, 0)} HS
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {Object.entries(typesMap).map(([tName, tCount]) => (
                                                    <span key={tName} className="inline-flex items-center gap-1 text-[11px] bg-white border border-slate-200 px-2 py-1 rounded-lg text-slate-700 shadow-2xs font-medium">
                                                        <span>{tName}:</span>
                                                        <strong className="text-indigo-700">{tCount}</strong>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>

                    </div>

                    {/* 5. CẢNH BÁO TỒN ĐỌNG TRỄ HẠN HỒ SƠ (NẾU CÓ) */}
                    {stats.overdueRecordsList.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-3xl p-5 shadow-xs flex flex-col gap-3">
                            <div className="flex items-center justify-between text-red-800 border-b border-red-200/60 pb-2.5">
                                <div className="flex items-center gap-2">
                                    <ShieldAlert size={20} className="text-red-600 animate-bounce" />
                                    <h4 className="font-extrabold text-sm uppercase tracking-wide">
                                        Danh Sách Hồ Sơ Đang Trễ Hạn Cần Ưu Tiên Xử Lý ({stats.overdueRecordsList.length})
                                    </h4>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {stats.overdueRecordsList.slice(0, 6).map(r => (
                                    <div key={r.id} className="bg-white p-3 rounded-2xl border border-red-200 shadow-2xs flex flex-col justify-between gap-1.5">
                                        <div className="flex justify-between items-start">
                                            <span className="font-extrabold text-red-700 text-xs">{r.code || 'Chưa mã'}</span>
                                            <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                                Hạn: {r.deadline}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-800 font-medium truncate">
                                            {r.customerName || 'Khách hàng'}
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                                            <span>{getNormalizedWard(r.ward)}</span>
                                            <span className="font-semibold text-slate-700">{getShortRecordType(r.recordType)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            ) : (
                /* MODE 2: CLASSIC PRINTABLE A4 DOCUMENT */
                <div className="w-full flex justify-center bg-slate-300 p-6 md:p-10 rounded-2xl shadow-inner border border-slate-300">
                    <div className="bg-white shadow-2xl p-[20mm_15mm_20mm_25mm] w-[210mm] min-h-[297mm] animate-fade-in">
                        {reportContent ? (
                            <div 
                                style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '13pt', lineHeight: '1.4' }}
                                dangerouslySetInnerHTML={{ __html: reportContent }} 
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400 py-20">
                                <FileText size={64} className="mb-4 text-slate-300" />
                                <p className="font-bold">Chưa có nội dung báo cáo dạng văn bản.</p>
                                <p className="text-xs text-slate-400">Hãy bấm "Tạo báo cáo AI" để tạo nội dung.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AiReportCardView;
