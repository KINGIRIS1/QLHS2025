
import React, { useState, useRef, useEffect } from 'react';
import { Employee, User } from '../types';
import { Plus, Trash2, Save, User as UserIcon, FileSpreadsheet, Download, List, Edit2, CheckSquare, Search } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { confirmAction } from '../utils/appHelpers';

interface EmployeeManagementProps {
  employees: Employee[];
  onSaveEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  wards: string[]; 
  currentUser: User | null; 
}

const EmployeeManagement: React.FC<EmployeeManagementProps> = ({ 
  employees, 
  onSaveEmployee,
  onDeleteEmployee,
  wards, 
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<'list' | 'detail'>('list');
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee>>({ id: '', name: '', department: '', managedWards: [] });
  const [isNew, setIsNew] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form khi chuyển sang tab list (optional)
  useEffect(() => {
      if(activeTab === 'list') {
          // Clean up logic if needed
      }
  }, [activeTab]);

  const handleDelete = async (id: string) => {
    if (await confirmAction('Bạn có chắc chắn muốn xóa nhân viên này?')) {
      onDeleteEmployee(id);
      if (editingEmployee.id === id) {
          setActiveTab('list');
          setEditingEmployee({ id: '', name: '', department: '', managedWards: [] });
      }
    }
  };

  const handleEditClick = (emp: Employee) => {
      setEditingEmployee({ ...emp });
      setIsNew(false);
      setActiveTab('detail');
  };

  const handleAddNewClick = () => {
      setEditingEmployee({ 
          id: `NV${Math.floor(Math.random()*1000)}`, 
          name: '', 
          department: '', 
          managedWards: [] 
      });
      setIsNew(true);
      setActiveTab('detail');
  };

  const handleSave = () => {
    if (!editingEmployee.name || !editingEmployee.id) {
        alert('Vui lòng nhập tên và mã nhân viên');
        return;
    }
    const newEmp = editingEmployee as Employee;
    onSaveEmployee(newEmp);
    alert(isNew ? 'Đã thêm nhân viên mới!' : 'Đã cập nhật thông tin!');
    setActiveTab('list');
  };

  const toggleWard = (ward: string) => {
    setEditingEmployee(prev => {
        const currentWards = prev.managedWards || [];
        if (currentWards.includes(ward)) {
            return { ...prev, managedWards: currentWards.filter(w => w !== ward) };
        } else {
            return { ...prev, managedWards: [...currentWards, ward] };
        }
    });
  };

  const handleChange = (field: keyof Employee, value: string) => {
      setEditingEmployee(prev => ({ ...prev, [field]: value }));
  };

  // --- IMPORT EXCEL LOGIC ---
  const handleDownloadSample = () => {
      const headers = ["MÃ NV", "HỌ TÊN", "PHÒNG BAN", "PHỤ TRÁCH"];
      const data = [
          ["NV001", "Trần Văn B", "Kỹ thuật", "Minh Hưng, Nha Bích"],
          ["NV002", "Lê Thị C", "Văn phòng", ""],
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Nhan_Su_Mau");
      XLSX.writeFile(wb, "Nhan_Su_Mau.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        let count = 0;
        rows.forEach((row: any) => {
           const normalizedRow: Record<string, any> = {};
           Object.keys(row).forEach(k => normalizedRow[k.trim().toUpperCase()] = row[k]);
           
           const id = String(normalizedRow['MÃ NHÂN VIÊN'] || normalizedRow['MÃ NV'] || normalizedRow['ID'] || '');
           const name = String(normalizedRow['HỌ TÊN'] || normalizedRow['TÊN'] || normalizedRow['NAME'] || '');
           const department = String(normalizedRow['PHÒNG BAN'] || normalizedRow['CHỨC VỤ'] || normalizedRow['DEPARTMENT'] || '');
           const wardsRaw = String(normalizedRow['PHỤ TRÁCH'] || normalizedRow['XÃ PHƯỜNG'] || normalizedRow['KHU VỰC'] || '');

           if (id && name) {
               const managedWards = wardsRaw.split(',').map(w => w.trim()).filter(w => w);
               onSaveEmployee({ id, name, department, managedWards });
               count++;
           }
        });
        alert(`Đã nhập thành công ${count} nhân viên.`);
      } catch (error) {
        console.error(error);
        alert('Lỗi đọc file Excel. Vui lòng kiểm tra định dạng.');
      } finally {
         if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Filter employees
  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    emp.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden animate-fade-in-up">
        {/* HEADER */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <UserIcon className="text-blue-600" />
            Quản Lý Nhân Sự
          </h2>
          {/* Tabs Control */}
          <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
            <button 
                onClick={() => setActiveTab('list')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
            >
                <List size={16} /> Danh sách
            </button>
            <button 
                onClick={() => setActiveTab('detail')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'detail' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
            >
                {isNew ? <Plus size={16} /> : <Edit2 size={16} />}
                {isNew ? 'Thêm mới' : 'Chi tiết'}
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-hidden bg-gray-50 flex flex-col min-h-0">
            
            {/* TAB 1: DANH SÁCH */}
            {activeTab === 'list' && (
                <div className="h-full flex flex-col">
                    <div className="p-4 bg-white border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
                        <div className="relative flex-1 w-full max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="Tìm tên, mã nhân viên, phòng ban..." 
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <input 
                                type="file" 
                                ref={fileInputRef}
                                onChange={handleImportExcel}
                                accept=".xlsx, .xls"
                                className="hidden"
                            />
                            <button onClick={handleDownloadSample} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-1 shadow-sm">
                                <Download size={16} /> Mẫu
                            </button>
                            <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-medium hover:bg-green-100 flex items-center gap-1 shadow-sm">
                                <FileSpreadsheet size={16} /> Nhập Excel
                            </button>
                            <button onClick={handleAddNewClick} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 flex items-center gap-1 shadow-sm ml-auto sm:ml-0">
                                <Plus size={16} /> Thêm NV
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4">
                        {filteredEmployees.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredEmployees.map(emp => (
                                    <div 
                                        key={emp.id} 
                                        className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer group relative flex flex-col h-full"
                                        onClick={() => handleEditClick(emp)}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
                                                {emp.name.charAt(0).toUpperCase()}
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDelete(emp.id); }}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                title="Xóa nhân viên"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        
                                        <h3 className="font-bold text-gray-800 text-base mb-1 truncate" title={emp.name}>{emp.name}</h3>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200 font-mono">{emp.id}</span>
                                            <span className="text-xs text-gray-500 font-medium truncate" title={emp.department}>{emp.department}</span>
                                        </div>
                                        
                                        <div className="mt-auto pt-3 border-t border-gray-100">
                                            <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Khu vực phụ trách</p>
                                            <div className="flex flex-wrap gap-1">
                                                {emp.managedWards.length > 0 ? emp.managedWards.slice(0, 3).map(w => (
                                                    <span key={w} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">{w}</span>
                                                )) : <span className="text-[10px] text-gray-400 italic">Chưa phân công</span>}
                                                {emp.managedWards.length > 3 && <span className="text-[10px] px-1.5 py-0.5 text-gray-500">+{emp.managedWards.length - 3}</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <UserIcon size={48} className="mb-2 opacity-50"/>
                                <p>Không tìm thấy nhân viên nào.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: CHI TIẾT */}
            {activeTab === 'detail' && (
                <div className="h-full flex flex-col bg-white overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 md:p-8">
                        <div className="max-w-3xl mx-auto space-y-6">
                            <div className="flex justify-between items-center border-b pb-4">
                                <h3 className="text-xl font-bold text-gray-800">
                                    {isNew ? 'Thêm nhân viên mới' : `Hồ sơ: ${editingEmployee.name}`}
                                </h3>
                                {!isNew && (
                                    <button 
                                        onClick={handleAddNewClick} 
                                        className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 flex items-center gap-1"
                                    >
                                        <Plus size={14} /> Tạo mới
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Mã nhân viên <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        value={editingEmployee.id || ''}
                                        onChange={(e) => handleChange('id', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                        placeholder="Ví dụ: NV001"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Họ và tên <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        value={editingEmployee.name || ''}
                                        onChange={(e) => handleChange('name', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                        placeholder="Ví dụ: Nguyễn Văn A"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold text-gray-700 mb-1">Phòng ban / Chức vụ</label>
                                    <input 
                                        type="text" 
                                        value={editingEmployee.department || ''}
                                        onChange={(e) => handleChange('department', e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                        placeholder="Ví dụ: Phòng Kỹ Thuật"
                                    />
                                </div>
                            </div>

                            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                                <label className="block text-sm font-bold text-blue-800 mb-4 flex items-center gap-2">
                                    <CheckSquare size={18} /> Địa bàn phụ trách (Hệ thống gợi ý khi giao việc)
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                    {wards.map(ward => (
                                        <label key={ward} className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border transition-all select-none ${editingEmployee.managedWards?.includes(ward) ? 'bg-white border-blue-400 shadow-sm' : 'bg-white/50 border-blue-200 hover:bg-white hover:border-blue-300'}`}>
                                            <input 
                                                type="checkbox"
                                                checked={editingEmployee.managedWards?.includes(ward) || false}
                                                onChange={() => toggleWard(ward)}
                                                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                                            />
                                            <span className="text-sm text-gray-700 font-medium">{ward}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-4 border-t border-gray-200 bg-white flex justify-end gap-3 shrink-0">
                        <button 
                            onClick={() => setActiveTab('list')}
                            className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                        >
                            Quay lại danh sách
                        </button>
                        <button 
                            onClick={handleSave} 
                            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md font-bold transition-transform active:scale-95"
                        >
                            <Save size={18} /> {isNew ? 'Lưu nhân viên' : 'Cập nhật thay đổi'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default EmployeeManagement;
