import { useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types';
import {
  SystemPermissionsState,
  fetchSystemPermissions,
  hasPermission,
  getDefaultRolePermissions,
  DEFAULT_DEPARTMENT_PRESETS
} from '../utils/permissions';

export function usePermissions(currentUser: User | null | undefined, userDepartment?: string) {
  const [permissionsState, setPermissionsState] = useState<SystemPermissionsState>(() => {
    try {
      const cached = localStorage.getItem('offline_system_permissions_v1');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Error reading permissions from cache:', e);
    }
    return {
      rolePermissions: getDefaultRolePermissions(),
      userOverrides: {},
      departmentPresets: DEFAULT_DEPARTMENT_PRESETS
    };
  });

  const refreshPermissions = useCallback(async () => {
    const latest = await fetchSystemPermissions();
    setPermissionsState(latest);
  }, []);

  useEffect(() => {
    refreshPermissions();

    const handleUpdated = (e: any) => {
      if (e.detail) {
        setPermissionsState(e.detail);
      } else {
        refreshPermissions();
      }
    };

    window.addEventListener('permissions_updated', handleUpdated);
    return () => {
      window.removeEventListener('permissions_updated', handleUpdated);
    };
  }, [refreshPermissions]);

  const can = useCallback((permissionKey: string): boolean => {
    return hasPermission(currentUser, permissionKey, userDepartment, permissionsState);
  }, [currentUser, userDepartment, permissionsState]);

  const canAccessView = useCallback((viewId: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.ADMIN) return true;

    if (viewId === 'personal_profile' || viewId === 'account_settings') return true;

    const viewPermissionMap: Record<string, string> = {
      'dashboard': 'dashboard.view',
      'internal_chat': 'chat.use',
      'blocking_records': 'blocking.manage',
      'work_schedule': 'work_schedule.view',
      'warehouse_records': 'warehouse.view',
      'receive_record': 'receive_record.create',
      'receive_contract': 'receive_contract.create',
      'all_records': 'records.view',
      'send_measurement_files': 'measurement_logs.view',
      'dangky_records': 'records.view',
      'archive_records': 'archive.view',
      'other_records': 'other_records.view',
      'excerpt_management': 'excerpt.view',
      'utilities': 'utilities.view',
      'reports': 'reports.view',
      'user_management': 'users.manage',
      'permission_management': 'permissions.manage',
      'employee_management': 'employees.manage',
      'system_settings': 'system_settings.manage',
    };

    const permKey = viewPermissionMap[viewId];
    if (!permKey) return true;

    return can(permKey);
  }, [currentUser, can]);

  return {
    permissionsState,
    refreshPermissions,
    can,
    canAccessView
  };
}
