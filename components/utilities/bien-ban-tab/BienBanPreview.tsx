
import React from 'react';
import { AlertCircle, Map as MapIcon, CheckCircle } from 'lucide-react';

interface BienBanPreviewProps {
    generateContent: (isForWord: boolean) => string;
    isAreaMismatch: boolean;
    isAreaMismatchBDDC?: boolean;
    actualDiffGCN?: number;
    calculatedSumGCN?: number;
    actualDiffBDDC?: number;
    calculatedSumBDDC?: number;
}

const BienBanPreview: React.FC<BienBanPreviewProps> = ({
    generateContent,
    isAreaMismatch,
    isAreaMismatchBDDC,
    actualDiffGCN = 0,
    calculatedSumGCN = 0,
    actualDiffBDDC = 0,
    calculatedSumBDDC = 0,
}) => {
    const renderMismatchCard = (
        title: string,
        targetLabel: string,
        actualDiff: number,
        calculatedSum: number,
        bgColorClass: string,
        borderColorClass: string,
        accentTextColorClass: string,
        subBorderColorClass: string
    ) => {
        const diff = actualDiff - calculatedSum;
        const mismatchAmount = Math.abs(diff);

        const formatSigned = (val: number) => {
            if (val > 0) return `+${val.toFixed(1)}`;
            if (val < 0) return `-${Math.abs(val).toFixed(1)}`;
            return `0.0`;
        };

        const formatDiffText = (val: number) => {
            if (val > 0) return `Tăng ${val.toFixed(1)} m²`;
            if (val < 0) return `Giảm ${Math.abs(val).toFixed(1)} m²`;
            return `Không đổi`;
        };

        const evalWord = diff > 0 ? 'thiếu' : 'thừa';
        const evalText = `Chi tiết tăng/giảm đang kê khai ${evalWord} ${mismatchAmount.toFixed(1)} m² so với thực tế biến động. Hãy kiểm tra lại.`;

        return (
            <div className={`${bgColorClass} border-2 ${borderColorClass} text-white rounded-xl p-4 shadow-2xl mb-4 w-[210mm] z-50 animate-pulse text-xs sm:text-sm font-medium`}>
                <div className={`flex items-center gap-2 font-black ${accentTextColorClass} text-sm sm:text-base border-b ${subBorderColorClass} pb-2 mb-2 uppercase tracking-wide`}>
                    <AlertCircle size={22} className="shrink-0 text-amber-300" />
                    {title} (LỆCH {mismatchAmount.toFixed(1)} m²)
                </div>
                <div className="space-y-1.5 pl-2 sm:pl-7 text-white/95 leading-relaxed">
                    <div>
                        <strong>• Tổng chênh lệch thực tế (Mới - {targetLabel}):</strong>{' '}
                        <span className={`font-bold ${accentTextColorClass}`}>{formatSigned(actualDiff)} m²</span> ({formatDiffText(actualDiff)})
                    </div>
                    <div>
                        <strong>• Tổng chi tiết tăng/giảm đã nhập:</strong>{' '}
                        <span className={`font-bold ${accentTextColorClass}`}>{formatSigned(calculatedSum)} m²</span>
                    </div>
                    <div className={`pt-1.5 ${accentTextColorClass} font-semibold border-t ${subBorderColorClass} mt-2`}>
                        <strong>• Đánh giá:</strong> {evalText}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex-1 bg-slate-300 overflow-y-auto overflow-x-auto p-10 flex flex-col items-center custom-scrollbar shadow-inner relative min-w-0 min-h-0 h-full">
            {/* CẢNH BÁO LỆCH DIỆN TÍCH GCN */}
            {isAreaMismatch && renderMismatchCard(
                'CẢNH BÁO LỆCH DIỆN TÍCH GCN',
                'GCN',
                actualDiffGCN,
                calculatedSumGCN,
                'bg-red-700',
                'border-red-400',
                'text-amber-200',
                'border-red-500/80'
            )}

            {/* CẢNH BÁO LỆCH DIỆN TÍCH BĐĐC */}
            {isAreaMismatchBDDC && renderMismatchCard(
                'CẢNH BÁO LỆCH DIỆN TÍCH BĐĐC 2024',
                'BĐĐC 2024',
                actualDiffBDDC,
                calculatedSumBDDC,
                'bg-orange-600',
                'border-orange-300',
                'text-yellow-200',
                'border-orange-400/80'
            )}

            <div className="bg-white w-[210mm] min-h-[297mm] h-auto shadow-[0_0_80px_rgba(0,0,0,0.25)] p-[20mm_15mm_20mm_25mm] transition-all animate-fade-in-up relative ring-1 ring-slate-400 mb-24 flex flex-col shrink-0">
                <div className="absolute top-0 left-0 w-[25mm] h-full bg-slate-50/40 pointer-events-none border-r border-slate-100 flex items-center justify-center z-0">
                    <div className="rotate-90 text-[10px] font-black text-slate-300 uppercase tracking-[1.5em] whitespace-nowrap">LỀ TRÁI ĐÓNG GHIM 25MM</div>
                </div>
                <div className="relative z-10 w-full h-auto overflow-visible select-none pointer-events-none" dangerouslySetInnerHTML={{ __html: generateContent(false) }} />
            </div>
            
            <div className="fixed bottom-8 bg-white/95 backdrop-blur px-10 py-4 rounded-full border border-slate-400 shadow-2xl flex items-center gap-8 text-[11px] font-black text-slate-700 uppercase tracking-widest z-30 pointer-events-auto border-b-4 border-b-blue-600">
                <div className="flex items-center gap-2.5"><MapIcon size={18} className="text-blue-500" /> Tự động dàn trang</div>
                <div className="w-px h-5 bg-slate-300"></div>
                <div className="flex items-center gap-2.5"><CheckCircle size={18} className="text-emerald-500" /> Lề chuẩn A4</div>
                <div className="w-px h-5 bg-slate-300"></div>
                <div className="flex items-center gap-2.5 text-blue-600 animate-pulse"><AlertCircle size={18} /> Chế độ xem trước</div>
            </div>
        </div>
    );
};

export default BienBanPreview;
