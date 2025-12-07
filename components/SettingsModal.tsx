
import React, { useState, useRef } from 'react';
import { Employee, User, UserRole } from '../types';
import { X, Plus, Trash2, Save, User as UserIcon, FileSpreadsheet, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  // Thay thế setEmployees bằng các handler cụ thể
  onSaveEmployee: (employee: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  wards: string[]; // Danh sách xã phường động
  currentUser: User | null; // Thêm user hiện tại để check quyền
  onDeleteAllData: () => void; 
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  employees, 
  onSaveEmployee,
  onDeleteEmployee,
  wards, 
  currentUser
}) => {
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDelete = (id: string) => {
    if (confirm('Bạn có chắc chắn muốn xóa nhân viên này?')) {
      onDeleteEmployee(id);
    }
  };

  const handleSave = () => {
    if (!editingEmployee?.name || !editingEmployee?.id) {
        alert('Vui lòng nhập tên và mã nhân viên');
        return;
    }
    const newEmp = editingEmployee as Employee;
    onSaveEmployee(newEmp);
    setEditingEmployee(null);
  };

  const toggleWard = (ward: string) => {
    setEditingEmployee(prev => {
        if (!prev) return null;
        const currentWards = prev.managedWards || [];
        if (currentWards.includes(ward)) {
            return { ...prev, managedWards: currentWards.filter(w => w !== ward) };
        } else {
            return { ...prev, managedWards: [...currentWards, ward] };
        }
    });
  };

  const handleChange = (field: keyof Employee, value: string) => {
      setEditingEmployee(prev => (prev ? { ...prev, [field]: value } : null));
  };

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

  // --- LOGIC NHẬP EXCEL (FIXED) ---
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        // FIX: Đổi 'binary' -> 'array'
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        let count = 0;
        rows.forEach((row: any) => {
           // Chuẩn hóa tên cột
           const normalizedRow: Record<string, any> = {};
           Object.keys(row).forEach(k => normalizedRow[k.trim().toUpperCase()] = row[k]);
           
           const id = String(normalizedRow['MÃ NHÂN VIÊN'] || normalizedRow['MÃ NV'] || normalizedRow['ID'] || '');
           const name = String(normalizedRow['HỌ TÊN'] || normalizedRow['TÊN'] || normalizedRow['NAME'] || '');
           const department = String(normalizedRow['PHÒNG BAN'] || normalizedRow['CHỨC VỤ'] || normalizedRow['DEPARTMENT'] || '');
           const wardsRaw = String(normalizedRow['PHỤ TRÁCH'] || normalizedRow['XÃ PHƯỜNG'] || normalizedRow['KHU VỰC'] || '');

           if (id && name) {
               // Xử lý danh sách xã phường (cách nhau bởi dấu phẩy)
               const managedWards = wardsRaw.split(',').map(w => w.trim()).filter(w => w);
               
               onSaveEmployee({
                   id,
                   name,
                   department,
                   managedWards
               });
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
    // FIX: Sử dụng readAsArrayBuffer thay vì readAsBinaryString
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-5 border-b shrink-0">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <UserIcon className="text-blue-600" />
            Cài đặt Nhân sự
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-red-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            {/* List */}
            <div className="w-full md:w-1/3 border-r border-gray-200 flex flex-col bg-gray-50">
                <div className="p-4 border-b border-gray-200 space-y-3">
                    <h3 className="text-sm font-bold text-gray-500 uppercase">Danh sách & Thao tác</h3>
                    
                    <button 
                        onClick={() => setEditingEmployee({ id: `NV${Math.floor(Math.random()*1000)}`, name: '', department: '', managedWards: [] })}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium text-sm"
                    >
                        <Plus size={16} /> Thêm nhân viên
                    </button>

                    {/* Nút Import Excel */}
                    <div className="relative">
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            onChange={handleImportExcel}
                            accept=".xlsx, .xls"
                            className="hidden"
                        />
                        <div className="flex gap-2">
                            <button 
                                onClick={handleDownloadSample}
                                className="flex-1 flex items-center justify-center gap-2 bg-white text-blue-600 border border-blue-200 px-2 py-2 rounded-md hover:bg-blue-50 font-medium text-xs"
                                title="Tải file mẫu"
                            >
                                <Download size={14} /> Mẫu
                            </button>
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-[2] flex items-center justify-center gap-2 bg-green-600 text-white px-2 py-2 rounded-md hover:bg-green-700 font-medium text-sm"
                            >
                                <FileSpreadsheet size={16} /> Nhập Excel
                            </button>
                        </div>
                    </div>
                </div>
                <div className="overflow-y-auto flex-1 p-2 space-y-2">
                    {employees.map(emp => (
                        <div 
                            key={emp.id} 
                            onClick={() => setEditingEmployee(emp)}
                            className={`p-3 rounded-lg cursor-pointer border transition-all ${editingEmployee?.id === emp.id ? 'bg-white border-blue-500 shadow-md' : 'bg-white border-gray-200 hover:border-blue-300'}`}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="font-semibold text-gray-800">{emp.name}</div>
                                    <div className="text-xs text-gray-500">{emp.department}</div>
                                </div>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDelete(emp.id); }}
                                    className="text-gray-400 hover:text-red-500 p-1"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                                {emp.managedWards.slice(0, 3).map(w => (
                                    <span key={w} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded border border-gray-200">
                                        {w}
                                    </span>
                                ))}
                                {emp.managedWards.length > 3 && (
                                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded">+{emp.managedWards.length - 3}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Edit Form */}
            <div className="flex-1 p-6 overflow-y-auto flex flex-col">
                <div className="flex-1">
                    {editingEmployee ? (
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                                {employees.find(e => e.id === editingEmployee.id) ? 'Chỉnh sửa thông tin nhân viên' : 'Thêm nhân viên mới'}
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Mã nhân viên</label>
                                    <input 
                                        type="text" 
                                        value={editingEmployee.id || ''}
                                        onChange={(e) => handleChange('id', e.target.value)}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên</label>
                                    <input 
                                        type="text" 
                                        value={editingEmployee.name || ''}
                                        onChange={(e) => handleChange('name', e.target.value)}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phòng ban / Chức vụ</label>
                                    <input 
                                        type="text" 
                                        value={editingEmployee.department || ''}
                                        onChange={(e) => handleChange('department', e.target.value)}
                                        className="w-full border border-gray-300 rounded-md px-3 py-2 outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Địa bàn phụ trách (Ưu tiên hiển thị khi giao hồ sơ)</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-gray-50 p-4 rounded-lg border border-gray-200 max-h-60 overflow-y-auto">
                                    {wards.map(ward => (
                                        <label key={ward} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded transition-colors">
                                            <input 
                                                type="checkbox"
                                                checked={editingEmployee.managedWards?.includes(ward) || false}
                                                onChange={() => toggleWard(ward)}
                                                className="rounded text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">{ward}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t">
                                <button onClick={() => setEditingEmployee(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md">
                                    Hủy bỏ
                                </button>
                                <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm">
                                    <Save size={18} /> Lưu thông tin
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <UserIcon size={64} className="mb-4 text-gray-200" />
                            <p>Chọn một nhân viên để chỉnh sửa hoặc nhấn "Thêm nhân viên"</p>
                             <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-700 border border-blue-100 max-w-sm">
                                <strong>Gợi ý Excel (Nhân sự):</strong>
                                <br/>
                                Cột: <code>Mã NV</code>, <code>Họ Tên</code>, <code>Phòng Ban</code>, <code>Phụ Trách</code>
                                <br/>
                                <em className="text-xs">Ví dụ Phụ Trách: "Minh Hưng, Nha Bích"</em>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
