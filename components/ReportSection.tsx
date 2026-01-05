
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { BarChart3, FileSpreadsheet, Loader2, Sparkles, Download, CalendarDays, Printer, Layout, FileText, ListFilter, CheckCircle2, Clock, AlertTriangle, Settings, Key, X, Save } from 'lucide-react';
import { RecordFile, RecordStatus } from '../types';
import { getNormalizedWard, STATUS_LABELS } from '../constants';
import { isRecordOverdue } from '../utils/appHelpers';
import { saveGeminiKey, getGeminiKey } from '../services/geminiService';

interface ReportSectionProps {
    reportContent: string;
    isGenerating: boolean;
    onGenerate: (fromDate: string, toDate: string) => void;
    onExportExcel: (fromDate: string, toDate: string) => void;
    records: RecordFile[]; // Thêm prop records để tính toán client-side
}

const ReportSection: React.FC<ReportSectionProps> = ({ reportContent, isGenerating, onGenerate, onExportExcel, records }) => {
    const [fromDate, setFromDate] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    });
    const [toDate, setToDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });

    const [activeTab, setActiveTab] = useState<'list' | 'ai'>('list');
    const previewRef = useRef<HTMLDivElement>(null);

    // States cho Modal nhập Key
    const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
    const [apiKey, setApiKey] = useState('');

    useEffect(() => {
        if (isKeyModalOpen) {
            setApiKey(getGeminiKey());
        }
    }, [isKeyModalOpen]);

    const handleSaveKey = () => {
        saveGeminiKey(apiKey);
        setIsKeyModalOpen(false);
        alert("Đã lưu API Key thành công!");
    };

    // --- LOGIC TÍNH TOÁN DỮ LIỆU ---
    const filteredData = useMemo(() => {
        const start = new Date(fromDate); start.setHours(0,0,0,0);
        const end = new Date(toDate); end.setHours(23,59,59,999);

        return records.filter(r => {
            if (!r.receivedDate) return false;
            const rDate = new Date(r.receivedDate);
            return rDate >= start && rDate <= end;
        });
    }, [records, fromDate, toDate]);

    const stats = useMemo(() => {
        const total = filteredData.length;
        const completed = filteredData.filter(r => r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.SIGNED).length;
        const withdrawn = filteredData.filter(r => r.status === RecordStatus.WITHDRAWN).length;
        const overdue = filteredData.filter(r => isRecordOverdue(r)).length;
        const processing = total - completed - withdrawn;
        return { total, completed, withdrawn, overdue, processing };
    }, [filteredData]);

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
        setActiveTab('list'); // Chuyển về tab list để xem kết quả ngay
    };

    const handleGenerateClick = () => {
        if (!fromDate || !toDate) { alert("Vui lòng chọn đầy đủ thời gian."); return; }
        
        // Kiểm tra Key trước khi chạy
        const currentKey = getGeminiKey();
        if (!currentKey && !process.env.API_KEY) {
            setIsKeyModalOpen(true);
            return;
        }

        setActiveTab('ai');
        onGenerate(fromDate, toDate);
    };

    const handleExportExcelClick = () => {
        if (!fromDate || !toDate) { alert("Vui lòng chọn đầy đủ thời gian."); return; }
        onExportExcel(fromDate, toDate);
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

    const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('vi-VN') : '-';

    return (
        <div className="flex flex-col h-full overflow-hidden relative bg-slate-50">
            {/* Toolbar */}
            <div className="bg-white p-4 border-b border-gray-200 shadow-sm flex flex-col gap-4 shrink-0 z-10">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2.5 rounded-xl text-blue-600">
                            <BarChart3 size={24} />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-800 text-lg">Báo cáo & Thống kê</h2>
                            <p className="text-xs text-gray-500">Lập danh sách kết quả, báo cáo tuần/tháng</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button onClick={() => handleQuickReport('week')} className="px-3 py-1.5 rounded-md text-xs font-bold hover:bg-white hover:shadow-sm transition-all text-slate-600 flex items-center gap-1">
                            <CalendarDays size={14} /> Tuần này
                        </button>
                        <button onClick={() => handleQuickReport('month')} className="px-3 py-1.5 rounded-md text-xs font-bold hover:bg-white hover:shadow-sm transition-all text-slate-600 flex items-center gap-1">
                            <Layout size={14} /> Tháng này
                        </button>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-2 py-1 shadow-sm">
                            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="text-sm outline-none text-gray-700 font-medium" />
                            <span className="text-gray-400">➜</span>
                            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="text-sm outline-none text-gray-700 font-medium" />
                        </div>
                        
                        <button onClick={handleExportExcelClick} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-bold text-sm shadow-sm transition-colors" title="Xuất Excel">
                            <FileSpreadsheet size={18} /> Xuất Excel
                        </button>
                    </div>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center gap-3">
                        <div className="bg-blue-200 p-2 rounded-lg text-blue-700"><ListFilter size={20}/></div>
                        <div><div className="text-2xl font-bold text-blue-800">{stats.total}</div><div className="text-xs text-blue-600 uppercase font-bold">Tổng hồ sơ</div></div>
                    </div>
                    <div className="bg-green-50 border border-green-100 p-3 rounded-xl flex items-center gap-3">
                        <div className="bg-green-200 p-2 rounded-lg text-green-700"><CheckCircle2 size={20}/></div>
                        <div><div className="text-2xl font-bold text-green-800">{stats.completed}</div><div className="text-xs text-green-600 uppercase font-bold">Đã xong</div></div>
                    </div>
                    <div className="bg-orange-50 border border-orange-100 p-3 rounded-xl flex items-center gap-3">
                        <div className="bg-orange-200 p-2 rounded-lg text-orange-700"><Clock size={20}/></div>
                        <div><div className="text-2xl font-bold text-orange-800">{stats.processing}</div><div className="text-xs text-orange-600 uppercase font-bold">Đang xử lý</div></div>
                    </div>
                    <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-3">
                        <div className="bg-red-200 p-2 rounded-lg text-red-700"><AlertTriangle size={20}/></div>
                        <div><div className="text-2xl font-bold text-red-800">{stats.overdue}</div><div className="text-xs text-red-600 uppercase font-bold">Trễ hạn</div></div>
                    </div>
                </div>
            </div>

            {/* Content Tabs */}
            <div className="flex bg-white border-b border-gray-200 px-4">
                <button 
                    onClick={() => setActiveTab('list')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <ListFilter size={16}/> Danh sách kết quả ({filteredData.length})
                </button>
                <button 
                    onClick={() => setActiveTab('ai')}
                    className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'ai' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                    <Sparkles size={16}/> Văn bản Báo cáo (AI)
                </button>
            </div>

            {/* TAB CONTENT */}
            <div className="flex-1 overflow-hidden bg-slate-100 p-4">
                {activeTab === 'list' && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full overflow-hidden flex flex-col animate-fade-in-up">
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold sticky top-0 shadow-sm z-10">
                                    <tr>
                                        <th className="p-3 w-10 text-center">#</th>
                                        <th className="p-3 w-32">Mã HS</th>
                                        <th className="p-3 w-48">Chủ sử dụng</th>
                                        <th className="p-3 w-32">Xã/Phường</th>
                                        <th className="p-3 w-24">Ngày nhận</th>
                                        <th className="p-3 w-24">Hẹn trả</th>
                                        <th className="p-3 w-24">Hoàn thành</th>
                                        <th className="p-3 w-32 text-center">Trạng thái</th>
                                        <th className="p-3">Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredData.length > 0 ? filteredData.map((r, i) => (
                                        <tr key={r.id} className="hover:bg-blue-50/50 transition-colors">
                                            <td className="p-3 text-center text-gray-400">{i + 1}</td>
                                            <td className="p-3 font-medium text-blue-600">{r.code}</td>
                                            <td className="p-3 font-medium">{r.customerName}</td>
                                            <td className="p-3 text-gray-600">{getNormalizedWard(r.ward)}</td>
                                            <td className="p-3 text-gray-600">{formatDate(r.receivedDate)}</td>
                                            <td className="p-3 text-gray-600">{formatDate(r.deadline)}</td>
                                            <td className="p-3 text-green-700 font-medium">{formatDate(r.completedDate)}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-1 rounded text-xs border ${
                                                    r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED ? 'bg-green-100 text-green-700 border-green-200' : 
                                                    r.status === RecordStatus.WITHDRAWN ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                                    isRecordOverdue(r) ? 'bg-red-100 text-red-700 border-red-200 font-bold' :
                                                    'bg-blue-50 text-blue-700 border-blue-100'
                                                }`}>
                                                    {STATUS_LABELS[r.status]}
                                                </span>
                                            </td>
                                            <td className="p-3 text-gray-500 italic truncate max-w-xs">{r.notes || r.content}</td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={9} className="p-8 text-center text-gray-400">Không có dữ liệu trong khoảng thời gian này.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'ai' && (
                    <div className="h-full flex flex-col items-center">
                        {/* AI Toolbar */}
                        <div className="w-full flex justify-between items-center mb-4 bg-white p-3 rounded-xl border border-gray-200 shadow-sm shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="text-sm text-gray-600">
                                    Sử dụng <strong>Gemini AI</strong> để viết báo cáo nhận xét tiến độ.
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setIsKeyModalOpen(true)} className="flex items-center gap-1.5 bg-white text-gray-700 border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 font-medium text-sm shadow-sm transition-all" title="Cài đặt API Key">
                                    <Settings size={16} /> Cấu hình AI
                                </button>
                                <button onClick={handleGenerateClick} disabled={isGenerating} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-bold text-sm shadow-md transition-all disabled:opacity-50">
                                    {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                                    Tạo báo cáo ngay
                                </button>
                                {reportContent && (
                                    <button onClick={handlePrint} className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium text-sm shadow-sm">
                                        <Printer size={16} /> In
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="flex-1 w-full overflow-y-auto bg-slate-200 p-8 rounded-xl custom-scrollbar flex justify-center border border-slate-300 shadow-inner">
                            {reportContent ? (
                                <div className="bg-white shadow-2xl p-[20mm_15mm_20mm_25mm] w-[210mm] min-h-[297mm] animate-fade-in-up">
                                    <div ref={previewRef} style={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '13pt', lineHeight: 1.4 }} dangerouslySetInnerHTML={{ __html: reportContent }} />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-slate-400 opacity-60">
                                    <FileText size={64} className="mb-4" />
                                    <p>Chưa có nội dung báo cáo.</p>
                                </div>
                            )}
                        </div>
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
