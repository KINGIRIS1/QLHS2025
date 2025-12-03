
import { supabase, isConfigured } from './supabaseClient';
import { RecordFile, Employee, User } from '../types';
import { MOCK_RECORDS, MOCK_EMPLOYEES, MOCK_USERS } from '../constants';

// Hàm helper để log lỗi rõ ràng hơn
const logError = (context: string, error: any) => {
    console.error(`Lỗi tại ${context}:`, error?.message || JSON.stringify(error, null, 2));
};

// --- API RECORDS ---
export const fetchRecords = async (): Promise<RecordFile[]> => {
  // Chế độ Demo hoặc chưa cấu hình
  if (!isConfigured) return MOCK_RECORDS;

  try {
    const { data, error } = await supabase
      .from('records')
      .select('*')
      .order('receivedDate', { ascending: false });

    if (error) throw error;
    return data as RecordFile[];
  } catch (error) {
    logError("fetchRecords - Chuyển sang dữ liệu mẫu", error);
    return MOCK_RECORDS;
  }
};

export const createRecordApi = async (record: RecordFile): Promise<RecordFile | null> => {
  if (!isConfigured) {
      console.log("Demo Mode: Giả lập tạo hồ sơ mới");
      return { ...record, id: Math.random().toString(36).substr(2, 9) };
  }

  try {
    const cleanRecord = JSON.parse(JSON.stringify(record));
    const { data, error } = await supabase
      .from('records')
      .insert(cleanRecord)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logError("createRecordApi", error);
    return null;
  }
};

export const createRecordsBatchApi = async (records: RecordFile[]): Promise<boolean> => {
    if (!isConfigured) return true; // Giả lập thành công

    try {
      const cleanRecords = JSON.parse(JSON.stringify(records));
      const { error } = await supabase
        .from('records')
        .insert(cleanRecords);

      if (error) throw error;
      return true;
    } catch (error) {
      logError("createRecordsBatchApi", error);
      return false;
    }
  };

export const updateRecordApi = async (record: RecordFile): Promise<RecordFile | null> => {
  if (!isConfigured) return record; // Giả lập thành công

  try {
    const cleanRecord = JSON.parse(JSON.stringify(record));
    const { data, error } = await supabase
      .from('records')
      .update(cleanRecord)
      .eq('id', record.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    logError("updateRecordApi", error);
    return null;
  }
};

export const deleteRecordApi = async (id: string): Promise<boolean> => {
  if (!isConfigured) return true; // Giả lập thành công

  try {
    const { error } = await supabase
      .from('records')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    logError("deleteRecordApi", error);
    return false;
  }
};

// --- API EMPLOYEES (NHÂN VIÊN) ---
export const fetchEmployees = async (): Promise<Employee[]> => {
    if (!isConfigured) return MOCK_EMPLOYEES;

    try {
        const { data, error } = await supabase.from('employees').select('*');
        if (error) throw error;
        return data as Employee[];
    } catch (e) { 
        logError("fetchEmployees - Chuyển sang dữ liệu mẫu", e);
        return MOCK_EMPLOYEES; 
    }
};

export const saveEmployeeApi = async (employee: Employee, isUpdate: boolean): Promise<Employee | null> => {
    if (!isConfigured) return employee;

    try {
        const { data, error } = await supabase
            .from('employees')
            .upsert(employee)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (e) { 
        logError("saveEmployeeApi", e); 
        return null; 
    }
};

export const deleteEmployeeApi = async (id: string): Promise<boolean> => {
    if (!isConfigured) return true;

    try {
        const { error } = await supabase.from('employees').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (e) { 
        logError("deleteEmployeeApi", e);
        return false; 
    }
};

// --- API USERS (TÀI KHOẢN) ---
export const fetchUsers = async (): Promise<User[]> => {
    if (!isConfigured) return MOCK_USERS;

    try {
        const { data, error } = await supabase.from('users').select('*');
        if (error) throw error;
        return data as User[];
    } catch (e) { 
        logError("fetchUsers - Chuyển sang dữ liệu mẫu", e);
        return MOCK_USERS; 
    }
};

export const saveUserApi = async (user: User, isUpdate: boolean): Promise<User | null> => {
    if (!isConfigured) return user;

    try {
        const { data, error } = await supabase
            .from('users')
            .upsert(user)
            .select()
            .single();
            
        if (error) throw error;
        return data;
    } catch (e) { 
        logError("saveUserApi", e); 
        return null; 
    }
};

export const deleteUserApi = async (username: string): Promise<boolean> => {
    if (!isConfigured) return true;

    try {
        const { error } = await supabase.from('users').delete().eq('username', username);
        if (error) throw error;
        return true;
    } catch (e) { 
        logError("deleteUserApi", e); 
        return false; 
    }
};


// --- API EXCERPTS (TRÍCH LỤC) ---
export const fetchExcerptHistory = async () => {
  if (!isConfigured) return []; // Không có mock history trong constants

  try {
    const { data, error } = await supabase
        .from('excerpt_history')
        .select('*')
        .order('createdAt', { ascending: false });
    if (error) throw error;
    return data;
  } catch (e) { 
      logError("fetchExcerptHistory", e);
      return []; 
  }
};

export const saveExcerptRecord = async (data: any) => {
  if (!isConfigured) return;

  try {
    const { error } = await supabase.from('excerpt_history').insert(data);
    if (error) throw error;
  } catch (e) { logError("saveExcerptRecord", e); }
};

export const fetchExcerptCounters = async (): Promise<Record<string, number>> => {
    if (!isConfigured) return { 'Minh Hưng': 100, 'Nha Bích': 50, 'Chơn Thành': 20 }; // Mock counters

    try {
        const { data, error } = await supabase.from('excerpt_counters').select('*');
        if (error) throw error;

        const countersObj: Record<string, number> = {};
        data.forEach((row: any) => {
            countersObj[row.ward] = Number(row.count);
        });
        return countersObj;
    } catch (e) { 
        logError("fetchExcerptCounters", e);
        return {}; 
    }
};

export const saveExcerptCounters = async (counters: Record<string, number>) => {
    if (!isConfigured) return;

    try {
        const upsertData = Object.entries(counters).map(([ward, count]) => ({
            ward,
            count
        }));

        const { error } = await supabase
            .from('excerpt_counters')
            .upsert(upsertData);
            
        if (error) throw error;
    } catch (e) { logError("saveExcerptCounters", e); }
};

export const deleteAllDataApi = async (): Promise<boolean> => {
  if (!isConfigured) {
      alert("Đang ở chế độ Demo, không thể xóa dữ liệu Cloud.");
      return false;
  }
  try {
    const { error: err1 } = await supabase.from('records').delete().neq('id', '0');
    const { error: err2 } = await supabase.from('excerpt_history').delete().neq('id', '0');
    
    if (err1 || err2) throw new Error("Lỗi xóa dữ liệu");
    return true;
  } catch (error) {
    logError("deleteAllDataApi", error);
    return false;
  }
};
