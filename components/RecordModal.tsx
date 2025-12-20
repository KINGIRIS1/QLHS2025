
import React, { useState, useEffect } from 'react';
import { RecordFile, RecordStatus, Employee, User, UserRole } from '../types';
import { GROUPS, EXTENDED_RECORD_TYPES, STATUS_LABELS } from '../constants';
import { X, Save, Lock, User as UserIcon, MapPin, FileText, Calendar } from 'lucide-react';

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (record: Omit<RecordFile, 'id' | 'status'> & { id?: string, status?: RecordStatus }) => void;
  initialData?: RecordFile | null;
  employees: Employee[];
  currentUser: User;
  wards: string[];
}

const RecordModal: React.FC<RecordModalProps> = ({ isOpen, onClose, onSubmit, initialData, employees, currentUser, wards }) => {
  // KHỞI TẠO GIÁ TRỊ MẶC ĐỊNH ĐẦY ĐỦ ĐỂ TRÁNH LỖI UNCONTROLLED INPUT
  const defaultState: Partial<RecordFile> = {
    code: '', 
    customerName: '', 
    phoneNumber: '', 
    cccd: '',
    content: '', 
    otherDocs: '',
    receivedDate: new Date().toISOString().split('T')[0],
    deadline: '',
    assignedTo: '',
    group: GROUPS[0],
    ward: '', 
    landPlot: '', 
    mapSheet: '', 
    area: 0, 
    address: '',
    recordType: EXTENDED_RECORD_TYPES[0], // Sử dụng loại mặc định từ danh sách mở rộng
    measurementNumber: '', 
    excerptNumber: '',
    privateNotes: '', 
    authorizedBy: '', 
    authDocType: ''
  };

  const [formData, setFormData] = useState<Partial<RecordFile>>(defaultState);

  const hasAdminRights = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN;

  useEffect(() => {
    if (isOpen) {
        if (initialData) {
            // Nếu đang sửa, load dữ liệu cũ
            setFormData(initialData);
        } else {
            // Nếu thêm mới, reset về mặc định và tạo mã giả lập
            setFormData({
                ...defaultState,
                code: `HS-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`
            });
        }
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalData = { ...formData };
    // Logic tự động set ngày hoàn thành nếu chọn WITHDRAWN
    if (finalData.status === RecordStatus.WITHDRAWN && !finalData.completedDate) {
        finalData.completedDate = new Date().toISOString().split('T')[0];
    }

    onSubmit(finalData as any);
    onClose();
  };

  const handleChange = (field: keyof RecordFile, value: any) => {
      setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Helper để đảm bảo value không bao giờ là undefined
  const val = (v: any) => v === undefined || v === null ? '' : v;

  return (
    // Tăng z-index lên 100 để đảm bảo nằm trên mọi thành phần khác
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col animate-fade-in-up">
        {/* HEADER */}
        <div className="flex justify-between items-center p-5 border-b bg-gray-50 rounded-t-xl shrink-0">
          <h2 className="text-xl font-bold text-gray-800">
            {initialData ? 'Cập nhật thông tin hồ sơ' : 'Tiếp nhận hồ sơ mới'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        {/* BODY - SCROLLABLE */}
        <div className="overflow-y-auto p-6 flex-1 bg-gray-100">
            <form id="record-form" onSubmit={handleSubmit} className="space-y-6">
                
                {/* 1. THÔNG TIN CHUNG & THỜI GIAN */}
                <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2">
                        <Calendar size={16} /> Thông tin chung
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-1">
                            <label className="block text-xs font-bold text-gray-700 mb-1">Mã hồ sơ <span className="text-red-500">*</span></label>
                            <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 font-bold text-blue-700" value={val(formData.code)} onChange={(e) => handleChange('code', e.target.value)} />
                        </div>
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-gray-700 mb-1">Loại hồ sơ</label>
                            <select 
                                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white" 
                                value={val(formData.recordType)} 
                                onChange={(e) => handleChange('recordType', e.target.value)}
                            >
                                <option value="">-- Chọn loại hồ sơ --</option>
                                {/* SỬ DỤNG DANH SÁCH EXTENDED_RECORD_TYPES */}
                                {EXTENDED_RECORD_TYPES.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>

                        {/* CÁC TRƯỜNG CHỈ ADMIN/SUBADMIN MỚI THẤY VÀ SỬA ĐƯỢC */}
                        {hasAdminRights && (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Ngày nhận</label>
                                    <input type="date" required className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.receivedDate)} onChange={(e) => handleChange('receivedDate', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Hẹn trả <span className="text-red-500">*</span></label>
                                    <input type="date" required className="w-full border border-gray-300 rounded-md px-3 py-2 font-semibold text-red-600 bg-red-50" value={val(formData.deadline)} onChange={(e) => handleChange('deadline', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Ngày giao NV</label>
                                    <input type="date" className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.assignedDate)} onChange={(e) => handleChange('assignedDate', e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Trạng thái</label>
                                    <select className="w-full border border-gray-300 rounded-md px-3 py-2 bg-yellow-50 font-medium" value={val(formData.status)} onChange={(e) => handleChange('status', e.target.value)}>
                                        {Object.values(RecordStatus).map(s => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
                                    </select>
                                </div>
                                {/* HIỂN THỊ THÊM NGÀY XONG NẾU TRẠNG THÁI LÀ WITHDRAWN HOẶC HANDOVER */}
                                {(formData.status === RecordStatus.HANDOVER || formData.status === RecordStatus.WITHDRAWN) && (
                                    <div>
                                        <label className="block text-xs font-bold text-green-700 mb-1">{formData.status === RecordStatus.WITHDRAWN ? 'Ngày rút hồ sơ' : 'Ngày hoàn thành'}</label>
                                        <input type="date" className="w-full border border-green-300 rounded-md px-3 py-2 bg-green-50 font-semibold text-green-800" value={val(formData.completedDate)} onChange={(e) => handleChange('completedDate', e.target.value)} />
                                    </div>
                                )}
                            </>
                        )}
                        
                        {!hasAdminRights && (
                            <div className="col-span-full p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 italic text-center">
                                * Thông tin ngày tháng và trạng thái chỉ Admin/Subadmin được phép chỉnh sửa tại đây.
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. CHỦ SỬ DỤNG & ỦY QUYỀN */}
                <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2">
                        <UserIcon size={16} /> Chủ sử dụng & Ủy quyền
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-700 mb-1">Tên chủ sử dụng <span className="text-red-500">*</span></label>
                            <input type="text" required className="w-full border border-gray-300 rounded-md px-3 py-2 font-medium" value={val(formData.customerName)} onChange={(e) => handleChange('customerName', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Số điện thoại</label>
                            <input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.phoneNumber)} onChange={(e) => handleChange('phoneNumber', e.target.value)} />
                        </div>
                        
                        <div className="md:col-span-3 grid grid-cols-2 gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase">Người được ủy quyền</label>
                                <input type="text" className="w-full border border-gray-300 rounded px-2 py-1 text-sm" value={val(formData.authorizedBy)} onChange={(e) => handleChange('authorizedBy', e.target.value)} placeholder="Họ tên..." />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase">Loại giấy tờ</label>
                                <select 
                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white" 
                                    value={val(formData.authDocType)} 
                                    onChange={(e) => handleChange('authDocType', e.target.value)}
                                >
                                    <option value="">-- Chọn giấy tờ --</option>
                                    <option value="Hợp đồng ủy quyền">Hợp đồng ủy quyền</option>
                                    <option value="Giấy ủy quyền">Giấy ủy quyền</option>
                                    <option value="Văn bản ủy quyền">Văn bản ủy quyền</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. THÔNG TIN THỬA ĐẤT */}
                <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2">
                        <MapPin size={16} /> Vị trí & Thửa đất
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Xã / Phường</label>
                            <select 
                                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white" 
                                value={val(formData.ward)} 
                                onChange={(e) => handleChange('ward', e.target.value)}
                            >
                                <option value="">-- Chọn Xã/Phường --</option>
                                {wards.map(w => (
                                    <option key={w} value={w}>{w}</option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold text-gray-700 mb-1">Địa chỉ chi tiết</label>
                            <input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.address)} onChange={(e) => handleChange('address', e.target.value)} placeholder="Số nhà, đường, ấp..." />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Khu vực (Nhóm)</label>
                            <select className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.group)} onChange={(e) => handleChange('group', e.target.value)}>
                                {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Tờ bản đồ</label>
                            <input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2 text-center font-mono" value={val(formData.mapSheet)} onChange={(e) => handleChange('mapSheet', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Thửa đất</label>
                            <input type="text" className="w-full border border-gray-300 rounded-md px-3 py-2 text-center font-mono" value={val(formData.landPlot)} onChange={(e) => handleChange('landPlot', e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Diện tích (m2)</label>
                            <input type="number" className="w-full border border-gray-300 rounded-md px-3 py-2 text-right" value={formData.area || 0} onChange={(e) => handleChange('area', parseFloat(e.target.value))} />
                        </div>
                    </div>
                </div>

                {/* 4. NỘI DUNG & KỸ THUẬT */}
                <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-sm font-bold text-blue-800 uppercase mb-4 flex items-center gap-2 border-b pb-2">
                        <FileText size={16} /> Nội dung & Kỹ thuật
                    </h3>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Nội dung yêu cầu</label>
                                <textarea rows={3} className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.content)} onChange={(e) => handleChange('content', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Giấy tờ kèm theo</label>
                                <textarea rows={3} className="w-full border border-gray-300 rounded-md px-3 py-2" value={val(formData.otherDocs)} onChange={(e) => handleChange('otherDocs', e.target.value)} placeholder="GCN QSDĐ, CMND, Hộ khẩu..." />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-3 rounded border border-gray-200">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Số Trích đo</label>
                                <input type="text" className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" value={val(formData.measurementNumber)} onChange={(e) => handleChange('measurementNumber', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Số Trích lục</label>
                                <input type="text" className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" value={val(formData.excerptNumber)} onChange={(e) => handleChange('excerptNumber', e.target.value)} />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Giao nhân viên xử lý</label>
                                <select className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm" value={val(formData.assignedTo)} onChange={(e) => handleChange('assignedTo', e.target.value)}>
                                    <option value="">-- Chưa giao --</option>
                                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} - {emp.department}</option>)}
                                </select>
                            </div>
                        </div>

                        {hasAdminRights && (
                            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                <div className="flex items-center gap-2 mb-1">
                                    <Lock size={14} className="text-yellow-600" />
                                    <label className="text-xs font-bold text-yellow-800 uppercase">Ghi chú nội bộ (Admin/Subadmin)</label>
                                </div>
                                <textarea rows={2} className="w-full border border-yellow-300 rounded-md px-3 py-2 bg-white text-sm" value={val(formData.privateNotes)} onChange={(e) => handleChange('privateNotes', e.target.value)} />
                            </div>
                        )}
                    </div>
                </div>

            </form>
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 shrink-0 rounded-b-xl">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-200 font-medium transition-colors">
              Hủy bỏ
            </button>
            <button type="submit" form="record-form" className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md font-bold transition-transform active:scale-95">
              <Save size={18} />
              {initialData ? 'Cập nhật hồ sơ' : 'Lưu hồ sơ mới'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default RecordModal;
