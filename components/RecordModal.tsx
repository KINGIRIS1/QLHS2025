
import React, { useState, useEffect } from 'react';
import { RecordFile, RecordStatus, Employee, User, UserRole } from '../types';
import { GROUPS, RECORD_TYPES } from '../constants';
import { X, Save, Lock } from 'lucide-react';

interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (record: Omit<RecordFile, 'id' | 'status'> & { id?: string, status?: RecordStatus }) => void;
  initialData?: RecordFile | null;
  employees: Employee[]; // Nhận danh sách nhân viên từ App
  currentUser: User; // Nhận thông tin user để phân quyền
  wards: string[]; // Danh sách xã phường động
}

const RecordModal: React.FC<RecordModalProps> = ({ isOpen, onClose, onSubmit, initialData, employees, currentUser, wards }) => {
  const [formData, setFormData] = useState<Partial<RecordFile>>({});

  // Cả Admin và Subadmin đều có quyền chỉnh sửa ghi chú nội bộ
  const hasAdminRights = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUBADMIN;

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      // Reset form for new entry
      setFormData({
        code: `HS-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000)}`,
        customerName: '',
        phoneNumber: '',
        content: '',
        receivedDate: new Date().toISOString().split('T')[0],
        deadline: '',
        assignedTo: '',
        group: GROUPS[0],
        ward: '',
        landPlot: '',
        mapSheet: '',
        recordType: RECORD_TYPES[0],
        measurementNumber: '',
        excerptNumber: '',
        privateNotes: ''
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData as any);
    onClose();
  };

  const handleChange = (field: keyof RecordFile, value: any) => {
      setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 flex justify-between items-center p-5 border-b shadow-sm">
          <h2 className="text-xl font-bold text-gray-800">
            {initialData ? 'Cập nhật hồ sơ' : 'Tiếp nhận hồ sơ mới'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Thông tin chung */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <h3 className="text-sm font-semibold text-blue-800 mb-3 uppercase tracking-wide">Thông tin hồ sơ</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mã hồ sơ <span className="text-red-500">*</span></label>
                <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={formData.code}
                    onChange={(e) => handleChange('code', e.target.value)}
                />
                </div>
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại hồ sơ</label>
                <input
                    list="record-types-list"
                    type="text"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={formData.recordType || ''}
                    onChange={(e) => handleChange('recordType', e.target.value)}
                    placeholder="Chọn hoặc nhập loại hồ sơ..."
                />
                <datalist id="record-types-list">
                    {RECORD_TYPES.map(t => <option key={t} value={t} />)}
                </datalist>
                </div>
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày tiếp nhận</label>
                <input
                    type="date"
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={formData.receivedDate}
                    onChange={(e) => handleChange('receivedDate', e.target.value)}
                />
                </div>
                <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày hẹn trả <span className="text-red-500">*</span></label>
                <input
                    type="date"
                    required
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    value={formData.deadline}
                    onChange={(e) => handleChange('deadline', e.target.value)}
                />
                </div>
            </div>
          </div>

          {/* Thông tin khách hàng & Địa chính */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
             <h3 className="text-sm font-semibold text-blue-800 mb-3 uppercase tracking-wide">Chủ sử dụng & Vị trí đất</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Chủ sử dụng <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            required
                            placeholder="Nguyễn Văn A..."
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={formData.customerName}
                            onChange={(e) => handleChange('customerName', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
                        <input
                            type="text"
                            placeholder="09xxx..."
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={formData.phoneNumber || ''}
                            onChange={(e) => handleChange('phoneNumber', e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nhóm (Khu vực)</label>
                    <select
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        value={formData.group || GROUPS[0]}
                        onChange={(e) => handleChange('group', e.target.value)}
                    >
                        {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Xã / Phường</label>
                    <input
                        list="wards-list"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        value={formData.ward || ''}
                        onChange={(e) => handleChange('ward', e.target.value)}
                        placeholder="Nhập hoặc chọn..."
                    />
                    <datalist id="wards-list">
                        {wards.map(w => <option key={w} value={w} />)}
                    </datalist>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tờ bản đồ số</label>
                        <input
                            type="text"
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={formData.mapSheet || ''}
                            onChange={(e) => handleChange('mapSheet', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Thửa đất số</label>
                        <input
                            type="text"
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={formData.landPlot || ''}
                            onChange={(e) => handleChange('landPlot', e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Số trích đo</label>
                        <input
                            type="text"
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={formData.measurementNumber || ''}
                            onChange={(e) => handleChange('measurementNumber', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Số trích lục</label>
                        <input
                            type="text"
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={formData.excerptNumber || ''}
                            onChange={(e) => handleChange('excerptNumber', e.target.value)}
                        />
                    </div>
                </div>
             </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung chi tiết</label>
            <textarea
              rows={2}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={formData.content || ''}
              onChange={(e) => handleChange('content', e.target.value)}
              placeholder="Ghi chú thêm về hồ sơ..."
            />
          </div>

          {/* Ghi chú riêng tư: Chỉ Admin & Subadmin mới được Sửa */}
          {hasAdminRights && (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2 mb-2">
                    <Lock size={16} className="text-yellow-600" />
                    <label className="text-sm font-medium text-yellow-800">Ghi chú nội bộ (Riêng tư - Admin/Subadmin)</label>
                </div>
                <textarea
                    rows={2}
                    className="w-full border border-yellow-300 rounded-md px-3 py-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none bg-white"
                    value={formData.privateNotes || ''}
                    onChange={(e) => handleChange('privateNotes', e.target.value)}
                    placeholder="Thông tin chỉ dành cho nhân viên xử lý và quản trị..."
                />
            </div>
          )}

          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Giao nhân viên xử lý</label>
            <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={formData.assignedTo || ''}
                onChange={(e) => handleChange('assignedTo', e.target.value)}
            >
                <option value="">-- Chưa giao --</option>
                {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                        {emp.name} - {emp.department} {emp.managedWards.includes(formData.ward || '') ? '(Phụ trách)' : ''}
                    </option>
                ))}
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-3 sticky bottom-0 bg-white border-t border-gray-100 py-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm font-medium"
            >
              <Save size={18} />
              {initialData ? 'Cập nhật' : 'Lưu hồ sơ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordModal;
