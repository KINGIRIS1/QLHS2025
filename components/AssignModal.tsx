import React, { useState, useMemo } from 'react';
import { Employee, RecordFile } from '../types';
import { X, Check, MapPin, User, Users, Search, Briefcase } from 'lucide-react';
import { removeVietnameseTones } from '../utils/appHelpers';

interface AssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (employeeId: string) => void;
  employees: Employee[];
  selectedRecords: RecordFile[];
}

interface EmployeeItemProps {
    emp: Employee;
    isRecommended?: boolean;
    isSelected: boolean;
    onSelect: (id: string) => void;
    isSurveyTeam?: boolean;
}

// Component hiển thị một dòng nhân viên (Compact style cho grid)
const EmployeeItem: React.FC<EmployeeItemProps> = ({ emp, isRecommended, isSelected, onSelect, isSurveyTeam }) => (
    <div 
        onClick={() => onSelect(emp.id)}
        className={`relative flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all group h-full ${
            isSelected 
                ? 'bg-blue-50 border-blue-500 shadow-sm ring-1 ring-blue-200' 
                : 'bg-white border-gray-200 hover:border-blue-400 hover:shadow-md'
        }`}
    >
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isRecommended ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {emp.name.charAt(0).toUpperCase()}
        </div>
        
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
                <span className={`font-bold text-sm truncate ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>
                    {emp.name}
                </span>
                {isSelected && <Check size={14} className="text-blue-600 shrink-0" />}
            </div>
            
            <div className={`text-xs truncate mb-1 flex items-center gap-1 ${isSurveyTeam ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                {isSurveyTeam && <Briefcase size={10} />}
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

const AssignModal: React.FC<AssignModalProps> = ({ isOpen, onClose, onConfirm, employees, selectedRecords }) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Tự động xác định địa bàn mục tiêu từ các hồ sơ được chọn
  const targetWardName = useMemo(() => {
      if (selectedRecords.length === 0) return null;
      
      const firstWard = selectedRecords[0].ward;
      if (!firstWard) return null;

      // Chuẩn hóa tên xã đầu tiên để so sánh
      const normFirst = removeVietnameseTones(firstWard);

      // Kiểm tra tính đồng nhất: Tất cả hồ sơ phải cùng 1 xã/phường
      const isUniform = selectedRecords.every(r => 
          r.ward && removeVietnameseTones(r.ward) === normFirst
      );

      return isUniform ? firstWard : null;
  }, [selectedRecords]);

  // Logic chia nhóm nhân viên: Đề xuất (Trái) & Khác (Phải)
  const { recommended, others } = useMemo(() => {
    // 1. Lọc theo từ khóa tìm kiếm trước
    const filteredEmployees = employees.filter(e => 
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.department.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const rec: Employee[] = [];
    const oth: Employee[] = [];

    // Helper: Xác định nhân viên chuyên môn (Đo đạc/Kỹ thuật)
    // Chỉ những người này mới được vào danh sách Đề xuất
    const checkIsSurveyTeam = (emp: Employee) => {
        const dept = (emp.department || '').toLowerCase();
        const pos = (emp.position || '').toLowerCase();
        
        // Các từ khóa nhận diện chuyên môn kỹ thuật/đo đạc
        const keywords = [
            'kỹ thuật', 'đo đạc', 'tổ đo', 'địa chính', 
            'nội nghiệp', 'ngoại nghiệp', 'biên tập', 'bản đồ',
            'tổ 1', 'tổ 2', 'tổ 3' // Các tên tổ chuyên môn cụ thể
        ];
        
        // Loại trừ các từ khóa hành chính
        const excludeKeywords = ['văn thư', 'kế toán', 'một cửa', 'tiếp nhận', 'hành chính', 'bảo vệ', 'tạp vụ'];
        
        if (excludeKeywords.some(k => dept.includes(k) || pos.includes(k))) return false;

        return keywords.some(k => dept.includes(k) || pos.includes(k));
    };

    filteredEmployees.forEach(emp => {
        // Điều kiện 1: Có quản lý địa bàn này không?
        let isManaged = false;
        if (targetWardName) {
            const targetNorm = removeVietnameseTones(targetWardName);
            isManaged = emp.managedWards && emp.managedWards.some(w => removeVietnameseTones(w) === targetNorm);
        }

        // Điều kiện 2: Có phải nhân viên kỹ thuật/đo đạc không?
        const isSurvey = checkIsSurveyTeam(emp);

        // LOGIC CHIA NHÓM:
        // Đề xuất = (Quản lý đúng địa bàn) VÀ (Là dân kỹ thuật)
        // Tất cả trường hợp còn lại (khác địa bàn HOẶC làm văn phòng/một cửa) -> Đưa vào nhóm Khác
        if (isManaged && isSurvey) {
            rec.push(emp);
        } else {
            oth.push(emp);
        }
    });

    // Sắp xếp danh sách "Khác":
    // Ưu tiên nhân viên Kỹ thuật (nhưng khác địa bàn) lên đầu danh sách để dễ tìm
    oth.sort((a, b) => {
        const aSurvey = checkIsSurveyTeam(a) ? 1 : 0;
        const bSurvey = checkIsSurveyTeam(b) ? 1 : 0;
        
        if (aSurvey !== bSurvey) return bSurvey - aSurvey; // Survey team lên trước
        return a.name.localeCompare(b.name); // Sau đó sort tên
    });

    return { recommended: rec, others: oth };
  }, [employees, targetWardName, searchTerm]);

  // Helper check lại để truyền prop vào UI component con (hiển thị icon briefcase)
  const isSurveyTeamMember = (emp: Employee) => {
      const dept = (emp.department || '').toLowerCase();
      return ['kỹ thuật', 'đo đạc', 'tổ đo', 'địa chính', 'nội nghiệp', 'ngoại nghiệp'].some(k => dept.includes(k));
  };

  if (!isOpen) return null;

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
             
             {/* LEFT SIDE: RECOMMENDED (30-35%) - CHỈ HIỆN KỸ THUẬT ĐÚNG TUYẾN */}
             <div className="w-[320px] bg-blue-50/50 border-r border-blue-100 flex flex-col shrink-0">
                 <div className="p-4 border-b border-blue-100 bg-blue-50/80 sticky top-0 backdrop-blur-sm z-10">
                     <div className="flex items-center gap-2 text-sm font-bold text-blue-800 uppercase tracking-wide">
                        <MapPin size={16} />
                        Tổ Đo đạc (Đúng tuyến)
                     </div>
                     {targetWardName ? (
                        <div className="text-xs text-blue-600 mt-1 font-medium bg-white px-2 py-1 rounded border border-blue-200 inline-block">
                            Địa bàn: {targetWardName}
                        </div>
                     ) : (
                        <div className="text-xs text-gray-500 mt-1 italic">
                            (Nhiều địa bàn khác nhau)
                        </div>
                     )}
                 </div>
                 
                 <div className="p-3 overflow-y-auto flex-1 custom-scrollbar">
                     {recommended.length > 0 ? (
                         <div className="flex flex-col gap-2">
                            {recommended.map(emp => (
                                <EmployeeItem 
                                    key={emp.id} 
                                    emp={emp} 
                                    isRecommended={true} 
                                    isSelected={selectedEmpId === emp.id}
                                    onSelect={setSelectedEmpId}
                                    isSurveyTeam={true}
                                />
                            ))}
                         </div>
                     ) : (
                         <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-400 border-2 border-dashed border-blue-200 rounded-xl m-2">
                            <MapPin size={32} className="mb-2 opacity-50" />
                            <p className="text-sm">
                                {targetWardName 
                                    ? "Không tìm thấy nhân viên Tổ Đo đạc/Kỹ thuật phụ trách địa bàn này." 
                                    : "Vui lòng chọn các hồ sơ cùng 1 địa bàn để nhận đề xuất chính xác."
                                }
                            </p>
                         </div>
                     )}
                 </div>
             </div>

             {/* RIGHT SIDE: OTHERS (Grid 2 Cols) - CÁC TỔ KHÁC + KỸ THUẬT TRÁI TUYẾN */}
             <div className="flex-1 flex flex-col bg-white">
                 <div className="p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                     <div className="flex items-center gap-2 text-sm font-bold text-gray-600 uppercase tracking-wide">
                        <User size={16} />
                        Nhân viên khác ({others.length})
                     </div>
                     <p className="text-[11px] text-gray-400 mt-0.5">Bao gồm: Kỹ thuật khác tuyến, Văn phòng, Một cửa, Lãnh đạo...</p>
                 </div>

                 <div className="p-4 overflow-y-auto flex-1 custom-scrollbar bg-slate-50">
                     {others.length > 0 ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                            {others.map(emp => (
                                <EmployeeItem 
                                    key={emp.id} 
                                    emp={emp}
                                    isSelected={selectedEmpId === emp.id}
                                    onSelect={setSelectedEmpId}
                                    isSurveyTeam={isSurveyTeamMember(emp)}
                                />
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
                * Hệ thống ưu tiên đề xuất nhân viên thuộc phòng Kỹ thuật/Đo đạc.
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
