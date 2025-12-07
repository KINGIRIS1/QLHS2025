
import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole, Employee } from '../types';
import { Plus, Trash2, Edit, Save, X, Shield, User as UserIcon, Lock, FileSpreadsheet, Download } from 'lucide-react';
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
  
  // Form state
  const [formData, setFormData] = useState<User>({
    username: '',
    password: '',
    name: '',
    role: UserRole.EMPLOYEE,
    employeeId: ''
  });

  const [error, setError] = useState('');

  // Reset form khi đóng hoặc mở modal mới
  useEffect(() => {
    if (editingUser) {
      setFormData(editingUser);
    } else {
      setFormData({
        username: '',
        password: '',
        name: '',
        role: UserRole.EMPLOYEE,
        employeeId: ''
      });
    }
    setError('');
  }, [editingUser, isModalOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.username || !formData.password || !formData.name) {
      setError('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }

    // Kiểm tra trùng username nếu là thêm mới
    if (!editingUser) {
      if (users.some(u => u.username === formData.username)) {
        setError('Tên đăng nhập đã tồn tại.');
        return;
      }
    }

    if (editingUser) {
      onUpdateUser(formData);
    } else {
      onAddUser(formData);
    }
    
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleDelete = (username: string) => {
    if (confirm(`Bạn có chắc muốn xóa tài khoản "${username}"?`)) {
      onDeleteUser(username);
    }
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  // Hàm helper để cập nhật state an toàn với Functional Update
  const handleInputChange = (field: keyof User, value: string) => {
      setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDownloadSample = () => {
      const headers = ["USERNAME", "PASSWORD", "HỌ TÊN", "VAI TRÒ", "MÃ NV"];
      const data = [
          ["nguyenvana", "123456", "Nguyễn Văn A", "EMPLOYEE", "NV001"],
          ["admin_test", "password", "Quản trị viên", "ADMIN", ""],
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Tai_Khoan_Mau");
      XLSX.writeFile(wb, "Tai_Khoan_Mau.xlsx");
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
        let skipCount = 0;

        rows.forEach((row: any) => {
           // Chuẩn hóa tên cột
           const normalizedRow: Record<string, any> = {};
           Object.keys(row).forEach(k => normalizedRow[k.trim().toUpperCase()] = row[k]);
           
           const username = String(normalizedRow['TÊN ĐĂNG NHẬP'] || normalizedRow['USERNAME'] || normalizedRow['USER'] || '');
           const password = String(normalizedRow['MẬT KHẨU'] || normalizedRow['PASSWORD'] || normalizedRow['PASS'] || '123');
           const name = String(normalizedRow['HỌ TÊN'] || normalizedRow['TÊN'] || normalizedRow['NAME'] || '');
           
           // Xử lý vai trò
           const roleRaw = String(normalizedRow['VAI TRÒ'] || normalizedRow['ROLE'] || '').toUpperCase();
           let role = UserRole.EMPLOYEE;
           if (roleRaw.includes('ADMIN') || roleRaw.includes('QUẢN TRỊ')) role = UserRole.ADMIN;
           else if (roleRaw.includes('PHÓ') || roleRaw.includes('SUB')) role = UserRole.SUBADMIN;

           // Mã nhân viên liên kết
           const employeeId = String(normalizedRow['MÃ NV'] || normalizedRow['LIÊN KẾT'] || normalizedRow['EMPLOYEE_ID'] || '');

           if (username && name) {
               // Kiểm tra trùng username
               if (users.some(u => u.username === username)) {
                   skipCount++;
                   return;
               }

               onAddUser({
                   username,
                   password,
                   name,
                   role,
                   employeeId
               });
               count++;
           }
        });

        alert(`Đã thêm thành công: ${count} tài khoản.\nBỏ qua: ${skipCount} (Do trùng tên đăng nhập).`);
      } catch (error) {
        console.error(error);
        alert('Lỗi đọc file Excel. Vui lòng kiểm tra định dạng.');
      } finally {
         if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    // FIX: Sử dụng readAsArrayBuffer
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Shield className="text-blue-600" size={20} />
            Quản lý Tài khoản Hệ thống
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Tạo và phân quyền truy cập cho nhân viên.
          </p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={handleDownloadSample}
                className="flex items-center gap-2 bg-white text-blue-600 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors shadow-sm font-medium text-sm"
                title="Tải file Excel mẫu để nhập liệu"
            >
                <Download size={18} /> File mẫu
            </button>
            <div className="relative">
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImportExcel}
                    accept=".xlsx, .xls"
                    className="hidden"
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm font-medium"
                >
                    <FileSpreadsheet size={18} /> Nhập Excel
                </button>
            </div>
            <button 
                onClick={() => { setEditingUser(null); setIsModalOpen(true); }}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
            >
                <Plus size={18} /> Thêm tài khoản
            </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="overflow-hidden border border-gray-200 rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <tr>
                <th className="p-4 border-b">Người dùng</th>
                <th className="p-4 border-b">Vai trò</th>
                <th className="p-4 border-b">Liên kết nhân sự</th>
                <th className="p-4 border-b text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {users.map(user => {
                const linkedEmployee = employees.find(e => e.id === user.employeeId);
                return (
                  <tr key={user.username} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                          <UserIcon size={16} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-xs text-gray-500">@{user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${
                        user.role === UserRole.ADMIN 
                          ? 'bg-purple-50 text-purple-700 border-purple-200' 
                          : user.role === UserRole.SUBADMIN
                            ? 'bg-orange-50 text-orange-700 border-orange-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {user.role === UserRole.ADMIN ? 'Administrator' : 
                         user.role === UserRole.SUBADMIN ? 'Phó quản trị' : 'Nhân viên'}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600">
                      {linkedEmployee ? (
                        <div className="flex flex-col">
                           <span className="font-medium">{linkedEmployee.name}</span>
                           <span className="text-xs text-gray-400">{linkedEmployee.department}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">-- Không liên kết --</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => openEdit(user)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Chỉnh sửa"
                        >
                          <Edit size={16} />
                        </button>
                        {user.username !== 'admin' && (
                          <button 
                            onClick={() => handleDelete(user.username)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Xóa tài khoản"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-700 border border-blue-100 inline-block">
            <strong>Gợi ý Excel (Tài khoản):</strong>
            <br/>
            Cột: <code>Username</code>, <code>Password</code>, <code>Họ Tên</code>, <code>Vai Trò</code>, <code>Mã NV</code>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-fade-in-up">
            <div className="flex justify-between items-center p-5 border-b">
              <h3 className="text-lg font-bold text-gray-800">
                {editingUser ? 'Cập nhật tài khoản' : 'Thêm tài khoản mới'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-red-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded border border-red-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị</label>
                <input
                  type="text"
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.name || ''}
                  onChange={e => handleInputChange('name', e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingUser}
                    className={`w-full border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 ${editingUser ? 'bg-gray-100 text-gray-500' : ''}`}
                    value={formData.username || ''}
                    onChange={e => handleInputChange('username', e.target.value)}
                  />
                </div>
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
                   <div className="relative">
                      <input
                        type="text"
                        required
                        className="w-full border border-gray-300 rounded-md px-3 py-2 pl-8 outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.password || ''}
                        onChange={e => handleInputChange('password', e.target.value)}
                      />
                      <Lock size={14} className="absolute left-2.5 top-3 text-gray-400" />
                   </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò</label>
                <select
                  className="w-full border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.role || UserRole.EMPLOYEE}
                  onChange={e => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                >
                  <option value={UserRole.EMPLOYEE}>Nhân viên</option>
                  <option value={UserRole.SUBADMIN}>Phó quản trị (Sub-Admin)</option>
                  <option value={UserRole.ADMIN}>Quản trị viên (Admin)</option>
                </select>
              </div>

              {/* Chỉ hiện chọn nhân viên nếu Role là EMPLOYEE hoặc SUBADMIN */}
              {(formData.role === UserRole.EMPLOYEE || formData.role === UserRole.SUBADMIN) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Liên kết hồ sơ nhân viên</label>
                  <select
                    className="w-full border border-gray-300 rounded-md px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.employeeId || ''}
                    onChange={e => handleInputChange('employeeId', e.target.value)}
                  >
                    <option value="">-- Chọn nhân viên --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                         {emp.name} - {emp.department}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    * Liên kết này giúp hệ thống tự động lọc hồ sơ được giao cho nhân viên khi đăng nhập.
                  </p>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t mt-2">
                 <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                 >
                   Hủy
                 </button>
                 <button 
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm"
                 >
                   <Save size={18} /> Lưu tài khoản
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
