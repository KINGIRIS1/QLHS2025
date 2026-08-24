import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, XCircle, ArrowLeftRight, Loader2, Sparkles, FileCheck, RefreshCw, AlertCircle } from 'lucide-react';
import { NotifyFunction } from '../../types';
import { getGeminiKey } from '../../services/geminiService';

interface KiemTraKyThuatTabProps {
    notify: NotifyFunction;
}

interface ComparisonItem {
    field: string;
    gcnValue: string;
    trichLucValue: string;
    status: 'match' | 'warning' | 'error';
    notes: string;
}

interface AnalysisResult {
    summary: string;
    comparisons: ComparisonItem[];
    technicalErrors: string[];
    suggestions: string[];
}

const KiemTraKyThuatTab: React.FC<KiemTraKyThuatTabProps> = ({ notify }) => {
    const [gcnFile, setGcnFile] = useState<File | null>(null);
    const [gcnBase64, setGcnBase64] = useState<string>('');
    const [trichLucFile, setTrichLucFile] = useState<File | null>(null);
    const [trichLucBase64, setTrichLucBase64] = useState<string>('');
    
    const [loading, setLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState(0);
    const [result, setResult] = useState<AnalysisResult | null>(null);

    const gcnInputRef = useRef<HTMLInputElement>(null);
    const trichLucInputRef = useRef<HTMLInputElement>(null);

    const [gcnDragOver, setGcnDragOver] = useState(false);
    const [trichLucDragOver, setTrichLucDragOver] = useState(false);

    const loadingSteps = [
        "Đang đọc dữ liệu Giấy chứng nhận (GCN)...",
        "Đang phân tích Trích lục / Trích đo địa chính...",
        "Đang quét sơ đồ ranh giới và đo đạc cạnh thửa...",
        "Đang đối chiếu thông tin pháp lý & thông tin đo đạc...",
        "Đang định giá sai số đo đạc & lỗi kỹ thuật...",
        "Đang tổng hợp phiếu thẩm định kỹ thuật..."
    ];

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const handleFileChange = async (type: 'gcn' | 'trichluc', file: File) => {
        if (!file) return;
        
        // Kiểm tra loại file (PDF hoặc ảnh)
        const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            notify("Chỉ chấp nhận file PDF hoặc hình ảnh (PNG, JPEG, WEBP)!", "error");
            return;
        }

        try {
            const base64 = await fileToBase64(file);
            if (type === 'gcn') {
                setGcnFile(file);
                setGcnBase64(base64);
            } else {
                setTrichLucFile(file);
                setTrichLucBase64(base64);
            }
            notify(`Đã tải lên ${type === 'gcn' ? 'Giấy chứng nhận' : 'Trích lục'} thành công`, 'success');
        } catch (error) {
            notify("Lỗi khi đọc file. Vui lòng thử lại.", "error");
        }
    };

    const handleDragOver = (e: React.DragEvent, type: 'gcn' | 'trichluc') => {
        e.preventDefault();
        if (type === 'gcn') setGcnDragOver(true);
        else setTrichLucDragOver(true);
    };

    const handleDragLeave = (type: 'gcn' | 'trichluc') => {
        if (type === 'gcn') setGcnDragOver(false);
        else setTrichLucDragOver(false);
    };

    const handleDrop = (e: React.DragEvent, type: 'gcn' | 'trichluc') => {
        e.preventDefault();
        if (type === 'gcn') setGcnDragOver(false);
        else setTrichLucDragOver(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileChange(type, e.dataTransfer.files[0]);
        }
    };

    const startComparison = async () => {
        if (!gcnBase64 || !trichLucBase64) {
            notify("Vui lòng tải lên đầy đủ cả 2 tài liệu để so sánh!", "error");
            return;
        }

        setLoading(true);
        setResult(null);
        setLoadingStep(0);

        // Giả lập chuyển bước loading mượt mà
        const stepInterval = setInterval(() => {
            setLoadingStep(prev => {
                if (prev < loadingSteps.length - 1) {
                    return prev + 1;
                }
                return prev;
            });
        }, 3000);

        try {
            const response = await fetch('/custom/compare-docs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-gemini-key': getGeminiKey()
                },
                body: JSON.stringify({
                    gcnBase64,
                    gcnMime: gcnFile?.type || 'application/pdf',
                    trichLucBase64,
                    trichLucMime: trichLucFile?.type || 'application/pdf'
                })
            });

            if (!response.ok) {
                const resText = await response.text();
                let errMsg = 'Lỗi từ máy chủ so sánh.';
                try {
                    const errData = JSON.parse(resText);
                    errMsg = errData.error || errMsg;
                } catch {
                    errMsg = resText || errMsg;
                }
                throw new Error(errMsg);
            }

            const resText = await response.text();
            let data: any;
            try {
                data = JSON.parse(resText);
            } catch {
                throw new Error("Phản hồi từ máy chủ không phải là định dạng JSON hợp lệ.");
            }
            if (data.success && data.result) {
                setResult(data.result);
                notify("Hoàn thành đối chiếu kỹ thuật!", "success");
            } else {
                throw new Error("Dữ liệu phản hồi không đúng cấu trúc.");
            }
        } catch (error: any) {
            console.error(error);
            notify(error.message || "Có lỗi xảy ra trong quá trình đối chiếu kỹ thuật.", "error");
        } finally {
            clearInterval(stepInterval);
            setLoading(false);
        }
    };

    const resetAll = () => {
        setGcnFile(null);
        setGcnBase64('');
        setTrichLucFile(null);
        setTrichLucBase64('');
        setResult(null);
        setLoading(false);
        setLoadingStep(0);
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-[#f8fafc] overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto w-full space-y-6">
                
                {/* Tiêu đề & Giới thiệu */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <Sparkles className="text-amber-500 fill-amber-100" size={22} />
                            Kiểm tra kỹ thuật Trích lục & Trích đo địa chính
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Hệ thống AI tự động phân tích và đối chiếu thông tin pháp lý, ranh giới, diện tích và lỗi biên tập bản vẽ giữa Giấy chứng nhận (GCN) và Trích lục/Trích đo địa chính.
                        </p>
                    </div>
                    {result && (
                        <button 
                            onClick={resetAll}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-all shadow-sm border border-slate-200"
                        >
                            <RefreshCw size={16} /> Làm mới / Kiểm tra lại
                        </button>
                    )}
                </div>

                {!result && !loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Cột 1: Giấy chứng nhận */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col space-y-4">
                            <div>
                                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <span className="w-6 h-6 bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center rounded-full">1</span>
                                    Giấy chứng nhận (GCN) / Sổ đỏ gốc
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">Tải lên file PDF hoặc ảnh quét trang 2, 3 và trang 4 bổ sung biến động.</p>
                            </div>

                            <div 
                                onDragOver={(e) => handleDragOver(e, 'gcn')}
                                onDragLeave={() => handleDragLeave('gcn')}
                                onDrop={(e) => handleDrop(e, 'gcn')}
                                onClick={() => gcnInputRef.current?.click()}
                                className={`flex-1 min-h-[180px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all ${
                                    gcnDragOver ? 'border-blue-500 bg-blue-50/50' : 
                                    gcnFile ? 'border-emerald-300 bg-emerald-50/20' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/30'
                                }`}
                            >
                                <input 
                                    type="file" 
                                    ref={gcnInputRef}
                                    onChange={(e) => e.target.files && handleFileChange('gcn', e.target.files[0])}
                                    className="hidden" 
                                    accept=".pdf,image/*"
                                />
                                {gcnFile ? (
                                    <div className="space-y-2">
                                        <div className="mx-auto w-12 h-12 bg-emerald-100 text-emerald-600 flex items-center justify-center rounded-xl">
                                            <FileText size={24} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700 truncate max-w-[240px]">{gcnFile.name}</p>
                                            <p className="text-xs text-slate-400">{(gcnFile.size / (1024 * 1024)).toFixed(2)} MB • {gcnFile.type}</p>
                                        </div>
                                        <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">Đã sẵn sàng</span>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="mx-auto w-12 h-12 bg-slate-100 text-slate-400 flex items-center justify-center rounded-xl">
                                            <Upload size={20} />
                                        </div>
                                        <div className="text-sm">
                                            <span className="text-blue-600 font-bold">Nhấp để tải lên</span> hoặc kéo thả file
                                        </div>
                                        <p className="text-[11px] text-slate-400">PDF hoặc file hình ảnh (JPG, PNG, WEBP)</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Cột 2: Trích lục / Trích đo */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col space-y-4">
                            <div>
                                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                    <span className="w-6 h-6 bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center rounded-full">2</span>
                                    Bản vẽ Trích lục / Trích đo địa chính
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">Tải lên file PDF hoặc hình ảnh bản vẽ trích lục cần kiểm định kỹ thuật.</p>
                            </div>

                            <div 
                                onDragOver={(e) => handleDragOver(e, 'trichluc')}
                                onDragLeave={() => handleDragLeave('trichluc')}
                                onDrop={(e) => handleDrop(e, 'trichluc')}
                                onClick={() => trichLucInputRef.current?.click()}
                                className={`flex-1 min-h-[180px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all ${
                                    trichLucDragOver ? 'border-purple-500 bg-purple-50/50' : 
                                    trichLucFile ? 'border-emerald-300 bg-emerald-50/20' : 'border-slate-300 hover:border-purple-400 hover:bg-slate-50/30'
                                }`}
                            >
                                <input 
                                    type="file" 
                                    ref={trichLucInputRef}
                                    onChange={(e) => e.target.files && handleFileChange('trichluc', e.target.files[0])}
                                    className="hidden" 
                                    accept=".pdf,image/*"
                                />
                                {trichLucFile ? (
                                    <div className="space-y-2">
                                        <div className="mx-auto w-12 h-12 bg-emerald-100 text-emerald-600 flex items-center justify-center rounded-xl">
                                            <FileText size={24} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700 truncate max-w-[240px]">{trichLucFile.name}</p>
                                            <p className="text-xs text-slate-400">{(trichLucFile.size / (1024 * 1024)).toFixed(2)} MB • {trichLucFile.type}</p>
                                        </div>
                                        <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">Đã sẵn sàng</span>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="mx-auto w-12 h-12 bg-slate-100 text-slate-400 flex items-center justify-center rounded-xl">
                                            <Upload size={20} />
                                        </div>
                                        <div className="text-sm">
                                            <span className="text-purple-600 font-bold">Nhấp để tải lên</span> hoặc kéo thả file
                                        </div>
                                        <p className="text-[11px] text-slate-400">PDF hoặc file hình ảnh (JPG, PNG, WEBP)</p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                )}

                {/* Nút thực thi đối chiếu */}
                {!result && !loading && (
                    <div className="flex justify-center">
                        <button
                            onClick={startComparison}
                            disabled={!gcnBase64 || !trichLucBase64}
                            className={`px-8 py-4 rounded-xl text-base font-black flex items-center gap-3 transition-all shadow-md ${
                                (gcnBase64 && trichLucBase64) 
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white cursor-pointer hover:scale-[1.02]' 
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            <ArrowLeftRight size={20} />
                            Bắt đầu Đối chiếu & Thẩm định kỹ thuật bằng AI
                        </button>
                    </div>
                )}

                {/* Trạng thái Loading bằng AI */}
                {loading && (
                    <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-lg flex flex-col items-center justify-center text-center space-y-6">
                        <div className="relative flex items-center justify-center">
                            <Loader2 className="text-blue-600 animate-spin" size={60} />
                            <Sparkles className="absolute text-amber-500 animate-pulse" size={24} />
                        </div>
                        <div className="space-y-2">
                            <h4 className="text-lg font-black text-slate-700">Trí tuệ nhân tạo đang thẩm định dữ liệu</h4>
                            <p className="text-sm font-semibold text-blue-600">{loadingSteps[loadingStep]}</p>
                            <p className="text-xs text-slate-400 max-w-md mx-auto">
                                Quá trình này có thể mất từ 15-30 giây để phân tích và đo đạc ranh giới chi tiết từ các hình vẽ hoặc tài liệu phức tạp của bạn.
                            </p>
                        </div>
                    </div>
                )}

                {/* HỒ SƠ KẾT QUẢ PHÂN TÍCH */}
                {result && (
                    <div className="space-y-6 animate-fade-in">
                        
                        {/* Thẻ Tổng quan (Summary Card) */}
                        <div className="bg-white p-6 rounded-2xl border-l-4 border-l-blue-600 border border-slate-200 shadow-sm space-y-3">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <FileCheck className="text-blue-600" size={22} />
                                Phiếu Đánh giá Tổng hợp kết quả Kiểm tra
                            </h3>
                            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl font-medium">
                                {result.summary}
                            </p>
                        </div>

                        {/* Thống kê lỗi */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* Danh sách lỗi kỹ thuật phát hiện */}
                            <div className="bg-white p-6 rounded-2xl border border-red-100 shadow-sm space-y-4">
                                <h4 className="text-sm font-black text-red-700 uppercase tracking-wider flex items-center gap-2">
                                    <AlertCircle size={18} />
                                    Lỗi kỹ thuật / Hành chính phát hiện được ({result.technicalErrors.length})
                                </h4>
                                {result.technicalErrors.length === 0 ? (
                                    <div className="p-4 bg-green-50 rounded-xl border border-green-100 flex items-center gap-3 text-green-700 text-xs font-semibold">
                                        <CheckCircle size={18} />
                                        Tuyệt vời! Không phát hiện lỗi sai sót kỹ thuật hoặc hành chính nào trên tài liệu.
                                    </div>
                                ) : (
                                    <ul className="space-y-2">
                                        {result.technicalErrors.map((err, idx) => (
                                            <li key={idx} className="p-3 bg-red-50 text-red-800 text-xs font-semibold rounded-xl border border-red-100 flex items-start gap-2.5 leading-relaxed">
                                                <XCircle className="text-red-500 shrink-0 mt-0.5" size={15} />
                                                <span>{err}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {/* Kiến nghị & Đề xuất */}
                            <div className="bg-white p-6 rounded-2xl border border-amber-100 shadow-sm space-y-4">
                                <h4 className="text-sm font-black text-amber-700 uppercase tracking-wider flex items-center gap-2">
                                    <Sparkles size={18} className="fill-amber-100" />
                                    Kiến nghị xử lý & Biện pháp khắc phục ({result.suggestions.length})
                                </h4>
                                {result.suggestions.length === 0 ? (
                                    <div className="p-4 bg-green-50 rounded-xl border border-green-100 flex items-center gap-3 text-green-700 text-xs font-semibold">
                                        <CheckCircle size={18} />
                                        Hồ sơ đạt yêu cầu, không cần kiến nghị khắc phục thêm.
                                    </div>
                                ) : (
                                    <ul className="space-y-2">
                                        {result.suggestions.map((sug, idx) => (
                                            <li key={idx} className="p-3 bg-amber-50 text-amber-800 text-xs font-semibold rounded-xl border border-amber-100 flex items-start gap-2.5 leading-relaxed">
                                                <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={15} />
                                                <span>{sug}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                        </div>

                        {/* Bảng đối chiếu chi tiết */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="text-base font-black text-slate-800">Bảng Đối chiếu Thông số Chi tiết</h3>
                                <p className="text-xs text-slate-400 mt-0.5">So sánh dữ liệu thuộc tính giữa Giấy chứng nhận và Trích lục địa chính.</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-200">
                                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[20%]">Hạng mục kiểm tra</th>
                                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[25%]">Dữ liệu trên GCN (Sổ đỏ)</th>
                                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[25%]">Dữ liệu trên Trích lục</th>
                                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[12%] text-center">Đánh giá</th>
                                            <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[18%]">Chi tiết đánh giá</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {result.comparisons.map((comp, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                                                <td className="p-4 text-sm font-bold text-slate-800">{comp.field}</td>
                                                <td className="p-4 text-sm text-slate-600 font-medium">{comp.gcnValue || 'N/A'}</td>
                                                <td className="p-4 text-sm text-slate-600 font-medium">{comp.trichLucValue || 'N/A'}</td>
                                                <td className="p-4 text-center">
                                                    {comp.status === 'match' && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-100">
                                                            <CheckCircle size={12} />
                                                            Trùng khớp
                                                        </span>
                                                    )}
                                                    {comp.status === 'warning' && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-100">
                                                            <AlertTriangle size={12} />
                                                            Cảnh báo
                                                        </span>
                                                    )}
                                                    {comp.status === 'error' && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-full border border-red-100">
                                                            <XCircle size={12} />
                                                            Sai lệch
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-xs text-slate-500 leading-relaxed font-medium">{comp.notes}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>
                )}

            </div>
        </div>
    );
};

export default KiemTraKyThuatTab;
