import React, { useState, useMemo, useEffect } from 'react';
import { RecordFile } from '../types';
import { getNormalizedWard } from '../constants';
import { X, ArrowRight, ToggleLeft, CheckSquare, Square, ChevronLeft, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';
import { updateBulkRecordTypeApi } from '../services/apiRecords';

interface QuickRecordTypeConverterModalProps {
    isOpen: boolean;
    onClose: () => void;
    records: RecordFile[]; // Tất cả hồ sơ để tìm kiếm loại hồ sơ và lọc
    onSuccess: () => void; // Callback để load lại data khi thành công
}

const QuickRecordTypeConverterModal: React.FC<QuickRecordTypeConverterModalProps> = ({
    isOpen,
    onClose,
    records,
    onSuccess
}) => {
    // Định nghĩa các loại hồ sơ KHÔNG thuộc Đo đạc (Hồ sơ Khác)
    const otherTypes = ['CMD', 'Tòa án', 'Thi hành án', 'Thuế chính quy', 'Thu hồi Giấy chứng nhận', 'Xin số thửa'];

    // Lấy tất cả hồ sơ Đo đạc
    const measurementRecords = useMemo(() => {
        return records.filter(r => {
            const t = r.recordType || '';
            return t && !otherTypes.includes(t);
        });
    }, [records]);

    // Danh sách các loại hồ sơ đo đạc hiện có độc bản (unique)
    const availableSourceTypes = useMemo(() => {
        const types = measurementRecords.map(r => r.recordType || '').filter(Boolean);
        return Array.from(new Set(types)).sort();
    }, [measurementRecords]);

    // Các State điều khiển
    const [sourceType, setSourceType] = useState<string>('');
    const [targetType, setTargetType] = useState<string>('');
    const [customTargetType, setCustomTargetType] = useState<string>('');
    const [isCustomTarget, setIsCustomTarget] = useState<boolean>(false);
    
    // Lưu các id hồ sơ được chọn
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
    // State phân trang cho danh sách hồ sơ tìm được
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [itemsPerPage] = useState<number>(10);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string>('');
    
    // Tiến độ cập nhật theo đợt
    const [updateProgress, setUpdateProgress] = useState<{ current: number; total: number } | null>(null);

    // Thiết lập loại nguồn mặc định khi mở modal
    useEffect(() => {
        if (isOpen && availableSourceTypes.length > 0) {
            setSourceType(availableSourceTypes[0]);
            setTargetType('');
            setCustomTargetType('');
            setIsCustomTarget(false);
            setSelectedIds(new Set());
            setCurrentPage(1);
            setSuccessMessage('');
            setErrorMessage('');
            setUpdateProgress(null);
        }
    }, [isOpen, availableSourceTypes]);

    // Khi đổi loại hồ sơ nguồn, reset tích chọn và phân trang
    useEffect(() => {
        setSelectedIds(new Set());
        setCurrentPage(1);
        setSuccessMessage('');
        setErrorMessage('');
        setUpdateProgress(null);
    }, [sourceType]);

    // Danh sách hồ sơ ứng với loại nguồn được chọn
    const matchedRecords = useMemo(() => {
        if (!sourceType) return [];
        return measurementRecords.filter(r => r.recordType === sourceType);
    }, [measurementRecords, sourceType]);

    // Phân trang danh sách hồ sơ
    const totalPages = Math.ceil(matchedRecords.length / itemsPerPage);
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return matchedRecords.slice(start, start + itemsPerPage);
    }, [matchedRecords, currentPage, itemsPerPage]);

    // Trình chọn tất cả hồ sơ trong toàn bộ kết quả lọc được
    const isAllSelected = useMemo(() => {
        if (matchedRecords.length === 0) return false;
        return matchedRecords.every(r => selectedIds.has(r.id));
    }, [matchedRecords, selectedIds]);

    const handleToggleSelectAll = () => {
        const newSelected = new Set(selectedIds);
        if (isAllSelected) {
            // Bỏ chọn tất cả các hồ sơ hiện tại
            matchedRecords.forEach(r => newSelected.delete(r.id));
        } else {
            // Chọn tất cả các hồ sơ hiện tại
            matchedRecords.forEach(r => newSelected.add(r.id));
        }
        setSelectedIds(newSelected);
    };

    const handleToggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleConvert = async () => {
        const finalTargetType = isCustomTarget ? customTargetType.trim() : targetType;
        
        if (selectedIds.size === 0) {
            setErrorMessage('Vui lòng chọn ít nhất một hồ sơ để chuyển đổi.');
            return;
        }
        if (!finalTargetType) {
            setErrorMessage('Vui lòng chọn hoặc nhập loại hồ sơ đích.');
            return;
        }
        if (finalTargetType === sourceType) {
            setErrorMessage('Loại hồ sơ đích phải khác với loại hồ sơ nguồn.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage('');
        setSuccessMessage('');
        
        const idsArray = Array.from(selectedIds);
        const total = idsArray.length;
        setUpdateProgress({ current: 0, total });

        try {
            const BATCH_SIZE = 40; // Chia nhỏ mỗi đợt khoảng 40 hồ sơ để tối ưu hóa và tránh lỗi quá tải
            let processed = 0;

            for (let i = 0; i < total; i += BATCH_SIZE) {
                const chunk = idsArray.slice(i, i + BATCH_SIZE);
                const success = await updateBulkRecordTypeApi(chunk, finalTargetType);
                
                if (!success) {
                    throw new Error(`Gặp lỗi tại đợt cập nhật số ${Math.floor(i / BATCH_SIZE) + 1} (từ hồ sơ số ${i + 1} đến ${Math.min(i + BATCH_SIZE, total)}). Các đợt trước đó đã được cập nhật thành công.`);
                }
                
                processed += chunk.length;
                setUpdateProgress({ current: processed, total });
                
                // Đợi một khoảng ngắn (ví dụ: 100ms) giữa các đợt để giảm tải cho hệ thống và giúp UI mượt mà hơn
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            setSuccessMessage(`Đã chuyển đổi thành công tất cả ${total} hồ sơ từ "${sourceType}" sang "${finalTargetType}" theo từng đợt an toàn!`);
            setSelectedIds(new Set());
            onSuccess(); // Tải lại dữ liệu hệ thống
        } catch (error: any) {
            console.error('Lỗi chuyển đổi loại hồ sơ theo đợt:', error);
            setErrorMessage(error?.message || 'Có lỗi xảy ra trong quá trình cập nhật cơ sở dữ liệu.');
        } finally {
            setIsSubmitting(false);
            // Giữ lại trạng thái tiến độ trong 2 giây rồi ẩn đi
            setTimeout(() => {
                setUpdateProgress(null);
            }, 2500);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in text-left">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col animate-scale-up border border-slate-100 max-h-[90vh]">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-5 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-bold flex items-center gap-2 text-base">
                            <RefreshCw size={18} className="text-blue-300 animate-spin-slow" />
                            Công cụ chuyển đổi nhanh loại hồ sơ Đo đạc
                        </h3>
                        <p className="text-xs text-blue-200 mt-0.5 font-normal">Thay đổi hàng loạt thuộc tính Loại hồ sơ (recordType) một cách nhanh chóng và chính xác</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="rounded-lg p-1.5 hover:bg-white/10 text-white/80 hover:text-white transition-all cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex-1 overflow-y-auto space-y-6">
                    
                    {/* Hướng dẫn và thông báo */}
                    {successMessage && (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                            {successMessage}
                        </div>
                    )}
                    {errorMessage && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
                            <AlertCircle size={16} className="text-rose-500 shrink-0" />
                            {errorMessage}
                        </div>
                    )}

                    {updateProgress && (
                        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl space-y-2 animate-fade-in text-xs">
                            <div className="flex justify-between items-center font-bold text-blue-950">
                                <span className="flex items-center gap-1.5">
                                    <RefreshCw size={14} className="animate-spin text-blue-600" />
                                    Đang thực hiện cập nhật theo từng đợt an toàn...
                                </span>
                                <span>{updateProgress.current} / {updateProgress.total} hồ sơ ({Math.round((updateProgress.current / updateProgress.total) * 100)}%)</span>
                            </div>
                            <div className="w-full bg-blue-100 rounded-full h-2.5 overflow-hidden">
                                <div 
                                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                    style={{ width: `${(updateProgress.current / updateProgress.total) * 100}%` }}
                                ></div>
                            </div>
                            <p className="text-[10px] text-blue-600 font-medium italic">Vui lòng giữ kết nối ổn định cho tới khi tiến trình hoàn tất.</p>
                        </div>
                    )}

                    {/* Step 1: Cấu hình chuyển đổi */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 border border-slate-250 p-5 rounded-2xl">
                        {/* Cột 1: Chọn Nguồn */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">1. Chọn loại hồ sơ nguồn:</label>
                            <select
                                className="w-full text-xs font-semibold p-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-blue-600 transition-all text-slate-800 cursor-pointer shadow-sm"
                                value={sourceType}
                                onChange={(e) => setSourceType(e.target.value)}
                            >
                                <option value="" disabled>-- Chọn loại hồ sơ hiện có --</option>
                                {availableSourceTypes.map(t => (
                                    <option key={t} value={t}>{t} ({measurementRecords.filter(r => r.recordType === t).length} hồ sơ)</option>
                                ))}
                            </select>
                            <p className="text-[11px] text-slate-500">Hệ thống sẽ lọc ra toàn bộ các hồ sơ đang mang loại nguồn này.</p>
                        </div>

                        {/* Cột 2: Chọn Đích */}
                        <div className="space-y-2 relative border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">2. Chọn hoặc nhập loại đích:</label>
                                <button 
                                    type="button"
                                    onClick={() => setIsCustomTarget(!isCustomTarget)}
                                    className="text-[11px] text-blue-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                                >
                                    <ToggleLeft size={14} className={isCustomTarget ? "text-blue-600" : "text-slate-400"} />
                                    {isCustomTarget ? "Chọn loại có sẵn" : "Nhập loại mới"}
                                </button>
                            </div>

                            {!isCustomTarget ? (
                                <select
                                    className="w-full text-xs font-semibold p-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-blue-600 transition-all text-slate-800 cursor-pointer shadow-sm"
                                    value={targetType}
                                    onChange={(e) => setTargetType(e.target.value)}
                                >
                                    <option value="">-- Chọn loại hồ sơ đích --</option>
                                    {availableSourceTypes.filter(t => t !== sourceType).map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    placeholder="Nhập tên loại hồ sơ mới..."
                                    className="w-full text-xs font-semibold p-3 bg-white border border-slate-300 rounded-xl outline-none focus:border-blue-600 transition-all text-slate-800 shadow-sm"
                                    value={customTargetType}
                                    onChange={(e) => setCustomTargetType(e.target.value)}
                                />
                            )}
                            <p className="text-[11px] text-slate-500">Các hồ sơ được lựa chọn sẽ chuyển hoàn toàn sang loại hồ sơ đích này.</p>
                        </div>
                    </div>

                    {/* Step 2: Danh sách hồ sơ cần chuyển đổi */}
                    {sourceType && (
                        <div className="space-y-2 border border-slate-150 rounded-2xl overflow-hidden shadow-sm bg-white">
                            <div className="p-4 bg-slate-55 border-b border-slate-150 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                <div>
                                    <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Danh sách hồ sơ thuộc loại "{sourceType}"</h4>
                                    <p className="text-[11px] text-slate-500 mt-0.5">Đã tìm thấy <strong className="text-slate-800 font-bold">{matchedRecords.length}</strong> hồ sơ. Tích chọn các hồ sơ muốn thực hiện chuyển đổi.</p>
                                </div>
                                <div className="text-xs bg-indigo-50 border border-indigo-150 text-indigo-800 px-3 py-1.5 rounded-xl font-bold self-start sm:self-center">
                                    Đã chọn: {selectedIds.size} / {matchedRecords.length} hồ sơ
                                </div>
                            </div>

                            {/* Bảng hồ sơ */}
                            <div className="overflow-x-auto min-h-[250px]">
                                <table className="w-full text-left table-fixed min-w-[700px] border-collapse text-xs">
                                    <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase border-b border-slate-150 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-3 w-12 text-center">
                                                <button onClick={handleToggleSelectAll} className="cursor-pointer focus:outline-none" title="Chọn tất cả">
                                                    {isAllSelected ? <CheckSquare size={16} className="text-blue-600 mx-auto" /> : <Square size={16} className="text-slate-400 mx-auto" />}
                                                </button>
                                            </th>
                                            <th className="p-3 w-32">Mã hồ sơ</th>
                                            <th className="p-3">Tên khách hàng</th>
                                            <th className="p-3 w-36">Xã / Phường</th>
                                            <th className="p-3 w-28 text-center">Số tờ/thửa</th>
                                            <th className="p-3 w-28 text-center">Ngày tiếp nhận</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {paginatedRecords.length > 0 ? (
                                            paginatedRecords.map((r, idx) => {
                                                const isSelected = selectedIds.has(r.id);
                                                return (
                                                    <tr key={r.id} className={`hover:bg-slate-50/70 transition-colors ${isSelected ? 'bg-blue-50/20' : ''}`}>
                                                        <td className="p-3 text-center">
                                                            <button onClick={() => handleToggleSelect(r.id)} className="cursor-pointer focus:outline-none">
                                                                {isSelected ? <CheckSquare size={16} className="text-blue-600 mx-auto" /> : <Square size={16} className="text-slate-400 mx-auto" />}
                                                            </button>
                                                        </td>
                                                        <td className="p-3 font-bold text-slate-800">{r.code || '-'}</td>
                                                        <td className="p-3 font-semibold text-slate-700 truncate" title={r.customerName}>{r.customerName || '-'}</td>
                                                        <td className="p-3 text-slate-600 font-medium">{getNormalizedWard(r.ward)}</td>
                                                        <td className="p-3 text-center font-mono font-medium text-slate-500">{r.mapSheet || '-'}/{r.landPlot || '-'}</td>
                                                        <td className="p-3 text-center text-slate-500 font-medium">{r.receivedDate ? new Date(r.receivedDate).toLocaleDateString('vi-VN') : '-'}</td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="p-12 text-center text-slate-400 italic">
                                                    Không có hồ sơ nào khớp với điều kiện lọc
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Phân trang danh sách trong modal */}
                            {matchedRecords.length > 0 && (
                                <div className="border-t border-slate-150 p-4 bg-slate-50/50 flex justify-between items-center text-[11px] text-slate-600 shrink-0">
                                    <span>Hiển thị hồ sơ thứ <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> đến <strong>{Math.min(currentPage * itemsPerPage, matchedRecords.length)}</strong> trên tổng số <strong>{matchedRecords.length}</strong> hồ sơ</span>
                                    
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))} 
                                            disabled={currentPage === 1} 
                                            className="p-1.5 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-white transition-all cursor-pointer shadow-xs"
                                        >
                                            <ChevronLeft size={14} />
                                        </button>
                                        <span className="font-bold text-slate-700">Trang {currentPage} / {totalPages}</span>
                                        <button 
                                            onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))} 
                                            disabled={currentPage === totalPages} 
                                            className="p-1.5 border border-slate-300 rounded-lg bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:hover:bg-white transition-all cursor-pointer shadow-xs"
                                        >
                                            <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer điều khiển */}
                <div className="p-4 bg-slate-50 border-t border-slate-150 flex justify-between items-center shrink-0">
                    <div className="text-[11px] text-slate-500 italic max-w-sm">
                        * Mẹo: Bạn có thể chọn loại hồ sơ nguồn, tích tất cả hoặc chọn lọc một số hồ sơ, sau đó chọn loại đích và bấm chuyển đổi nhanh.
                    </div>
                    <div className="flex justify-end gap-2 text-xs">
                        <button 
                            onClick={onClose}
                            className="px-4 py-2.5 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all cursor-pointer"
                        >
                            Đóng lại
                        </button>
                        <button 
                            onClick={handleConvert}
                            disabled={isSubmitting || selectedIds.size === 0 || (!targetType && !customTargetType)}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-xl font-bold transition-all shadow-md shadow-blue-600/15 cursor-pointer flex items-center gap-1.5"
                        >
                            {isSubmitting ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" /> Đang cập nhật...
                                </>
                            ) : (
                                <>
                                    Xác nhận chuyển đổi ({selectedIds.size}) <ArrowRight size={14}/>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuickRecordTypeConverterModal;
