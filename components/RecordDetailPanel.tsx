import React from 'react';
import { RecordFile, Employee } from '../types';
import { X, Printer, Edit, Trash2, Calendar, User, MapPin, FileText, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { formatDate, getNormalizedWard, getShortRecordType, isRecordOverdue, isRecordApproaching, toTitleCase } from '../utils/appHelpers';
import StatusBadge from './StatusBadge';

interface RecordDetailPanelProps {
    record: RecordFile;
    employees: Employee[];
    onClose: () => void;
    onEdit: (record: RecordFile) => void;
    onPrint: (record: RecordFile) => void;
    onDelete: (record: RecordFile) => void;
}

const RecordDetailPanel: React.FC<RecordDetailPanelProps> = ({
    record,
    employees,
    onClose,
    onEdit,
    onPrint,
    onDelete
}) => {
    const employee = employees.find(e => e.id === record.assignedTo);
    const isOverdue = isRecordOverdue(record);
    const isApproaching = isRecordApproaching(record);

    return (
        <div className="h-full flex flex-col bg-white border-l border-gray-200 shadow-2xl z-30 animate-slide-in-right">
            {/* Header / Toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                <div className="flex flex-col">
                    <h3 className="font-bold text-lg text-gray-800">{record.code}</h3>
                    <span className="text-xs text-gray-500 font-mono">ID: {record.id.slice(0, 8)}...</span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => onEdit(record)} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Chỉnh sửa">
                        <Edit size={18} />
                    </button>
                    <button onClick={() => onPrint(record)} className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="In hồ sơ">
                        <Printer size={18} />
                    </button>
                    <button onClick={() => onDelete(record)} className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa hồ sơ">
                        <Trash2 size={18} />
                    </button>
                    <div className="w-px h-6 bg-gray-300 mx-1"></div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Đóng">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Content Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
                
                {/* Status Badge */}
                <div className="flex justify-center">
                    <StatusBadge status={record.status} />
                </div>

                {/* 1. Progress Section */}
                <div className="space-y-3">
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b pb-1">
                        <Clock size={16} className="text-blue-600" /> Tiến trình thực hiện
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <span className="text-xs text-gray-500 block mb-1">Ngày tiếp nhận</span>
                            <div className="font-mono font-medium text-gray-800 flex items-center gap-2">
                                <Calendar size={14} className="text-blue-500" />
                                {formatDate(record.receivedDate)}
                            </div>
                        </div>
                        <div className={`p-3 rounded-lg border ${isOverdue ? 'bg-red-50 border-red-100' : isApproaching ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'}`}>
                            <span className={`text-xs block mb-1 ${isOverdue ? 'text-red-500 font-bold' : isApproaching ? 'text-orange-500 font-bold' : 'text-gray-500'}`}>Ngày hẹn trả</span>
                            <div className={`font-mono font-medium flex items-center gap-2 ${isOverdue ? 'text-red-700' : isApproaching ? 'text-orange-700' : 'text-gray-800'}`}>
                                {isOverdue ? <AlertCircle size={14} /> : <Calendar size={14} className="text-blue-500" />}
                                {formatDate(record.deadline)}
                            </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 col-span-2">
                            <span className="text-xs text-gray-500 block mb-1">Nhân viên thụ lý</span>
                            <div className="font-medium text-gray-800 flex items-center gap-2">
                                <User size={14} className="text-indigo-500" />
                                {employee ? employee.name : <span className="text-gray-400 italic">Chưa giao</span>}
                                {record.assignedDate && <span className="text-xs text-gray-400 font-mono ml-auto">({formatDate(record.assignedDate)})</span>}
                            </div>
                        </div>
                        {record.completedDate && (
                            <div className="bg-green-50 p-3 rounded-lg border border-green-100 col-span-2">
                                <span className="text-xs text-green-600 block mb-1 font-bold">Hoàn thành</span>
                                <div className="font-mono font-medium text-green-800 flex items-center gap-2">
                                    <CheckCircle size={14} />
                                    {formatDate(record.completedDate)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Owner Info Section */}
                <div className="space-y-3">
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b pb-1">
                        <User size={16} className="text-blue-600" /> Thông tin chủ hồ sơ
                    </h4>
                    <div className="bg-white rounded-lg space-y-3 text-sm">
                        <div>
                            <span className="text-xs text-gray-500 block">Họ và tên</span>
                            <div className="font-bold text-gray-800 text-base">{toTitleCase(record.customerName)}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-xs text-gray-500 block">Số điện thoại</span>
                                <div className="font-mono text-gray-800">{record.phoneNumber || '--'}</div>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 block">CCCD/CMND</span>
                                <div className="font-mono text-gray-800">{record.cccd || '--'}</div>
                            </div>
                        </div>
                        <div>
                            <span className="text-xs text-gray-500 block">Địa chỉ thường trú</span>
                            <div className="text-gray-800">{record.address || '--'}</div>
                        </div>
                    </div>
                </div>

                {/* 3. Land Info Section */}
                <div className="space-y-3">
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b pb-1">
                        <MapPin size={16} className="text-blue-600" /> Thông tin thửa đất
                    </h4>
                    <div className="bg-white rounded-lg space-y-3 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-blue-50 p-2 rounded border border-blue-100 text-center">
                                <span className="text-xs text-blue-500 block">Tờ bản đồ</span>
                                <div className="font-mono font-bold text-blue-800 text-lg">{record.mapSheet || '-'}</div>
                            </div>
                            <div className="bg-blue-50 p-2 rounded border border-blue-100 text-center">
                                <span className="text-xs text-blue-500 block">Số thửa</span>
                                <div className="font-mono font-bold text-blue-800 text-lg">{record.landPlot || '-'}</div>
                            </div>
                        </div>
                        <div>
                            <span className="text-xs text-gray-500 block">Địa chỉ thửa đất</span>
                            <div className="font-medium text-gray-800">{getNormalizedWard(record.ward)}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-xs text-gray-500 block">Diện tích</span>
                                <div className="font-mono text-gray-800">{record.area ? `${record.area} m²` : '--'}</div>
                            </div>
                            <div>
                                <span className="text-xs text-gray-500 block">Loại hồ sơ</span>
                                <div className="font-medium text-gray-800">{getShortRecordType(record.recordType)}</div>
                            </div>
                        </div>
                        {record.content && (
                            <div>
                                <span className="text-xs text-gray-500 block">Nội dung yêu cầu</span>
                                <div className="text-gray-800 bg-gray-50 p-2 rounded border border-gray-100 italic">
                                    "{record.content}"
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Notes */}
                {(record.notes || record.privateNotes) && (
                    <div className="space-y-3 pt-2">
                        <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 border-b pb-1">
                            <FileText size={16} className="text-gray-500" /> Ghi chú
                        </h4>
                        {record.notes && (
                            <div className="text-sm bg-yellow-50 p-3 rounded border border-yellow-100 text-yellow-800">
                                <span className="font-bold block text-xs uppercase mb-1">Ghi chú chung:</span>
                                {record.notes}
                            </div>
                        )}
                        {record.privateNotes && (
                            <div className="text-sm bg-red-50 p-3 rounded border border-red-100 text-red-800">
                                <span className="font-bold block text-xs uppercase mb-1">Ghi chú riêng (Admin):</span>
                                {record.privateNotes}
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    );
};

export default RecordDetailPanel;
