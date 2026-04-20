import React, { useState, useEffect } from 'react';
import { ArchiveRecord, updateArchiveRecordsBatch } from '../../services/apiArchive';
import { X, Clock, User, FileText, MapPin, Calendar, Save, MessageSquare } from 'lucide-react';
import { Employee } from '../../types';

interface RecordDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: ArchiveRecord | null;
    currentUser: any;
    onUpdateRecord?: () => void;
    employees?: Employee[];
}

const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
        'tiep_nhan': 'Tiếp nhận',
        'xu_ly': 'Xử lý hồ sơ',
        'tham_tra_thue': 'Thẩm tra thuế',
        'chuyen_thue': 'Chuyển thuế',
        'dong_thue': 'Đóng thuế',
        'ky_gcn': 'Ký GCN',
        'hoan_thanh': 'Hoàn thành'
    };
    return statusMap[status] || status;
};

const RecordDetailModal: React.FC<RecordDetailModalProps> = ({ isOpen, onClose, record, currentUser, onUpdateRecord, employees = [] }) => {
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

    const getEmployeeName = (idOrName: string) => {
        if (!idOrName) return '';
        const employee = employees.find(e => e.id === idOrName || e.name === idOrName);
        return employee ? employee.name : idOrName;
    };

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

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50/50">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                        {/* Cột 1: Thông tin chủ hồ sơ, địa chính, người xử lý, ghi chú cá nhân */}
                        <div className="col-span-1 lg:col-span-4 flex flex-col gap-4">
                            {/* THÔNG TIN CHỦ HỒ SƠ */}
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                                    <User size={16} className="text-blue-600" />
                                    <h4 className="font-bold text-blue-600 text-sm uppercase">Thông tin chủ hồ sơ</h4>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs text-gray-500 font-medium mb-1 uppercase">Chủ sử dụng</p>
                                        <p className="font-bold text-gray-900 text-lg uppercase">{record.noi_nhan_gui || '---'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 font-medium mb-1 uppercase">CCCD / Số điện thoại</p>
                                        <p className="font-bold text-gray-900 text-base">{record.data?.cccd || '---'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* THÔNG TIN ĐỊA CHÍNH */}
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-1 h-4 bg-green-500 rounded-full"></div>
                                    <MapPin size={16} className="text-green-500" />
                                    <h4 className="font-bold text-green-500 text-sm uppercase">Thông tin địa chính</h4>
                                </div>
                                <div className="grid grid-cols-3 gap-4 mb-4">
                                    <div className="col-span-1">
                                        <p className="text-xs text-gray-500 font-medium mb-1 uppercase">Xã/Phường</p>
                                        <p className="font-bold text-gray-900">{record.data?.dia_danh || '---'}</p>
                                    </div>
                                    <div className="col-span-1">
                                        <p className="text-xs text-gray-500 font-medium mb-1 uppercase">Tờ bản đồ</p>
                                        <div className="border border-gray-200 rounded p-2 text-center font-bold text-gray-900">{record.data?.so_to || '---'}</div>
                                    </div>
                                    <div className="col-span-1">
                                        <p className="text-xs text-gray-500 font-medium mb-1 uppercase">Thửa đất</p>
                                        <div className="border border-gray-200 rounded p-2 text-center font-bold text-gray-900">{record.data?.so_thua || '---'}</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500 font-medium mb-1 uppercase">Diện tích</p>
                                        <p className="font-bold text-gray-900">{record.data?.dien_tich || '---'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 font-medium mb-1 uppercase">Đất ở</p>
                                        <p className="font-bold text-gray-900">{record.data?.dat_o || '---'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* NGƯỜI XỬ LÝ HỒ SƠ */}
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                <p className="text-xs text-gray-500 font-medium mb-3 uppercase">Người xử lý hồ sơ</p>
                                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                                        <User size={16} />
                                    </div>
                                    <span className="font-bold text-gray-900 text-sm">
                                        {record.status === 'tiep_nhan' ? 'Chưa giao' : getEmployeeName(history[history.length - 1]?.user || 'Đang xử lý')}
                                    </span>
                                </div>
                            </div>

                            {/* GHI CHÚ CÁ NHÂN */}
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <FileText size={16} className="text-blue-600" />
                                        <h4 className="font-bold text-blue-600 text-sm uppercase">Ghi chú cá nhân</h4>
                                    </div>
                                    <button 
                                        onClick={handleSaveNotes}
                                        disabled={isSaving}
                                        className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        <Save size={12} /> Lưu
                                    </button>
                                </div>
                                <textarea
                                    value={personalNote}
                                    onChange={(e) => setPersonalNote(e.target.value)}
                                    placeholder="Nhập ghi chú riêng của bạn..."
                                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24 text-sm"
                                />
                            </div>
                        </div>

                        {/* Cột 2: Nội dung chi tiết */}
                        <div className="col-span-1 lg:col-span-4 flex flex-col gap-4">
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm h-full flex flex-col">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                                    <FileText size={16} className="text-purple-500" />
                                    <h4 className="font-bold text-purple-500 text-sm uppercase">Nội dung chi tiết</h4>
                                </div>
                                
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mb-6">
                                    <p className="font-medium text-gray-900">{record.trich_yeu || '---'}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-6 mb-6">
                                    <div>
                                        <p className="text-xs text-gray-500 font-medium mb-1 uppercase">Mã hồ sơ</p>
                                        <p className="font-bold text-gray-900">{record.so_hieu || '---'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 font-medium mb-1 uppercase">Chuyển quyền</p>
                                        <p className="font-bold text-gray-900">{record.data?.chuyen_quyen || '---'}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center text-blue-600">
                                            <FileText size={16} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-blue-600 font-bold uppercase">Số phát hành</p>
                                            <p className="font-bold text-gray-900 text-sm">{record.data?.so_phat_hanh || '---'}</p>
                                        </div>
                                    </div>
                                    <div className="bg-green-50 p-3 rounded-lg border border-green-100 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-green-100 flex items-center justify-center text-green-600">
                                            <FileText size={16} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-green-600 font-bold uppercase">Trạng thái</p>
                                            <p className={`font-bold text-sm ${history.length > 0 && history[history.length - 1].action?.startsWith('Trả về') ? 'text-red-600' : 'text-gray-900'}`}>
                                                {history.length > 0 && history[history.length - 1].action?.startsWith('Trả về') 
                                                    ? (
                                                        record.status === 'xu_ly' ? 'Trả Xử lý hồ sơ' :
                                                        record.status === 'tham_tra_thue' ? 'Trả Thẩm tra thuế' :
                                                        record.status === 'chuyen_thue' ? 'Trả Đã chuyển thuế' :
                                                        record.status === 'dong_thue' ? 'Trả Đã đóng thuế' : 
                                                        `Trả ${getStatusText(record.status)}`
                                                    )
                                                    : (getStatusText(record.status) || '---')}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-auto">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs text-gray-500 font-medium uppercase">Ghi chú nội bộ</p>
                                        <button 
                                            onClick={handleSaveNotes}
                                            disabled={isSaving}
                                            className="text-blue-600 hover:text-blue-800 text-xs font-medium disabled:opacity-50"
                                        >
                                            Lưu
                                        </button>
                                    </div>
                                    <textarea
                                        value={internalNote}
                                        onChange={(e) => setInternalNote(e.target.value)}
                                        placeholder="Ghi chú chung cho tất cả mọi người..."
                                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none resize-none h-32 text-sm bg-gray-50"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Cột 3: Tiến độ & Thời gian */}
                        <div className="col-span-1 lg:col-span-4 flex flex-col gap-4">
                            <div className="bg-white border border-gray-200 rounded-xl shadow-sm h-full flex flex-col overflow-hidden">
                                <div className="bg-indigo-600 px-5 py-4 flex items-center gap-2 text-white">
                                    <Clock size={18} />
                                    <h4 className="font-bold text-sm uppercase">Tiến độ & Thời gian</h4>
                                </div>
                                
                                <div className="p-6 border-b border-gray-100 text-center">
                                    <p className="text-xs text-gray-500 font-bold uppercase mb-2">Hạn trả kết quả</p>
                                    <p className="text-3xl font-black text-gray-900 mb-2">{record.data?.ngay_tra_kq || '---'}</p>
                                    <div className="inline-block bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full font-medium">
                                        Ngày nhận: {record.data?.ngay_nhan || '---'}
                                    </div>
                                </div>

                                <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                                    {history.length > 0 ? (
                                        <div className="space-y-6">
                                            {history.map((h: any, idx: number) => (
                                                <div key={idx} className="flex gap-4 relative">
                                                    {idx !== history.length - 1 && (
                                                        <div className="absolute left-[15px] top-8 bottom-[-24px] w-0.5 bg-gray-200"></div>
                                                    )}
                                                    <div className="w-8 h-8 rounded-full border-2 border-gray-200 bg-white flex items-center justify-center flex-shrink-0 z-10">
                                                        <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                                                    </div>
                                                    <div className="flex-1 pt-1">
                                                        <p className="text-sm font-bold text-gray-700 uppercase">{h.action && h.action.startsWith('Chuyển trạng thái: ') ? `Chuyển trạng thái: ${getStatusText(h.action.replace('Chuyển trạng thái: ', ''))}` : h.action}</p>
                                                        <div className="flex flex-col gap-1 mt-1 text-xs text-gray-500">
                                                            <span className="flex items-center gap-1"><User size={12} /> {getEmployeeName(h.user)} {h.assignedTo ? `> ${getEmployeeName(h.assignedTo)}` : ''}</span>
                                                            {h.content && <span className="flex items-start gap-1 p-2 bg-red-50 text-red-700 rounded border border-red-100">{h.content}</span>}
                                                            <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(h.timestamp).toLocaleString('vi-VN')}</span>
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
