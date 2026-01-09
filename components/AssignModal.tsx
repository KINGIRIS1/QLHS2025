
import React, { useState, useMemo } from 'react';
import { Employee, RecordFile } from '../types';
import { X, Check, MapPin, User, Users } from 'lucide-react';

interface AssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (employeeId: string) => void;
  employees: Employee[];
  selectedRecords: RecordFile[];
}

const AssignModal: React.FC<AssignModalProps> = ({ isOpen, onClose, onConfirm, employees, selectedRecords }) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');

  // Lấy tên xã/phường nếu chỉ chọn 1 hồ sơ (để gợi ý)
  const targetWardName = selectedRecords.length === 1 ? selectedRecords[0].ward : null;

  // Logic chia nhóm nhân viên
  const { recommended, others } = useMemo(() => {
    // Nếu chọn nhiều hồ sơ khác nhau hoặc không có xã, tất cả vào nhóm 'others'
    if (!targetWardName) {
        return { recommended: [], others: employees };
    }

    const rec: Employee[] = [];
    const oth: Employee[] = [];

    employees.forEach(emp => {
        // Kiểm tra xem nhân viên có quản lý địa bàn này không (So sánh chuỗi)
        const isManaged = emp.managedWards && emp.managedWards.some(w => w === targetWardName);
        if (isManaged) {
            rec.push(emp);
        } else {
            oth.push(emp);
        }
    });

    return { recommended: rec, others: oth };
  }, [employees, targetWardName]);

  if (!isOpen) return null;

  // Component hiển thị một dòng nhân viên
  const EmployeeItem = ({ emp, isRecommended }: { emp: Employee, isRecommended?: boolean }) => (
    <div 
        onClick={() => setSelectedEmpId(emp.id)}
        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all mb-2 ${
            selectedEmpId === emp.id 
                ? 'bg-blue-50 border-blue-500 shadow-sm ring-1 ring-blue-200' 
                : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
        }`}
    >
        <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isRecommended ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                {emp.name.charAt(0).toUpperCase()}
            </div>
            <div>
                <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-800">{emp.name}</span>
                    {isRecommended && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200 font-medium">
                            Đúng tuyến
                        </span>
                    )}
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1">
                    {emp.department} 
                    {emp.managedWards.length > 0 && <span className="text-[10px] text-gray-400">• {emp.managedWards.length} địa bàn</span>}
                </div>
            </div>
        </div>
        {selectedEmpId === emp.id && <div className="bg-blue-600 text-white p-1 rounded-full"><Check size={14} /></div>}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] animate-fade-in-up">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b bg-gray-50 rounded-t-xl">
            <div>
                <h3 className="text-lg font-bold text-gray-800">Phân công xử lý</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                    {selectedRecords.length === 1 
                        ? `Đang giao hồ sơ: ${selectedRecords[0].code}` 
                        : `Đang giao ${selectedRecords.length} hồ sơ`
                    }
                </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-1 hover:bg-white rounded-full">
                <X size={20} />
            </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-y-auto bg-gray-100/50">
             {targetWardName && (
                 <div className="mb-4 bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-center gap-2 text-sm text-blue-800">
                    <MapPin size={16} className="text-blue-600" />
                    <span>Địa bàn hồ sơ: <strong>{targetWardName}</strong></span>
                 </div>
             )}

             {/* PHẦN 1: NHÂN VIÊN PHỤ TRÁCH ĐỊA BÀN */}
             {recommended.length > 0 && (
                 <div className="mb-5">
                     <div className="flex items-center gap-2 mb-2 text-xs font-bold text-green-700 uppercase tracking-wide">
                        <MapPin size={14} />
                        1. Nhân viên phụ trách địa bàn ({recommended.length})
                     </div>
                     <div className="space-y-1">
                        {recommended.map(emp => (
                            <EmployeeItem key={emp.id} emp={emp} isRecommended={true} />
                        ))}
                     </div>
                 </div>
             )}

             {/* PHẦN 2: NHÂN VIÊN NGOÀI ĐỊA BÀN */}
             <div>
                 <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {recommended.length > 0 ? <Users size={14} /> : <User size={14} />}
                    {recommended.length > 0 ? `2. Nhân viên khác (${others.length})` : `Danh sách nhân viên (${others.length})`}
                 </div>
                 <div className="space-y-1">
                    {others.length > 0 ? (
                        others.map(emp => (
                            <EmployeeItem key={emp.id} emp={emp} />
                        ))
                    ) : (
                        <div className="text-center p-4 text-gray-400 text-sm italic border border-dashed border-gray-300 rounded-lg">
                            Không có nhân viên nào khác.
                        </div>
                    )}
                 </div>
             </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white flex justify-end gap-3 rounded-b-xl">
            <button 
                onClick={onClose} 
                className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
            >
                Hủy bỏ
            </button>
            <button 
                onClick={() => selectedEmpId && onConfirm(selectedEmpId)}
                disabled={!selectedEmpId}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold shadow-sm transition-transform active:scale-95"
            >
                Xác nhận giao
            </button>
        </div>
      </div>
    </div>
  );
};

export default AssignModal;
