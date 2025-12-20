
import React, { useState, useRef } from 'react';
import { BarChart3, FileSpreadsheet, Loader2, Sparkles, Download, CalendarDays, Printer, Layout, FileText } from 'lucide-react';

interface ReportSectionProps {
    reportContent: string;
    isGenerating: boolean;
    onGenerate: (fromDate: string, toDate: string) => void;
    onExportExcel: (fromDate: string, toDate: string) => void;
}

const ReportSection: React.FC<ReportSectionProps> = ({ reportContent, isGenerating, onGenerate, onExportExcel }) => {
    const [fromDate, setFromDate] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    });
    const [toDate, setToDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });

    const previewRef = useRef<HTMLDivElement>(null);

    const handleQuickReport = (type: 'week' | 'month') => {
        const now = new Date();
        let start = new Date();
        if (type === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Thứ 2
            start = new Date(now.setDate(diff));
        } else {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        
        const fromStr = start.toISOString().split('T')[0];
        const toStr = new Date().toISOString().split('T')[0];
        setFromDate(fromStr);
        setToDate(toStr);
        onGenerate(fromStr, toStr);
    };

    const handleGenerateClick = () => {
        if (!fromDate || !toDate) {
            alert("Vui lòng chọn đầy đủ Từ ngày và Đến ngày.");
            return;
        }
        onGenerate(fromDate, toDate);
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
                    <title>Báo cáo A4</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        @page { size: A4 portrait; margin: 0; }
                        body { margin: 0; padding: 0; }
                        .a4-page {
                            width: 210mm;
                            height: 297mm;
                            padding: 20mm 15mm 20mm 25mm;
                            font-family: 'Times New Roman', Times, serif;
                            font-size: 12pt;
                            line-height: 1.4;
                            background: white;
                        }
                        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                        th, td { border: 1px solid black; padding: 5px; text-align: left; }
                        .no-print { display: none; }
                    </style>
                </head>
                <body>
                    <div class="a4-page">${reportContent}</div>
                </body>
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

    return (
        <div className="flex flex-col h-full gap-4 overflow-hidden">
            {/* Toolbar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="bg-blue-100 p-2 rounded-lg">
                        <BarChart3 className="text-blue-600" size={24} />
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-800 text-lg">Báo cáo Hồ sơ chuẩn A4</h2>
                        <p className="text-xs text-gray-500">Tự động phân trang & tối ưu nội dung</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => handleQuickReport('week')}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 border border-blue-200 flex items-center gap-1"
                    >
                        <CalendarDays size={14} /> Báo cáo Tuần
                    </button>
                    <button 
                        onClick={() => handleQuickReport('month')}
                        className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-100 border border-purple-200 flex items-center gap-1"
                    >
                        <Layout size={14} /> Báo cáo Tháng
                    </button>
                </div>

                <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg border border-gray-200 ml-auto">
                    <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-white" />
                    <span className="text-gray-400">→</span>
                    <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-sm bg-white" />

                    <button 
                        onClick={handleGenerateClick}
                        disabled={isGenerating}
                        className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-md hover:opacity-90 disabled:opacity-50 font-bold text-sm"
                    >
                        {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                        Tạo báo cáo AI
                    </button>

                    {reportContent && (
                        <button onClick={handlePrint} className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-3 py-2 rounded-md hover:bg-gray-50 font-medium text-sm">
                            <Printer size={16} /> In A4
                        </button>
                    )}
                </div>
            </div>

            {/* A4 Preview Container */}
            <div className="flex-1 bg-slate-200 overflow-y-auto p-10 flex flex-col items-center custom-scrollbar">
                {isGenerating && (
                    <div className="absolute inset-0 bg-slate-200/50 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                        <p className="text-lg font-bold text-blue-900">Đang tổng hợp số liệu vào 01 trang A4...</p>
                    </div>
                )}

                {reportContent ? (
                    <div className="relative shadow-2xl">
                        {/* Thước đo giả lập lề */}
                        <div className="absolute -left-8 top-0 bottom-0 w-8 flex flex-col justify-between text-[10px] text-slate-400 font-bold py-10 pointer-events-none">
                           <span>0</span><span>5</span><span>10</span><span>15</span><span>20</span><span>25</span><span>29.7cm</span>
                        </div>
                        
                        <div 
                            ref={previewRef}
                            className="bg-white p-[20mm_15mm_20mm_25mm] shadow-inner transition-all duration-500 animate-fade-in-up overflow-hidden"
                            style={{ 
                                width: '210mm', 
                                minHeight: '297mm', 
                                maxHeight: '297mm', // Cố định để ép nội dung vào 1 trang
                                fontFamily: '"Times New Roman", Times, serif',
                                fontSize: '13pt'
                            }}
                            dangerouslySetInnerHTML={{ __html: reportContent }}
                        />
                        
                        <div className="absolute -bottom-10 left-0 right-0 text-center text-xs text-slate-500 font-bold uppercase tracking-widest">
                            --- KẾT THÚC TRANG 1 (210mm x 297mm) ---
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <FileText size={80} className="opacity-20 mb-4" />
                        <p className="text-lg font-medium">Chưa có dữ liệu báo cáo</p>
                        <p className="text-sm">Hãy chọn khoảng thời gian và bấm "Tạo báo cáo AI"</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportSection;
