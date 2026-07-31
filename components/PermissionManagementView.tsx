import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, Employee } from '../types';
import { 
  PERMISSION_DEFINITIONS, 
  UserPermissionOverride, 
  SystemPermissionsState, 
  getDefaultRolePermissions, 
  DEFAULT_DEPARTMENT_PRESETS,
  fetchSystemPermissions,
  saveSystemPermissionsApi,
  getUserEffectivePermissions
} from '../utils/permissions';
import { confirmAction, showToast } from '../utils/appHelpers';
import { 
  ShieldCheck, 
  Users, 
  Search, 
  Check, 
  X, 
  RotateCcw, 
  Save, 
  UserCheck, 
  Briefcase, 
  Sliders, 
  Copy, 
  Filter, 
  Plus, 
  Minus, 
  CheckCircle2, 
  XCircle, 
  Info, 
  Sparkles,
  ChevronRight,
  Layers
} from 'lucide-react';

interface PermissionManagementViewProps {
  users: User[];
  employees: Employee[];
  currentUser: User;
}

const PermissionManagementView: React.FC<PermissionManagementViewProps> = ({
  users,
  employees,
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<'role_matrix' | 'user_custom' | 'department_presets'>('role_matrix');
  const [permissionsState, setPermissionsState] = useState<SystemPermissionsState>({
    rolePermissions: getDefaultRolePermissions(),
    userOverrides: {},
    departmentPresets: DEFAULT_DEPARTMENT_PRESETS
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // --- USER TAB STATES ---
  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [userDeptFilter, setUserDeptFilter] = useState<string>('all');
  const [copySourceUsername, setCopySourceUsername] = useState<string>('');
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);

  // Load Permissions on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const data = await fetchSystemPermissions();
      setPermissionsState(data);
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Set default selected user if available
  useEffect(() => {
    if (users.length > 0 && !selectedUsername) {
      setSelectedUsername(users[0].username);
    }
  }, [users, selectedUsername]);

  // Extract all available unique departments from employees list
  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.department) set.add(e.department);
    });
    // Add default presets keys
    Object.keys(DEFAULT_DEPARTMENT_PRESETS).forEach(d => set.add(d));
    return Array.from(set).sort();
  }, [employees]);

  // Group permissions by category
  const permissionCategories = useMemo(() => {
    const categories: Record<string, { label: string; permissions: typeof PERMISSION_DEFINITIONS }> = {};
    PERMISSION_DEFINITIONS.forEach(perm => {
      if (!categories[perm.category]) {
        categories[perm.category] = {
          label: perm.categoryLabel,
          permissions: []
        };
      }
      categories[perm.category].permissions.push(perm);
    });
    return categories;
  }, []);

  // Filtered permissions list based on search and category filter
  const filteredPermissions = useMemo(() => {
    return PERMISSION_DEFINITIONS.filter(p => {
      const matchSearch = p.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.description || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = categoryFilter === 'all' || p.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [searchTerm, categoryFilter]);

  // --- ROLE MATRIX HANDLERS ---
  const handleToggleRolePermission = (role: UserRole, key: string) => {
    if (role === UserRole.ADMIN) {
      showToast('Tài khoản Quản trị viên (Admin) luôn có đầy đủ tất cả các quyền.', 'success');
      return;
    }

    setPermissionsState(prev => {
      const currentRolePerms = prev.rolePermissions[role] || [];
      const hasPerm = currentRolePerms.includes(key);
      const updated = hasPerm 
        ? currentRolePerms.filter(k => k !== key)
        : [...currentRolePerms, key];

      return {
        ...prev,
        rolePermissions: {
          ...prev.rolePermissions,
          [role]: updated
        }
      };
    });
  };

  const handleToggleCategoryForRole = (role: UserRole, categoryKey: string, enable: boolean) => {
    if (role === UserRole.ADMIN) return;

    const categoryPermKeys = PERMISSION_DEFINITIONS.filter(p => p.category === categoryKey).map(p => p.key);

    setPermissionsState(prev => {
      const currentRolePerms = new Set(prev.rolePermissions[role] || []);
      if (enable) {
        categoryPermKeys.forEach(k => currentRolePerms.add(k));
      } else {
        categoryPermKeys.forEach(k => currentRolePerms.delete(k));
      }

      return {
        ...prev,
        rolePermissions: {
          ...prev.rolePermissions,
          [role]: Array.from(currentRolePerms)
        }
      };
    });
  };

  const handleResetRoleToDefault = async () => {
    if (await confirmAction('Khôi phục cấu hình phân quyền theo vai trò về mặc định ban đầu?')) {
      setPermissionsState(prev => ({
        ...prev,
        rolePermissions: getDefaultRolePermissions()
      }));
      showToast('Đã khôi phục quyền mặc định theo vai trò!', 'success');
    }
  };

  // --- USER OVERRIDE HANDLERS ---
  const selectedUser = useMemo(() => {
    return users.find(u => u.username === selectedUsername);
  }, [users, selectedUsername]);

  const selectedEmployee = useMemo(() => {
    if (!selectedUser?.employeeId) return null;
    return employees.find(e => e.id === selectedUser.employeeId);
  }, [selectedUser, employees]);

  const selectedUserDepartment = selectedEmployee?.department || '';

  const userOverrideState = useMemo(() => {
    if (!selectedUsername) return { granted: [], denied: [] };
    const override = permissionsState.userOverrides[selectedUsername];
    return {
      granted: override?.grantedPermissions || [],
      denied: override?.deniedPermissions || []
    };
  }, [selectedUsername, permissionsState.userOverrides]);

  const handleSetUserPermissionMode = (key: string, mode: 'ROLE' | 'GRANT' | 'DENY') => {
    if (!selectedUsername) return;
    if (selectedUser?.role === UserRole.ADMIN) {
      showToast('Tài khoản Quản trị viên (Admin) luôn có toàn quyền.', 'success');
      return;
    }

    setPermissionsState(prev => {
      const currentOverrides = prev.userOverrides[selectedUsername] || {
        username: selectedUsername,
        department: selectedUserDepartment,
        grantedPermissions: [],
        deniedPermissions: []
      };

      let newGranted = (currentOverrides.grantedPermissions || []).filter(k => k !== key);
      let newDenied = (currentOverrides.deniedPermissions || []).filter(k => k !== key);

      if (mode === 'GRANT') {
        newGranted.push(key);
      } else if (mode === 'DENY') {
        newDenied.push(key);
      }

      return {
        ...prev,
        userOverrides: {
          ...prev.userOverrides,
          [selectedUsername]: {
            ...currentOverrides,
            department: selectedUserDepartment,
            grantedPermissions: newGranted,
            deniedPermissions: newDenied,
            updatedAt: new Date().toISOString()
          }
        }
      };
    });
  };

  const handleApplyDepartmentPresetToUser = (departmentName: string) => {
    if (!selectedUsername) return;
    const presetPerms = permissionsState.departmentPresets?.[departmentName] || DEFAULT_DEPARTMENT_PRESETS[departmentName] || [];

    if (presetPerms.length === 0) {
      showToast(`Tổ công tác "${departmentName}" chưa có bộ mẫu quyền.`, 'error');
      return;
    }

    setPermissionsState(prev => {
      return {
        ...prev,
        userOverrides: {
          ...prev.userOverrides,
          [selectedUsername]: {
            username: selectedUsername,
            department: departmentName,
            grantedPermissions: presetPerms,
            deniedPermissions: [],
            updatedAt: new Date().toISOString()
          }
        }
      };
    });

    showToast(`Đã áp dụng mẫu phân quyền "${departmentName}" cho tài khoản ${selectedUsername}!`, 'success');
  };

  const handleApplyDepartmentPresetToAllDepartmentMembers = async (departmentName: string) => {
    const targetDeptEmployees = employees.filter(e => e.department === departmentName);
    const targetEmpIds = new Set(targetDeptEmployees.map(e => e.id));
    const targetUsers = users.filter(u => u.employeeId && targetEmpIds.has(u.employeeId) && u.role !== UserRole.ADMIN);

    if (targetUsers.length === 0) {
      showToast(`Không tìm thấy tài khoản nào thuộc tổ công tác "${departmentName}".`, 'error');
      return;
    }

    if (await confirmAction(`Áp dụng mẫu phân quyền "${departmentName}" cho toàn bộ ${targetUsers.length} tài khoản thuộc tổ này?`)) {
      const presetPerms = permissionsState.departmentPresets?.[departmentName] || DEFAULT_DEPARTMENT_PRESETS[departmentName] || [];

      setPermissionsState(prev => {
        const newOverrides = { ...prev.userOverrides };
        targetUsers.forEach(u => {
          newOverrides[u.username] = {
            username: u.username,
            department: departmentName,
            grantedPermissions: presetPerms,
            deniedPermissions: [],
            updatedAt: new Date().toISOString()
          };
        });

        return {
          ...prev,
          userOverrides: newOverrides
        };
      });

      showToast(`Đã đồng bộ mẫu quyền cho ${targetUsers.length} cán bộ thuộc ${departmentName}!`, 'success');
    }
  };

  const handleResetUserOverrides = () => {
    if (!selectedUsername) return;
    setPermissionsState(prev => {
      const updatedOverrides = { ...prev.userOverrides };
      delete updatedOverrides[selectedUsername];
      return {
        ...prev,
        userOverrides: updatedOverrides
      };
    });
    showToast(`Đã xóa tùy chỉnh quyền riêng của tài khoản ${selectedUsername}. Qua lại quyền mặc định theo vai trò.`, 'success');
  };

  const handleCopyPermissions = () => {
    if (!selectedUsername || !copySourceUsername) return;
    const sourceOverride = permissionsState.userOverrides[copySourceUsername];

    setPermissionsState(prev => ({
      ...prev,
      userOverrides: {
        ...prev.userOverrides,
        [selectedUsername]: {
          username: selectedUsername,
          department: selectedUserDepartment,
          grantedPermissions: sourceOverride?.grantedPermissions ? [...sourceOverride.grantedPermissions] : [],
          deniedPermissions: sourceOverride?.deniedPermissions ? [...sourceOverride.deniedPermissions] : [],
          updatedAt: new Date().toISOString()
        }
      }
    }));

    setIsCopyModalOpen(false);
    showToast(`Đã chép phân quyền từ tài khoản ${copySourceUsername} sang ${selectedUsername}!`, 'success');
  };

  // --- SAVE ALL CHANGES ---
  const handleSaveAllPermissions = async () => {
    setIsSaving(true);
    const success = await saveSystemPermissionsApi(permissionsState);
    setIsSaving(false);
    if (success) {
      window.dispatchEvent(new CustomEvent('permissions_updated', { detail: permissionsState }));
      showToast('Đã lưu cấu hình phân quyền động thành công! Hệ thống đã áp dụng quyền mới ngay lập tức.', 'success');
    } else {
      showToast('Lỗi khi lưu cấu hình phân quyền.', 'error');
    }
  };

  // Filter users list for Tab 2
  const filteredUsersList = useMemo(() => {
    return users.filter(u => {
      const emp = u.employeeId ? employees.find(e => e.id === u.employeeId) : null;
      const dept = emp?.department || 'Chưa gắn nhân sự';

      const matchSearch = u.username.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                          u.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                          dept.toLowerCase().includes(userSearchTerm.toLowerCase());
      const matchRole = userRoleFilter === 'all' || u.role === userRoleFilter;
      const matchDept = userDeptFilter === 'all' || dept === userDeptFilter;

      return matchSearch && matchRole && matchDept;
    });
  }, [users, employees, userSearchTerm, userRoleFilter, userDeptFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8 bg-slate-50 text-slate-500 font-medium">
        <Sparkles className="animate-spin text-indigo-600 mr-2" size={20} />
        Đang tải cấu hình phân quyền động...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-100 text-slate-800 overflow-hidden">
      
      {/* HEADER BAR */}
      <div className="bg-white p-4 border-b border-slate-200 shadow-xs shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-base flex items-center gap-2">
              Quản Lý Phân Quyền Động
              <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                Chi tiết đến từng chức năng
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Tùy chỉnh quyền hạn hệ thống theo Vai trò, Tổ công tác và từng Tài khoản người dùng
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleResetRoleToDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors"
          >
            <RotateCcw size={14} /> Khôi phục mặc định
          </button>

          <button
            onClick={handleSaveAllPermissions}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi phân quyền'}
          </button>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="bg-white border-b border-slate-200 px-4 shrink-0 flex items-center gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab('role_matrix')}
          className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'role_matrix' 
              ? 'border-indigo-600 text-indigo-700' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders size={16} /> 1. Quyền Mặc Định Theo Vai Trò (Role Matrix)
        </button>

        <button
          onClick={() => setActiveTab('user_custom')}
          className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'user_custom' 
              ? 'border-indigo-600 text-indigo-700' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck size={16} /> 2. Phân Quyền Theo User & Tổ Công Tác
        </button>

        <button
          onClick={() => setActiveTab('department_presets')}
          className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'department_presets' 
              ? 'border-indigo-600 text-indigo-700' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers size={16} /> 3. Mẫu Phân Quyền Tổ Công Tác
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-hidden p-4 min-h-0">
        
        {/* TAB 1: ROLE MATRIX */}
        {activeTab === 'role_matrix' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs h-full flex flex-col overflow-hidden">
            
            {/* Filter Toolbar */}
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <Search size={14} className="text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm kiếm tính năng, mã quyền..."
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Nhóm chức năng:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold outline-none"
                >
                  <option value="all">Tất cả nhóm ({PERMISSION_DEFINITIONS.length} quyền)</option>
                  {Object.entries(permissionCategories).map(([catKey, catVal]) => (
                    <option key={catKey} value={catKey}>{catVal.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Matrix Table */}
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 shadow-xs z-10 border-b border-slate-200">
                  <tr>
                    <th className="p-3 min-w-[280px]">Mô tả Chức năng / Quyền hạn</th>
                    <th className="p-3 w-28 text-center bg-red-50/70 text-red-800">
                      ADMIN<br/>
                      <span className="font-normal text-[10px] text-red-600">(Toàn quyền)</span>
                    </th>
                    <th className="p-3 w-32 text-center bg-orange-50/70 text-orange-800">
                      SUBADMIN<br/>
                      <span className="font-normal text-[10px] text-orange-600">(Phó quản trị)</span>
                    </th>
                    <th className="p-3 w-32 text-center bg-purple-50/70 text-purple-800">
                      TEAM_LEADER<br/>
                      <span className="font-normal text-[10px] text-purple-600">(Nhóm trưởng)</span>
                    </th>
                    <th className="p-3 w-32 text-center bg-blue-50/70 text-blue-800">
                      EMPLOYEE<br/>
                      <span className="font-normal text-[10px] text-blue-600">(Nhân viên)</span>
                    </th>
                    <th className="p-3 w-32 text-center bg-emerald-50/70 text-emerald-800">
                      ONEDOOR<br/>
                      <span className="font-normal text-[10px] text-emerald-600">(Một cửa)</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Object.entries(permissionCategories).map(([catKey, catVal]) => {
                    const categoryPerms = catVal.permissions.filter(p => filteredPermissions.some(fp => fp.key === p.key));
                    if (categoryPerms.length === 0) return null;

                    return (
                      <React.Fragment key={catKey}>
                        {/* Category Header Row */}
                        <tr className="bg-indigo-50/70 font-bold text-indigo-900 border-t border-b border-indigo-100">
                          <td colSpan={6} className="p-2.5 px-3 flex items-center justify-between">
                            <span className="text-xs tracking-wide uppercase">
                              📁 {catVal.label} ({categoryPerms.length} tính năng)
                            </span>

                            {/* Batch toggles for role category */}
                            <div className="flex items-center gap-3 text-[11px] font-normal text-indigo-700">
                              <span className="font-semibold">Bật nhanh nhóm:</span>
                              <button
                                onClick={() => handleToggleCategoryForRole(UserRole.TEAM_LEADER, catKey, true)}
                                className="underline hover:text-indigo-900"
                              >
                                +Nhóm trưởng
                              </button>
                              <button
                                onClick={() => handleToggleCategoryForRole(UserRole.EMPLOYEE, catKey, true)}
                                className="underline hover:text-indigo-900"
                              >
                                +Nhân viên
                              </button>
                              <button
                                onClick={() => handleToggleCategoryForRole(UserRole.ONEDOOR, catKey, true)}
                                className="underline hover:text-indigo-900"
                              >
                                +Một cửa
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Permission rows */}
                        {categoryPerms.map(perm => {
                          const rolesList: UserRole[] = [UserRole.ADMIN, UserRole.SUBADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.ONEDOOR];

                          return (
                            <tr key={perm.key} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5">
                                <div className="font-semibold text-slate-800">{perm.label}</div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{perm.key}</div>
                                {perm.description && (
                                  <div className="text-[11px] text-slate-500 mt-0.5">{perm.description}</div>
                                )}
                              </td>

                              {rolesList.map(role => {
                                const isAllowed = role === UserRole.ADMIN || (permissionsState.rolePermissions[role] || []).includes(perm.key);

                                return (
                                  <td key={role} className="p-2.5 text-center align-middle">
                                    {role === UserRole.ADMIN ? (
                                      <span className="inline-block p-1 bg-red-100 text-red-700 rounded-full" title="Admin có tất cả các quyền">
                                        <Check size={14} strokeWidth={3} />
                                      </span>
                                    ) : (
                                      <input
                                        type="checkbox"
                                        checked={isAllowed}
                                        onChange={() => handleToggleRolePermission(role, perm.key)}
                                        className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                      />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* TAB 2: USER & DEPARTMENT CUSTOMIZATION */}
        {activeTab === 'user_custom' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-full overflow-hidden">
            
            {/* LEFT PANEL: USERS LIST */}
            <div className="md:col-span-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
              <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2 shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Users size={14} className="text-indigo-600" /> Danh sách Tài khoản ({filteredUsersList.length})
                  </h3>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    placeholder="Tìm theo tên đăng nhập, tên cán bộ, tổ..."
                    className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-2.5 py-1 text-xs outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Filters */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <select
                    value={userRoleFilter}
                    onChange={(e) => setUserRoleFilter(e.target.value)}
                    className="bg-white border border-slate-300 rounded px-2 py-1 text-[11px] font-medium outline-none"
                  >
                    <option value="all">Tất cả Vai trò</option>
                    <option value={UserRole.EMPLOYEE}>EMPLOYEE</option>
                    <option value={UserRole.TEAM_LEADER}>TEAM_LEADER</option>
                    <option value={UserRole.ONEDOOR}>ONEDOOR</option>
                    <option value={UserRole.SUBADMIN}>SUBADMIN</option>
                    <option value={UserRole.ADMIN}>ADMIN</option>
                  </select>

                  <select
                    value={userDeptFilter}
                    onChange={(e) => setUserDeptFilter(e.target.value)}
                    className="bg-white border border-slate-300 rounded px-2 py-1 text-[11px] font-medium outline-none"
                  >
                    <option value="all">Tất cả Tổ công tác</option>
                    {availableDepartments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Users List Item */}
              <div className="flex-1 overflow-auto custom-scrollbar divide-y divide-slate-100">
                {filteredUsersList.map(u => {
                  const emp = u.employeeId ? employees.find(e => e.id === u.employeeId) : null;
                  const dept = emp?.department || 'Chưa phân tổ';
                  const isSelected = u.username === selectedUsername;
                  const hasOverride = !!permissionsState.userOverrides[u.username];

                  return (
                    <div
                      key={u.username}
                      onClick={() => setSelectedUsername(u.username)}
                      className={`p-3 cursor-pointer transition-colors flex items-center justify-between ${
                        isSelected 
                          ? 'bg-indigo-50/80 border-l-4 border-indigo-600' 
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-xs">{u.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">({u.username})</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <span className="font-semibold text-slate-600">{dept}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          u.role === UserRole.ADMIN ? 'bg-red-100 text-red-800' :
                          u.role === UserRole.SUBADMIN ? 'bg-orange-100 text-orange-800' :
                          u.role === UserRole.TEAM_LEADER ? 'bg-purple-100 text-purple-800' :
                          u.role === UserRole.ONEDOOR ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {u.role}
                        </span>

                        {hasOverride && (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded">
                            Tùy chỉnh riêng
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT PANEL: SELECTED USER PERMISSION MATRIX */}
            <div className="md:col-span-8 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col overflow-hidden">
              {selectedUser ? (
                <>
                  {/* User Profile Banner */}
                  <div className="p-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-bold text-sm text-white">{selectedUser.name}</h2>
                        <span className="text-xs text-slate-300 font-mono">({selectedUser.username})</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          selectedUser.role === UserRole.ADMIN ? 'bg-red-500 text-white' :
                          selectedUser.role === UserRole.SUBADMIN ? 'bg-orange-500 text-white' :
                          selectedUser.role === UserRole.TEAM_LEADER ? 'bg-purple-500 text-white' :
                          selectedUser.role === UserRole.ONEDOOR ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'
                        }`}>
                          {selectedUser.role}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                        <span>Tổ công tác: <strong className="text-slate-200">{selectedUserDepartment || 'Chưa gắn'}</strong></span>
                        {selectedEmployee?.position && (
                          <span>Chức vụ: <strong className="text-slate-200">{selectedEmployee.position}</strong></span>
                        )}
                      </div>
                    </div>

                    {/* Quick Preset Actions */}
                    <div className="flex flex-wrap items-center gap-2 ml-auto">
                      {/* Copy From Other User */}
                      <button
                        onClick={() => setIsCopyModalOpen(true)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded border border-slate-700 flex items-center gap-1 font-medium"
                      >
                        <Copy size={13} /> Chép từ User khác
                      </button>

                      {/* Reset to Role Default */}
                      {(userOverrideState.granted.length > 0 || userOverrideState.denied.length > 0) && (
                        <button
                          onClick={handleResetUserOverrides}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded font-semibold flex items-center gap-1"
                        >
                          <RotateCcw size={13} /> Khôi phục mặc định Vai trò
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Apply Department Presets Ribbon */}
                  <div className="p-2.5 bg-indigo-50 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
                    <div className="flex items-center gap-1.5 font-bold text-indigo-900">
                      <Sparkles size={15} className="text-indigo-600" />
                      Áp dụng nhanh mẫu quyền Tổ công tác:
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {Object.keys(DEFAULT_DEPARTMENT_PRESETS).map(deptName => (
                        <button
                          key={deptName}
                          onClick={() => handleApplyDepartmentPresetToUser(deptName)}
                          className="px-2 py-0.5 bg-white hover:bg-indigo-600 hover:text-white border border-indigo-200 rounded text-[11px] font-semibold text-indigo-800 transition-colors"
                        >
                          + {deptName}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Overrides Summary Bar */}
                  <div className="p-2 px-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium shrink-0">
                    <div>
                      Tổng quyền hiệu lực: <strong className="text-indigo-700">{getUserEffectivePermissions(selectedUser, selectedUserDepartment, permissionsState).size}</strong> / {PERMISSION_DEFINITIONS.length} tính năng
                    </div>

                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="text-emerald-700 font-semibold">
                        + {userOverrideState.granted.length} được cấp thêm
                      </span>
                      <span className="text-rose-700 font-semibold">
                        - {userOverrideState.denied.length} bị thu hồi
                      </span>
                    </div>
                  </div>

                  {/* User Feature Permissions Table */}
                  <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 shadow-xs z-10 border-b border-slate-200">
                        <tr>
                          <th className="p-2.5 min-w-[220px]">Chức năng</th>
                          <th className="p-2.5 w-32 text-center">Quyền vai trò</th>
                          <th className="p-2.5 w-48 text-center">Thiết lập riêng cho User</th>
                          <th className="p-2.5 w-32 text-center">Trạng thái cuối</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {PERMISSION_DEFINITIONS.map(perm => {
                          const isRoleAllowed = selectedUser.role === UserRole.ADMIN || (permissionsState.rolePermissions[selectedUser.role] || []).includes(perm.key);
                          const isGranted = userOverrideState.granted.includes(perm.key);
                          const isDenied = userOverrideState.denied.includes(perm.key);

                          const isFinalAllowed = selectedUser.role === UserRole.ADMIN ? true : (isDenied ? false : (isGranted ? true : isRoleAllowed));

                          let currentMode: 'ROLE' | 'GRANT' | 'DENY' = 'ROLE';
                          if (isGranted) currentMode = 'GRANT';
                          if (isDenied) currentMode = 'DENY';

                          return (
                            <tr key={perm.key} className="hover:bg-slate-50 transition-colors">
                              <td className="p-2.5">
                                <div className="font-semibold text-slate-800">{perm.label}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{perm.key}</div>
                              </td>

                              <td className="p-2.5 text-center">
                                {isRoleAllowed ? (
                                  <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded border border-slate-200">
                                    Mặc định Có
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-slate-50 text-slate-400 px-2 py-0.5 rounded border border-slate-100">
                                    Không
                                  </span>
                                )}
                              </td>

                              {/* 3-way toggle button */}
                              <td className="p-2.5 text-center">
                                <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                  <button
                                    onClick={() => handleSetUserPermissionMode(perm.key, 'ROLE')}
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                                      currentMode === 'ROLE' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                    title="Theo mặc định của Vai trò"
                                  >
                                    Theo vai trò
                                  </button>

                                  <button
                                    onClick={() => handleSetUserPermissionMode(perm.key, 'GRANT')}
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                                      currentMode === 'GRANT' ? 'bg-emerald-600 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'
                                    }`}
                                    title="Cấp thêm quyền riêng cho tài khoản này"
                                  >
                                    + Cấp thêm
                                  </button>

                                  <button
                                    onClick={() => handleSetUserPermissionMode(perm.key, 'DENY')}
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                                      currentMode === 'DENY' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 hover:bg-rose-50'
                                    }`}
                                    title="Thu hồi / Chặn quyền riêng với tài khoản này"
                                  >
                                    - Chặn
                                  </button>
                                </div>
                              </td>

                              {/* Final Status */}
                              <td className="p-2.5 text-center">
                                {isFinalAllowed ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 size={12} /> Cho phép
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                    <XCircle size={12} /> Bị từ chối
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-slate-400">
                  Vui lòng chọn một tài khoản ở danh sách bên trái để chỉnh sửa phân quyền.
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 3: DEPARTMENT PRESETS */}
        {activeTab === 'department_presets' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs h-full flex flex-col overflow-hidden p-4 space-y-4">
            <div>
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Layers className="text-indigo-600" size={18} />
                Quản lý Mẫu Phân Quyền Theo Tổ Công Tác (Department Presets)
              </h2>
              <p className="text-xs text-slate-500">
                Cho phép nhóm các quyền hạn đặc thù theo chuyên môn của từng Tổ công tác để đồng bộ nhanh cho toàn bộ nhân sự trong tổ.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 overflow-auto custom-scrollbar">
              {Object.entries(DEFAULT_DEPARTMENT_PRESETS).map(([deptName, permKeys]) => {
                const deptMembers = employees.filter(e => e.department === deptName);

                return (
                  <div key={deptName} className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <h3 className="font-bold text-indigo-900 text-sm">{deptName}</h3>
                        <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                          {permKeys.length} tính năng
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 mt-2 mb-3">
                        Số nhân sự hiện tại: <strong className="text-slate-800">{deptMembers.length} cán bộ</strong>
                      </div>

                      <div className="space-y-1.5 max-h-56 overflow-auto custom-scrollbar pr-1">
                        {permKeys.map(key => {
                          const def = PERMISSION_DEFINITIONS.find(p => p.key === key);
                          return (
                            <div key={key} className="text-[11px] bg-white p-1.5 rounded border border-slate-200 text-slate-700 flex items-center justify-between">
                              <span className="font-medium truncate">{def?.label || key}</span>
                              <CheckCircle2 size={12} className="text-emerald-600 shrink-0 ml-1" />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-200 mt-3">
                      <button
                        onClick={() => handleApplyDepartmentPresetToAllDepartmentMembers(deptName)}
                        className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        <UserCheck size={14} /> Đồng bộ cho tất cả cán bộ thuộc {deptName}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* COPY PERMISSIONS MODAL */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Copy size={16} className="text-indigo-600" />
                Chép Phân Quyền Giữa Các Tài Khoản
              </h3>
              <button onClick={() => setIsCopyModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3">
              <div>
                Tài khoản đích nhận quyền: <strong className="text-indigo-700">{selectedUser?.name} ({selectedUsername})</strong>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Chọn Tài khoản nguồn để sao chép mẫu quyền:
                </label>
                <select
                  value={copySourceUsername}
                  onChange={(e) => setCopySourceUsername(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold outline-none"
                >
                  <option value="">-- Chọn tài khoản nguồn --</option>
                  {users.filter(u => u.username !== selectedUsername).map(u => (
                    <option key={u.username} value={u.username}>
                      {u.name} ({u.username}) - {u.role}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setIsCopyModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleCopyPermissions}
                disabled={!copySourceUsername}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg disabled:opacity-50"
              >
                Xác nhận chép quyền
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PermissionManagementView;
