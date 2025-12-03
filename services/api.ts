
import { RecordFile, RecordStatus, Employee, User } from '../types';

// Hàm lấy URL gốc từ cài đặt hoặc mặc định là localhost
export const getBaseUrl = () => {
  return localStorage.getItem('SERVER_URL') || 'http://localhost:3000';
};

// --- API RECORDS ---
export const fetchRecords = async (): Promise<RecordFile[]> => {
  try {
    const API_BASE_URL = getBaseUrl();
    const response = await fetch(`${API_BASE_URL}/records`);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn("Không kết nối được Server (Offline mode):", error);
    return []; // Trả về rỗng để App chuyển sang chế độ Offline
  }
};

export const createRecordApi = async (record: RecordFile): Promise<RecordFile | null> => {
  try {
    const API_BASE_URL = getBaseUrl();
    const response = await fetch(`${API_BASE_URL}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    return await response.json();
  } catch (error) {
    console.error("Lỗi tạo hồ sơ:", error);
    return null;
  }
};

export const createRecordsBatchApi = async (records: RecordFile[]): Promise<boolean> => {
    try {
      const API_BASE_URL = getBaseUrl();
      const response = await fetch(`${API_BASE_URL}/records/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(records)
      });
      return response.ok;
    } catch (error) {
      console.error("Lỗi import lô hồ sơ:", error);
      return false;
    }
  };

export const updateRecordApi = async (record: RecordFile): Promise<RecordFile | null> => {
  try {
    const API_BASE_URL = getBaseUrl();
    const response = await fetch(`${API_BASE_URL}/records/${record.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record)
    });
    return await response.json();
  } catch (error) {
    console.error("Lỗi cập nhật hồ sơ:", error);
    return null;
  }
};

export const deleteRecordApi = async (id: string): Promise<boolean> => {
  try {
    const API_BASE_URL = getBaseUrl();
    await fetch(`${API_BASE_URL}/records/${id}`, { method: 'DELETE' });
    return true;
  } catch (error) {
    console.error("Lỗi xóa hồ sơ:", error);
    return false;
  }
};

// --- API EMPLOYEES (NHÂN VIÊN) ---
export const fetchEmployees = async (): Promise<Employee[]> => {
    try {
        const API_BASE_URL = getBaseUrl();
        const res = await fetch(`${API_BASE_URL}/employees`);
        if (!res.ok) return [];
        return await res.json();
    } catch (e) { return []; }
};

export const saveEmployeeApi = async (employee: Employee, isUpdate: boolean): Promise<Employee | null> => {
    try {
        const API_BASE_URL = getBaseUrl();
        const url = isUpdate ? `${API_BASE_URL}/employees/${employee.id}` : `${API_BASE_URL}/employees`;
        const method = isUpdate ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(employee)
        });
        return await res.json();
    } catch (e) { console.error(e); return null; }
};

export const deleteEmployeeApi = async (id: string): Promise<boolean> => {
    try {
        const API_BASE_URL = getBaseUrl();
        await fetch(`${API_BASE_URL}/employees/${id}`, { method: 'DELETE' });
        return true;
    } catch (e) { console.error(e); return false; }
};

// --- API USERS (TÀI KHOẢN) ---
export const fetchUsers = async (): Promise<User[]> => {
    try {
        const API_BASE_URL = getBaseUrl();
        const res = await fetch(`${API_BASE_URL}/users`);
        if (!res.ok) return [];
        // json-server cần id, nhưng user dùng username làm khóa chính trong logic App
        // Cần đảm bảo khi lưu user có trường id (có thể là username)
        return await res.json();
    } catch (e) { return []; }
};

export const saveUserApi = async (user: User, isUpdate: boolean): Promise<User | null> => {
    try {
        const API_BASE_URL = getBaseUrl();
        // Json-server yêu cầu ID. Sử dụng username làm ID
        const userWithId = { ...user, id: user.username };
        
        const url = isUpdate ? `${API_BASE_URL}/users/${user.username}` : `${API_BASE_URL}/users`;
        const method = isUpdate ? 'PUT' : 'POST';
        
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userWithId)
        });
        return await res.json();
    } catch (e) { console.error(e); return null; }
};

export const deleteUserApi = async (username: string): Promise<boolean> => {
    try {
        const API_BASE_URL = getBaseUrl();
        await fetch(`${API_BASE_URL}/users/${username}`, { method: 'DELETE' });
        return true;
    } catch (e) { console.error(e); return false; }
};


// --- API EXCERPTS (TRÍCH LỤC) ---
export const fetchExcerptHistory = async () => {
  try {
    const API_BASE_URL = getBaseUrl();
    const res = await fetch(`${API_BASE_URL}/excerpt_history`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (e) { return []; }
};

export const saveExcerptRecord = async (data: any) => {
  try {
    const API_BASE_URL = getBaseUrl();
    await fetch(`${API_BASE_URL}/excerpt_history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch (e) { console.error(e); }
};

export const fetchExcerptCounters = async () => {
    try {
        const API_BASE_URL = getBaseUrl();
        const res = await fetch(`${API_BASE_URL}/excerpt_counters`);
        if (!res.ok) return {};
        return await res.json();
    } catch (e) { return {}; }
};

export const saveExcerptCounters = async (counters: Record<string, number>) => {
    try {
        const API_BASE_URL = getBaseUrl();
        // Sử dụng Route Custom để đảm bảo object được ghi đè đúng cách
        await fetch(`${API_BASE_URL}/custom/counters`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(counters)
        });
    } catch (e) { console.error(e); }
};

export const deleteAllDataApi = async (): Promise<boolean> => {
  try {
    const API_BASE_URL = getBaseUrl();
    const response = await fetch(`${API_BASE_URL}/system/reset`, { method: 'POST' });
    return response.ok;
  } catch (error) {
    console.error("Lỗi xóa dữ liệu:", error);
    return false;
  }
};
