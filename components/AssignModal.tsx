
import React, { useState, useEffect, useMemo } from 'react';
import { Employee, RecordFile } from '../types';
import { X, Check, MapPin } from 'lucide-react';

interface AssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (employeeId: string) => void;
  employees: Employee[];
  selectedRecords: RecordFile[];
}

const AssignModal: React.FC<AssignModalProps> = ({ isOpen, onClose, onConfirm, employees, selectedRecords }) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');

  // Logic sắp xếp nhân viên:
  // Nếu chỉ giao 1 hồ sơ, nhân viên quản lý xã/phường đó sẽ được đưa lên đầu.
  const sortedEmployees = useMemo(() => {
    if (selectedRecords.length !== 1) return employees;
    
    const targetWard = selectedRecords[0].ward;
    if (!targetWard) return employees;

    return [...employees].sort((a, b) => {
        const aHas = a.managedWards.includes(targetWard);
        const bHas = b.managedWards.includes(targetWard);
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        return 0;
    });
  }, [employees, selectedRecords]);

  const targetWardName = selectedRecords.length === 1 ? selectedRecords[0].ward : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b">
            <div>
                <h3 className="text-lg font-bold text-gray-800">Giao việc</h3>
                <p className="text-sm text-gray-500">Đang chọn {selectedRecords.length} hồ sơ</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
            </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
             <div className="mb-2 text-sm text-gray-600">
                {targetWardName ? (
                    <span className="flex items-center gap-1 text-blue-600 bg-blue-50 p-2 rounded-md">
                        <MapPin size={14} /> Địa bàn hồ sơ: <strong>{targetWardName}</strong>
                    </span>
                ) : (
                    <span>Chọn nhân viên để xử lý các hồ sơ đã chọn.</span>
                )}
             </div>

             <div className="space-y-2 mt-3">
                {sortedEmployees.map((emp) => {
                    const isRecommended = targetWardName && emp.managedWards.includes(targetWardName);
                    return (
                        <div 
                            key={emp.id}
                            onClick={() => setSelectedEmpId(emp.id)}
                            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                                selectedEmpId === emp.id 
                                    ? 'bg-blue-50 border-blue-500 shadow-sm' 
                                    : 'bg-white border-gray-200 hover:border-blue-300'
                            }`}
                        >
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-800">{emp.name}</span>
                                    {isRecommended && (
                                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium border border-green-200">
                                            Phụ trách địa bàn
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-gray-500">{emp.department}</div>
                            </div>
                            {selectedEmpId === emp.id && <Check size={18} className="text-blue-600" />}
                        </div>
                    );
                })}
             </div>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-lg">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md text-sm">Hủy</button>
            <button 
                onClick={() => selectedEmpId && onConfirm(selectedEmpId)}
                disabled={!selectedEmpId}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
                Xác nhận giao
            </button>
        </div>
      </div>
    </div>
  );
};

export default AssignModal;
