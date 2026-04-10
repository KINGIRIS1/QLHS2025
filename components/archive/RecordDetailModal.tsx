import React, { useState, useEffect } from 'react';
import { ArchiveRecord, updateArchiveRecordsBatch } from '../../services/apiArchive';
import { X, Clock, User, FileText, MapPin, Calendar, Save, MessageSquare } from 'lucide-react';

interface RecordDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: ArchiveRecord | null;
    currentUser: any;
    onUpdateRecord?: () => void;
}

const RecordDetailModal: React.FC<RecordDetailModalProps> = ({ isOpen, onClose, record, currentUser, onUpdateRecord }) => {
    const [personalNote, setPersonalNote] = useState('');
    const [internalNote, setInternalNote] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (record && isOpen) {
            const personalNotes = record.data?.personal_notes || {};
            setPersonalNote(personalNotes[currentUser?.username] || '');
            setInternalNote(record.data?.internal_notes || '');
        }
    }, [record, isOpen, currentUser]);

    if (!isOpen || !record) return null;

    const history = record.data?.history || [];

    const handleSaveNotes = async () => {
        if (!record) return;
        setIsSaving(true);
        try {
            const personalNotes = record.data?.personal_notes || {};
            personalNotes[currentUser?.username] = personalNote;

            const { history, ...restData } = record.data || {};
            const updatedData = {
                ...restData,
                personal_notes: personalNotes,
                internal_notes: internalNote
            };

            await updateArchiveRecordsBatch([record.id], { data: updatedData });
            if (onUpdateRecord) {
                onUpdateRecord();
            }
        } catch (error) {
            console.error("Lỗi khi lưu ghi chú:", error);
            alert("Không thể lưu ghi chú. Vui lòng thử lại.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col animate-fade-in-up">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center rounded-t-xl">
                    <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                        <FileText size={20} className="text-blue-600" />
                        Chi tiết hồ sơ: {record.so_hieu}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                        {/* Cột 1: Thông tin hồ sơ */}
                        <div className="col-span-1 flex flex-col gap-4">
                            <div className="bg-white border rounded-lg overflow-hidden shadow-sm h-full">
                                <div className="bg-blue-50/50 px-4 py-3 border-b border-blue-100 font-semibold text-blue-800 flex items-center gap-2">
                                    <FileText size={18} />
                                    Thông tin hồ sơ
                                </div>
                                <div className="p-4 grid grid-cols-1 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Mã hồ sơ</p>
                                        <p className="font-medium text-gray-900">{record.so_hieu}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Loại biến động</p>
                                        <p className="font-medium text-gray-900">{record.trich_yeu}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Chuyển quyền</p>
                                        <p className="font-medium text-gray-900">{record.data?.chuyen_quyen}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Chủ sử dụng</p>
                                        <p className="font-medium text-gray-900">{record.noi_nhan_gui}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">CCCD</p>
                                        <p className="font-medium text-gray-900">{record.data?.cccd}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Ngày nhận</p>
                                        <p className="font-medium text-gray-900">{record.data?.ngay_nhan}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Ngày trả kết quả</p>
                                        <p className="font-medium text-gray-900">{record.data?.ngay_tra_kq}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Địa danh</p>
                                        <p className="font-medium text-gray-900">{record.data?.dia_danh}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Số tờ / Số thửa</p>
                                        <p className="font-medium text-gray-900">{record.data?.so_to} / {record.data?.so_thua}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Diện tích</p>
                                        <p className="font-medium text-gray-900">{record.data?.dien_tich}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Đất ở</p>
                                        <p className="font-medium text-gray-900">{record.data?.dat_o}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Số phát hành</p>
                                        <p className="font-medium text-gray-900">{record.data?.so_phat_hanh}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Cột 2: Tiến độ giải quyết */}
                        <div className="col-span-1 flex flex-col gap-4">
                            <div className="bg-white border rounded-lg overflow-hidden shadow-sm h-full">
                                <div className="bg-indigo-50/50 px-4 py-3 border-b border-indigo-100 font-semibold text-indigo-800 flex items-center gap-2">
                                    <Clock size={18} />
                                    Tiến độ giải quyết
                                </div>
                                <div className="p-4">
                                    {history.length > 0 ? (
                                        <div className="space-y-4">
                                            {history.map((h: any, idx: number) => (
                                                <div key={idx} className="flex gap-3 relative">
                                                    {idx !== history.length - 1 && (
                                                        <div className="absolute left-[11px] top-6 bottom-[-16px] w-0.5 bg-gray-200"></div>
                                                    )}
                                                    <div className="w-6 h-6 rounded-full bg-indigo-100 border-2 border-white shadow-sm flex items-center justify-center flex-shrink-0 z-10">
                                                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                                    </div>
                                                    <div className="flex-1 pb-2">
                                                        <p className="text-sm font-medium text-gray-900">{h.action}</p>
                                                        <div className="flex flex-col gap-1 mt-1 text-xs text-gray-500">
                                                            <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(h.timestamp).toLocaleString('vi-VN')}</span>
                                                            <span className="flex items-center gap-1"><User size={12} /> {h.user}</span>
                                                            {h.assignedTo && (
                                                                <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit">
                                                                    Trình: {h.assignedTo}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic text-center py-4">Chưa có lịch sử xử lý.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Cột 3: Ghi chú */}
                        <div className="col-span-1 flex flex-col gap-4">
                            <div className="bg-white border rounded-lg overflow-hidden shadow-sm h-full flex flex-col">
                                <div className="bg-amber-50/50 px-4 py-3 border-b border-amber-100 font-semibold text-amber-800 flex items-center gap-2">
                                    <MessageSquare size={18} />
                                    Ghi chú
                                </div>
                                <div className="p-4 flex-1 flex flex-col gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-gray-700">Ghi chú cá nhân (Chỉ bạn thấy)</label>
                                        <textarea
                                            value={personalNote}
                                            onChange={(e) => setPersonalNote(e.target.value)}
                                            placeholder="Nhập ghi chú cá nhân..."
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none h-32 text-sm"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-gray-700">Ghi chú nội bộ (Tất cả đều thấy)</label>
                                        <textarea
                                            value={internalNote}
                                            onChange={(e) => setInternalNote(e.target.value)}
                                            placeholder="Nhập ghi chú nội bộ..."
                                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none resize-none h-32 text-sm"
                                        />
                                    </div>
                                    <button
                                        onClick={handleSaveNotes}
                                        disabled={isSaving}
                                        className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                                    >
                                        <Save size={18} />
                                        {isSaving ? 'Đang lưu...' : 'Lưu ghi chú'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end rounded-b-xl">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-sm transition-colors"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RecordDetailModal;
