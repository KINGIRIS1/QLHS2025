
import React from 'react';
import { RecordFile, Employee } from '../types';
import { STATUS_LABELS } from '../constants';
import StatusBadge from './StatusBadge';
import { X, MapPin, Calendar, FileText, User, Info, Phone, Lock, ShieldAlert } from 'lucide-react';

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: RecordFile | null;
  employees: Employee[];
}

const DetailModal: React.FC<DetailModalProps> = ({ isOpen, onClose, record, employees }) => {
  if (!isOpen || !record) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '---';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  const getEmployeeName = (id?: string) => {
    if (!id) return 'Chưa giao';
    const emp = employees.find(e => e.id === id);
    return emp ? `${emp.name} (${emp.department})` : 'Không xác định';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col animate-fade-in-up">
        
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-gray-100 bg-gray-50/50">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                {record.code}
              </span>
              <StatusBadge status={record.status} />
            </div>
            <h2 className="text-xl font-bold text-gray-800">{record.recordType}</h2>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* 1. Thông tin khách hàng */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 border-l-4 border-blue-500 pl-2">
              <User size={18} className="text-blue-500" />
              Thông tin chủ hồ sơ
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">Chủ sử dụng</label>
                <p className="text-base font-medium text-gray-900 mt-1">{record.customerName}</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 uppercase font-semibold">Số điện thoại</label>
                <div className="flex items-center gap-2 mt-1">
                  <Phone size={14} className="text-gray-400" />
                  <p className="text-base font-medium text-gray-900">{record.phoneNumber || '---'}</p>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Thông tin địa chính */}
          <section>
             <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 border-l-4 border-green-500 pl-2">
              <MapPin size={18} className="text-green-500" />
              Thông tin địa chính
            </h3>
            <div className="bg-gray-50 p-5 rounded-lg border border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-8">
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs text-gray-500 mb-1 block">Xã / Phường</label>
                <div className="font-semibold text-gray-800">{record.ward || '---'}</div>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs text-gray-500 mb-1 block">Khu vực (Nhóm)</label>
                <div className="font-semibold text-gray-800">{record.group || '---'}</div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tờ bản đồ</label>
                <div className="font-mono font-bold text-gray-800 bg-white inline-block px-2 py-0.5 rounded border">{record.mapSheet || '-'}</div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Thửa đất</label>
                <div className="font-mono font-bold text-gray-800 bg-white inline-block px-2 py-0.5 rounded border">{record.landPlot || '-'}</div>
              </div>
            </div>
          </section>

           {/* 3. Thông tin kỹ thuật & Nội dung */}
           <section>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                    <div>
                        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 border-l-4 border-purple-500 pl-2">
                            <FileText size={18} className="text-purple-500" />
                            Nội dung chi tiết
                        </h3>
                        <div className="bg-white p-4 rounded-lg border border-gray-200 min-h-[100px]">
                            <p className="text-gray-700 whitespace-pre-wrap">{record.content || 'Không có ghi chú chi tiết.'}</p>
                            
                            <div className="mt-4 pt-4 border-t flex gap-6">
                                <div>
                                    <span className="text-xs text-gray-500 block">Số trích đo</span>
                                    <span className="font-medium">{record.measurementNumber || '---'}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500 block">Số trích lục</span>
                                    <span className="font-medium">{record.excerptNumber || '---'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Ghi chú riêng tư (Chỉ hiển thị nếu có) */}
                    {record.privateNotes && (
                      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 shadow-inner">
                        <div className="flex items-center gap-2 mb-2 text-yellow-800 font-bold text-sm">
                            <Lock size={16} />
                            <span>Ghi chú nội bộ</span>
                            <span className="text-[10px] font-normal px-1.5 py-0.5 bg-yellow-200 rounded-full border border-yellow-300">Chỉ quản trị viên</span>
                        </div>
                        <p className="text-yellow-900 text-sm whitespace-pre-wrap italic">
                            "{record.privateNotes}"
                        </p>
                      </div>
                    )}
                </div>

                <div className="md:col-span-1">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 uppercase tracking-wide mb-4 border-l-4 border-orange-500 pl-2">
                        <Calendar size={18} className="text-orange-500" />
                        Tiến độ & Thời gian
                    </h3>
                    <div className="space-y-4 bg-orange-50 p-4 rounded-lg border border-orange-100">
                        <div className="flex justify-between items-center border-b border-orange-200 pb-2">
                            <span className="text-sm text-gray-600">Ngày tiếp nhận</span>
                            <span className="font-medium text-gray-900">{formatDate(record.receivedDate)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-orange-200 pb-2">
                            <span className="text-sm text-gray-600">Hẹn trả kết quả</span>
                            <span className="font-bold text-blue-700">{formatDate(record.deadline)}</span>
                        </div>
                        <div className="flex justify-between items-center border-b border-orange-200 pb-2">
                            <span className="text-sm text-gray-600">Ngày giao NV</span>
                            <span className="font-medium text-gray-900">{formatDate(record.assignedDate)}</span>
                        </div>
                         <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Ngày hoàn thành</span>
                            <span className="font-medium text-green-700">{formatDate(record.completedDate)}</span>
                        </div>
                    </div>

                    <div className="mt-4">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Người xử lý</h4>
                        <div className="flex items-center gap-2 p-2 bg-gray-100 rounded text-sm font-medium text-gray-700">
                            <User size={14} />
                            {getEmployeeName(record.assignedTo)}
                        </div>
                    </div>
                </div>
            </div>
           </section>

           {/* Footer Info */}
           {record.exportBatch && (
             <div className="bg-green-50 p-3 rounded text-center text-sm text-green-800 border border-green-200 flex items-center justify-center gap-2">
                <Info size={16} />
                Hồ sơ đã được xuất danh sách <strong>Đợt {record.exportBatch}</strong> vào ngày {formatDate(record.exportDate)}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default DetailModal;