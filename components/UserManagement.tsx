
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, Employee } from '../types';
import { Plus, Trash2, Edit, Save, X, Shield, User as UserIcon, Lock, Briefcase, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { confirmAction } from '../utils/appHelpers';
import * as XLSX from 'xlsx-js-style';

interface UserManagementProps {
  users: User[];
  employees: Employee[];
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (username: string) => void;
}

const UserManagement: React.FC<UserManagementProps> = ({
  users,
  employees,
  onAddUser,
  onUpdateUser,
  onDeleteUser
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialFormState: User = {
    username: '',
    password: '',
    name: '',
    role: UserRole.EMPLOYEE,
    employeeId: ''
  };

  const [formData, setFormData] = useState<User>(initialFormState);

  useEffect(() => {
    if (editingUser) {
      setFormData(editingUser);
    } else {
      setFormData(initialFormState);
    }
  }, [editingUser, isModalOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.name || !formData.password) {
        alert("Vui lòng điền đầy đủ thông tin bắt buộc.");
        return;
    }

    if (editingUser) {
        onUpdateUser(formData);
    } else {
        // Check existence
        if (users.find(u => u.username === formData.username)) {
            alert("Tên đăng nhập đã tồn tại!");
            return;
        }
        onAddUser(formData);
    }
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleDelete = async (username: string) => {
      if (await confirmAction(`Bạn có chắc chắn muốn xóa tài khoản ${username}?`)) {
          onDeleteUser(username);
      }
  };

  // Helper to get employee name
  const getEmployeeName = (empId?: string) => {
      if (!empId) return '---';
      const emp = employees.find(e => e.id === empId);
      return emp ? `${emp.name} (${emp.department})` : empId;
  };

  // --- TÍNH NĂNG IMPORT EXCEL ---

  const handleDownloadSample = () => {
      const headers = ["USERNAME", "PASSWORD", "DISPLAY_NAME", "ROLE", "EMPLOYEE_ID"];
      const data = [
          ["nguyenvana", "123456", "Nguyễn Văn A", "EMPLOYEE", "NV001"],
          ["admin_phu", "123456", "Trần Thị B", "SUBADMIN", ""],
      ];
      
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      
      // Định dạng độ rộng cột
      ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }];

      XLSX.utils.book_append_sheet(wb, ws, "Mau_Tai_Khoan");
      XLSX.writeFile(wb, "Mau_Nhap_Tai_Khoan.xlsx");
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

        let successCount = 0;
        let failCount = 0;

        rows.forEach((row: any) => {
           const normalizedRow: Record<string, any> = {};
           // Chuẩn hóa key về chữ hoa để dễ xử lý
           Object.keys(row).forEach(k => normalizedRow[k.trim().toUpperCase()] = row[k]);
           
           const username = String(normalizedRow['USERNAME'] || normalizedRow['TÊN ĐĂNG NHẬP'] || '').trim();
           const password = String(normalizedRow['PASSWORD'] || normalizedRow['MẬT KHẨU'] || '123').trim();
           const name = String(normalizedRow['DISPLAY_NAME'] || normalizedRow['TÊN HIỂN THỊ'] || normalizedRow['HỌ TÊN'] || '').trim();
           
           // Xử lý Role
           let roleStr = String(normalizedRow['ROLE'] || normalizedRow['VAI TRÒ'] || 'EMPLOYEE').toUpperCase().trim();
           let role: UserRole = UserRole.EMPLOYEE;
           
           if (roleStr === 'ADMIN') role = UserRole.ADMIN;
           else if (roleStr === 'SUBADMIN') role = UserRole.SUBADMIN;
           else if (roleStr === 'TEAM_LEADER' || roleStr === 'NHÓM TRƯỞNG') role = UserRole.TEAM_LEADER;
           else if (roleStr === 'ONEDOOR' || roleStr === 'MỘT CỬA') role = UserRole.ONEDOOR;

           const employeeId = String(normalizedRow['EMPLOYEE_ID'] || normalizedRow['MÃ NV'] || '').trim();

           if (username && name) {
               // Kiểm tra trùng lặp
               if (users.find(u => u.username === username)) {
                   failCount++; // Bỏ qua nếu đã tồn tại
               } else {
                   onAddUser({
                       username,
                       password,
                       name,
                       role,
                       employeeId
                   });
                   successCount++;
               }
           }
        });

        alert(`Kết quả nhập liệu:\n- Thành công: ${successCount} tài khoản\n- Bỏ qua (Trùng lặp): ${failCount} tài khoản`);

      } catch (error) {
        console.error(error);
        alert('Lỗi đọc file Excel. Vui lòng kiểm tra định dạng.');
      } finally {
         if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Shield className="text-blue-600" /> Quản Lý Tài Khoản
            </h2>
            <div className="flex gap-2">
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImportExcel}
                    accept=".xlsx, .xls"
                    className="hidden"
                />
                <button 
                    onClick={handleDownloadSample}
                    className="flex items-center gap-1 bg-white text-gray-700 border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 font-medium text-xs shadow-sm transition-colors"
                >
                    <Download size={14} /> Tải mẫu
                </button>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 font-medium text-xs shadow-sm transition-colors"
                >
                    <FileSpreadsheet size={14} /> Nhập Excel
                </button>
                <button
                    onClick={() => { setEditingUser(null); setIsModalOpen(true); }}
                    className="flex items-center gap-1 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 font-medium text-xs shadow-sm transition-colors"
                >
                    <Plus size={14} /> Thêm tài khoản
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-0">
            <table className="w-full text-left border-collapse">
                <thead className="bg-white sticky top-0 shadow-sm z-10 text-xs font-semibold text-gray-500 uppercase">
                    <tr>
                        <th className="p-4 border-b">Tên đăng nhập</th>
                        <th className="p-4 border-b">Tên hiển thị</th>
                        <th className="p-4 border-b">Vai trò</th>
                        <th className="p-4 border-b">Liên kết nhân viên</th>
                        <th className="p-4 border-b text-center">Thao tác</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                    {users.map(user => (
                        <tr key={user.username} className="hover:bg-blue-50/50 transition-colors">
                            <td className="p-4 font-medium text-gray-900">{user.username}</td>
                            <td className="p-4">{user.name}</td>
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded text-xs font-bold border ${
                                    user.role === UserRole.ADMIN ? 'bg-red-50 text-red-700 border-red-200' :
                                    user.role === UserRole.SUBADMIN ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                    user.role === UserRole.TEAM_LEADER ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                    user.role === UserRole.ONEDOOR ? 'bg-green-50 text-green-700 border-green-200' :
                                    'bg-blue-50 text-blue-700 border-blue-200'
                                }`}>
                                    {user.role}
                                </span>
                            </td>
                            <td className="p-4 text-gray-600">
                                <div className="flex items-center gap-2">
                                    <Briefcase size={14} className="text-gray-400" />
                                    {getEmployeeName(user.employeeId)}
                                </div>
                            </td>
                            <td className="p-4 text-center">
                                <div className="flex justify-center gap-2">
                                    <button
                                        onClick={() => { setEditingUser(user); setIsModalOpen(true); }}
                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        title="Sửa"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    {user.role !== UserRole.ADMIN && (
                                        <button
                                            onClick={() => handleDelete(user.username)}
                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Xóa"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {isModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in-up">
                    <div className="flex justify-between items-center p-5 border-b">
                        <h3 className="text-lg font-bold text-gray-800">
                            {editingUser ? 'Cập nhật tài khoản' : 'Thêm tài khoản mới'}
                        </h3>
                        <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-red-500"><X size={24} /></button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <input
                                    type="text"
                                    disabled={!!editingUser}
                                    className={`w-full border rounded-lg px-3 py-2 pl-9 outline-none focus:ring-2 focus:ring-blue-500 ${editingUser ? 'bg-gray-100 text-gray-500' : 'border-gray-300'}`}
                                    value={formData.username}
                                    onChange={e => setFormData({...formData, username: e.target.value})}
                                    placeholder="username"
                                />
                                <UserIcon size={16} className="absolute left-3 top-3 text-gray-400" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 pl-9 outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.password}
                                    onChange={e => setFormData({...formData, password: e.target.value})}
                                    placeholder="password"
                                />
                                <Lock size={16} className="absolute left-3 top-3 text-gray-400" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                placeholder="Nguyễn Văn A"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò hệ thống</label>
                            <select
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                value={formData.role}
                                onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                            >
                                <option value={UserRole.EMPLOYEE}>Nhân viên (Employee)</option>
                                <option value={UserRole.TEAM_LEADER}>Nhóm trưởng (Team Leader)</option>
                                <option value={UserRole.ONEDOOR}>Một cửa (One Door)</option>
                                <option value={UserRole.SUBADMIN}>Phó quản trị (Sub Admin)</option>
                                <option value={UserRole.ADMIN}>Quản trị viên (Admin)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Liên kết hồ sơ nhân viên</label>
                            <select
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                value={formData.employeeId || ''}
                                onChange={e => setFormData({...formData, employeeId: e.target.value})}
                            >
                                <option value="">-- Không liên kết --</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.name} - {emp.department}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">Liên kết để sử dụng các tính năng cá nhân hóa (My Tasks).</p>
                        </div>

                        <div className="pt-4 flex justify-end gap-3 border-t">
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                            >
                                Hủy
                            </button>
                            <button
                                type="submit"
                                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm font-medium"
                            >
                                <Save size={18} /> Lưu
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default UserManagement;
