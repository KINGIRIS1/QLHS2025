
import React, { useState, useMemo } from 'react';
import { Employee, RecordFile } from '../types';
import { X, Check, MapPin, User, Users, Search } from 'lucide-react';

interface AssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (employeeId: string) => void;
  employees: Employee[];
  selectedRecords: RecordFile[];
}

const AssignModal: React.FC<AssignModalProps> = ({ isOpen, onClose, onConfirm, employees, selectedRecords }) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Lấy tên xã/phường nếu chỉ chọn 1 hồ sơ (để gợi ý)
  const targetWardName = selectedRecords.length === 1 ? selectedRecords[0].ward : null;

  // Logic chia nhóm nhân viên
  const { recommended, others } = useMemo(() => {
    // Lọc theo tìm kiếm trước
    const filteredEmployees = employees.filter(e => 
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.department.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Nếu không có địa bàn cụ thể, tất cả vào nhóm others
    if (!targetWardName) {
        return { recommended: [], others: filteredEmployees };
    }

    const rec: Employee[] = [];
    const oth: Employee[] = [];

    filteredEmployees.forEach(emp => {
        // Kiểm tra xem nhân viên có quản lý địa bàn này không
        const isManaged = emp.managedWards && emp.managedWards.some(w => w === targetWardName);
        if (isManaged) {
            rec.push(emp);
        } else {
            oth.push(emp);
        }
    });

    return { recommended: rec, others: oth };
  }, [employees, targetWardName, searchTerm]);

  if (!isOpen) return null;

  // Component hiển thị một dòng nhân viên (Compact style cho grid)
  const EmployeeItem = ({ emp, isRecommended }: { emp: Employee, isRecommended?: boolean }) => (
    <div 
        onClick={() => setSelectedEmpId(emp.id)}
        className={`relative flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all group h-full ${
            selectedEmpId === emp.id 
                ? 'bg-blue-50 border-blue-500 shadow-sm ring-1 ring-blue-200' 
                : 'bg-white border-gray-200 hover:border-blue-400 hover:shadow-md'
        }`}
    >
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isRecommended ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {emp.name.charAt(0).toUpperCase()}
        </div>
        
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
                <span className={`font-bold text-sm truncate ${selectedEmpId === emp.id ? 'text-blue-700' : 'text-gray-800'}`}>
                    {emp.name}
                </span>
                {selectedEmpId === emp.id && <Check size={14} className="text-blue-600 shrink-0" />}
            </div>
            
            <div className="text-xs text-gray-500 truncate mb-1">
                {emp.department}
            </div>

            {/* Hiển thị tags địa bàn nếu có (chỉ hiện tối đa 2 cái) */}
            {emp.managedWards && emp.managedWards.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                    {emp.managedWards.slice(0, 2).map((w, idx) => (
                        <span key={idx} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200 truncate max-w-[80px]">
                            {w}
                        </span>
                    ))}
                    {emp.managedWards.length > 2 && (
                        <span className="text-[9px] text-gray-400">+{emp.managedWards.length - 2}</span>
                    )}
                </div>
            )}
        </div>

        {isRecommended && (
            <div className="absolute top-2 right-2">
                <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
            </div>
        )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl flex flex-col h-[85vh] animate-fade-in-up overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b bg-gray-50 shrink-0">
            <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                    <Users size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Phân công xử lý hồ sơ</h3>
                    <p className="text-sm text-gray-500">
                        {selectedRecords.length === 1 
                            ? `Đang giao: ${selectedRecords[0].code} - ${selectedRecords[0].customerName}` 
                            : `Đang giao ${selectedRecords.length} hồ sơ được chọn`
                        }
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                        type="text" 
                        placeholder="Tìm nhân viên..." 
                        className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg">
                    <X size={20} />
                </button>
            </div>
        </div>

        {/* Body - Flex Layout */}
        <div className="flex-1 flex overflow-hidden">
             
             {/* LEFT SIDE: RECOMMENDED (30-35%) */}
             <div className="w-[320px] bg-blue-50/50 border-r border-blue-100 flex flex-col shrink-0">
                 <div className="p-4 border-b border-blue-100 bg-blue-50/80 sticky top-0 backdrop-blur-sm z-10">
                     <div className="flex items-center gap-2 text-sm font-bold text-blue-800 uppercase tracking-wide">
                        <MapPin size={16} />
                        Đúng Tuyến ({recommended.length})
                     </div>
                     {targetWardName && (
                        <div className="text-xs text-blue-600 mt-1 font-medium bg-white px-2 py-1 rounded border border-blue-200 inline-block">
                            Địa bàn: {targetWardName}
                        </div>
                     )}
                 </div>
                 
                 <div className="p-3 overflow-y-auto flex-1 custom-scrollbar">
                     {recommended.length > 0 ? (
                         <div className="flex flex-col gap-2">
                            {recommended.map(emp => (
                                <EmployeeItem key={emp.id} emp={emp} isRecommended={true} />
                            ))}
                         </div>
                     ) : (
                         <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-400 border-2 border-dashed border-blue-200 rounded-xl m-2">
                            <MapPin size={32} className="mb-2 opacity-50" />
                            <p className="text-sm">Không có nhân viên nào phụ trách chính địa bàn này.</p>
                         </div>
                     )}
                 </div>
             </div>

             {/* RIGHT SIDE: OTHERS (Grid 2 Cols) */}
             <div className="flex-1 flex flex-col bg-white">
                 <div className="p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                     <div className="flex items-center gap-2 text-sm font-bold text-gray-600 uppercase tracking-wide">
                        <User size={16} />
                        Nhân viên khác ({others.length})
                     </div>
                 </div>

                 <div className="p-4 overflow-y-auto flex-1 custom-scrollbar bg-slate-50">
                     {others.length > 0 ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                            {others.map(emp => (
                                <EmployeeItem key={emp.id} emp={emp} />
                            ))}
                         </div>
                     ) : (
                         <div className="h-64 flex flex-col items-center justify-center text-gray-400">
                            <p>Không tìm thấy nhân viên nào khác.</p>
                         </div>
                     )}
                 </div>
             </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white flex justify-between items-center shrink-0">
            <div className="text-xs text-gray-500 italic">
                * Chọn nhân viên để giao việc. Nhân viên đúng tuyến được ưu tiên hiển thị bên trái.
            </div>
            <div className="flex gap-3">
                <button 
                    onClick={onClose} 
                    className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                >
                    Hủy bỏ
                </button>
                <button 
                    onClick={() => selectedEmpId && onConfirm(selectedEmpId)}
                    disabled={!selectedEmpId}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold shadow-md shadow-blue-500/30 transition-all active:scale-95 flex items-center gap-2"
                >
                    <Check size={18} /> Xác nhận giao
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AssignModal;
