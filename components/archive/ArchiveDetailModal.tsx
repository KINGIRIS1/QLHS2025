import React from 'react';
import { ArchiveRecord } from '../../services/apiArchive';
import { X, Clock, User, FileText, Calendar, CheckCircle2 } from 'lucide-react';
import { STATUS_LABELS, STATUS_COLORS } from '../../constants';
import { RecordStatus } from '../../types';

interface ArchiveDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: ArchiveRecord | null;
    getEmployeeName: (id: string) => string;
}

const ArchiveDetailModal: React.FC<ArchiveDetailModalProps> = ({ isOpen, onClose, record, getEmployeeName }) => {
    if (!isOpen || !record) return null;

    const history = record.data?.history || [];

    // Helper to map Archive status to RecordStatus enum for labels/colors
    const mapStatus = (s: string): RecordStatus => {
        switch(s) {
            case 'draft': return RecordStatus.RECEIVED;
            case 'assigned': return RecordStatus.ASSIGNED;
            case 'executed': return RecordStatus.COMPLETED_WORK;
            case 'pending_sign': return RecordStatus.PENDING_SIGN;
            case 'signed': return RecordStatus.SIGNED;
            case 'completed': return RecordStatus.RETURNED; // Or Handover
            default: return RecordStatus.RECEIVED;
        }
    };

    const currentStatus = mapStatus(record.status);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] animate-fade-in-up">
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">Chi tiết hồ sơ</h3>
                            <p className="text-sm text-gray-500">{record.so_hieu}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex gap-8">
                    {/* Left: Info */}
                    <div className="flex-1 space-y-6">
                        <div>
                            <h4 className="text-sm font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                                <FileText size={16}/> Thông tin chung
                            </h4>
                            <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-gray-500 block">Số hiệu</label>
                                        <div className="font-bold text-gray-800">{record.so_hieu}</div>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 block">Ngày nhận</label>
                                        <div className="font-medium text-gray-800">{record.ngay_thang ? record.ngay_thang.split('-').reverse().join('/') : '-'}</div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block">Nơi nhận / Gửi (Chủ sử dụng)</label>
                                    <div className="font-bold text-blue-700">{record.noi_nhan_gui}</div>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block">Trích yếu / Nội dung</label>
                                    <div className="font-medium text-gray-700">{record.trich_yeu}</div>
                                </div>
                                {record.type === 'saoluc' && (
                                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200 mt-2">
                                        <div>
                                            <label className="text-xs text-gray-500 block">Xã/Phường</label>
                                            <div className="font-medium">{record.data?.xa_phuong || '-'}</div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block">Tờ</label>
                                            <div className="font-medium">{record.data?.to_ban_do || '-'}</div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 block">Thửa</label>
                                            <div className="font-medium">{record.data?.thua_dat || '-'}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-sm font-bold text-gray-500 uppercase mb-3 flex items-center gap-2">
                                <User size={16}/> Phân công & Trạng thái
                            </h4>
                            <div className="bg-blue-50 rounded-xl p-4 space-y-3 border border-blue-100">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs text-gray-500">Trạng thái hiện tại</label>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_COLORS[currentStatus]}`}>
                                        {STATUS_LABELS[currentStatus]}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <label className="text-xs text-gray-500">Người thực hiện</label>
                                    <div className="font-bold text-indigo-700 flex items-center gap-1">
                                        <User size={14}/>
                                        {record.data?.assigned_to ? getEmployeeName(record.data.assigned_to) : 'Chưa giao'}
                                    </div>
                                </div>
                                {record.data?.hen_tra && (
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs text-gray-500">Hẹn trả</label>
                                        <div className="font-bold text-purple-600">{record.data.hen_tra.split('-').reverse().join('/')}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Timeline */}
                    <div className="w-80 shrink-0 border-l border-gray-100 pl-8">
                        <h4 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                            <Clock size={16}/> Tiến độ xử lý
                        </h4>
                        
                        <div className="space-y-6 relative">
                            {/* Line */}
                            <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-100 -z-10"></div>

                            {history.length > 0 ? history.map((h: any, idx: number) => (
                                <div key={idx} className="flex gap-3 relative">
                                    <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center border-2 ${idx === history.length - 1 ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-400'}`}>
                                        <CheckCircle2 size={12} />
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-400 mb-0.5">
                                            {new Date(h.timestamp).toLocaleString('vi-VN')}
                                        </div>
                                        <div className="font-bold text-gray-800 text-sm">
                                            {h.status ? STATUS_LABELS[mapStatus(h.status)] : h.action}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                            Bởi: <span className="font-medium text-gray-700">{h.user || 'Hệ thống'}</span>
                                        </div>
                                        {h.note && (
                                            <div className="text-xs text-gray-500 italic mt-1 bg-gray-50 p-2 rounded">
                                                "{h.note}"
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )) : (
                                <div className="text-sm text-gray-400 italic">Chưa có lịch sử ghi nhận.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ArchiveDetailModal;
