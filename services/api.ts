

import { supabase, isConfigured } from './supabaseClient';
import { RecordFile, Employee, User, Contract, PriceItem, Message, ChatGroup, Holiday } from '../types';
import { MOCK_RECORDS, MOCK_EMPLOYEES, MOCK_USERS } from '../constants';

// --- CACHE KEYS ---
const CACHE_KEYS = {
    RECORDS: 'offline_records',
    EMPLOYEES: 'offline_employees',
    USERS: 'offline_users',
    CONTRACTS: 'offline_contracts',
    EXCERPT_HISTORY: 'offline_excerpt_history',
    EXCERPT_COUNTERS: 'offline_excerpt_counters',
    PRICE_LIST: 'offline_price_list',
    HOLIDAYS: 'offline_holidays'
};

// --- HELPERS ---
const saveToCache = (key: string, data: any) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn('LocalStorage full or error:', e);
    }
};

const getFromCache = <T>(key: string, fallback: T): T => {
    try {
        const cached = localStorage.getItem(key);
        if (cached) {
            console.log(`[Offline Mode] Loaded data from cache: ${key}`);
            return JSON.parse(cached);
        }
    } catch (e) {
        console.warn('Error reading cache:', e);
    }
    return fallback;
};

const logError = (context: string, error: any) => {
    const msg = error?.message || JSON.stringify(error);
    const code = error?.code;

    // Xử lý lỗi 500 HTML từ Cloudflare/Supabase (Server Down/Paused)
    if (typeof msg === 'string' && (msg.includes('<!DOCTYPE html>') || msg.includes('500 Internal Server Error') || msg.includes('<html>'))) {
         console.warn(`⚠️ [Server Error] ${context}: Máy chủ Cloud đang tạm dừng hoặc gặp sự cố (Lỗi 500). Hệ thống sẽ sử dụng dữ liệu Cache/Offline.`);
         return; 
    }

    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('configuration')) {
        console.warn(`⚠️ [Offline Mode] ${context}: Không thể kết nối Cloud. Sử dụng dữ liệu Cache/Offline.`);
    } else if (code === '42P01') {
        console.error(`❌ Lỗi tại ${context}: Bảng dữ liệu chưa tồn tại trên Supabase!`);
    } else if (code === '22P02') {
         console.error(`❌ Lỗi tại ${context}: Sai định dạng dữ liệu (Lỗi 22P02). Kiểm tra các trường Số hoặc Ngày tháng.`);
         alert(`LỖI DỮ LIỆU: Có trường dữ liệu không đúng định dạng (Ví dụ: Diện tích phải là số).\nHệ thống đã cố gắng tự sửa nhưng vẫn thất bại.`);
    } else if (code === 'PGRST204') {
         console.error(`❌ Lỗi tại ${context}: Cột không tồn tại (Lỗi PGRST204).`);
         alert(`LỖI CẤU TRÚC: Hệ thống đang cố gửi dữ liệu vào cột không tồn tại trên Server.\nVui lòng báo cho quản trị viên.`);
    } else if (code === '22007' || code === '22008') {
         console.error(`❌ Lỗi tại ${context}: Dữ liệu ngày tháng không hợp lệ (Lỗi ${code}).`);
         alert(`LỖI DỮ LIỆU: File Excel chứa ngày tháng không hợp lệ (Ví dụ: "619-0032" hoặc "2025-06-60").\nVui lòng kiểm tra lại file Excel.`);
    } else {
        console.error(`❌ Lỗi tại ${context}:`, error);
    }
};

// --- HÀM HỖ TRỢ XỬ LÝ FILE NAME ---
function sanitizeFileName(fileName: string): string {
    let str = fileName.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/[^a-z0-9\.\-\_]/g, '_');
    if (str.length > 50) {
        const ext = str.split('.').pop();
        str = str.substring(0, 40) + '.' + ext;
    }
    return str;
}

// --- WHITELIST COLUMNS ---
const RECORD_DB_COLUMNS = [
    'id', 'code', 'customerName', 'phoneNumber', 'cccd', 'ward', 'landPlot', 'mapSheet', 
    'area', 'address', 'group', 'content', 'recordType', 'receivedDate', 'deadline', 
    'assignedDate', 'completedDate', 'status', 'assignedTo', 'notes', 'privateNotes', 
    'authorizedBy', 'authDocType', 'otherDocs', 'exportBatch', 'exportDate', 
    'measurementNumber', 'excerptNumber'
];

const CONTRACT_DB_COLUMNS = [
    'id', 'code', 'customerName', 'phoneNumber', 'ward', 'address', 'landPlot', 'mapSheet', 'area',
    'contractType', 'serviceType', 'areaType', 'plotCount', 'markerCount', 'splitItems',
    'quantity', 'unitPrice', 'vatRate', 'vatAmount', 'totalAmount', 'deposit', 'content', 
    'createdDate', 'status'
];

// --- SANITIZATION ---
const sanitizeData = (data: any, allowedColumns: string[]) => {
    const clean: any = { ...data };
    const numberFields = [
        'area', 'exportBatch', 'unitPrice', 'vatRate', 'vatAmount', 'totalAmount', 
        'deposit', 'quantity', 'excerptNumber', 'plotCount', 'markerCount', 
        'minArea', 'maxArea', 'price'
    ];
    numberFields.forEach(field => {
        if (clean[field] === '' || clean[field] === undefined || (typeof clean[field] === 'number' && isNaN(clean[field]))) {
            clean[field] = null;
        }
    });
    const dateFields = ['receivedDate', 'deadline', 'assignedDate', 'completedDate', 'createdDate', 'exportDate'];
    dateFields.forEach(field => {
        if (clean[field] === '' || clean[field] === undefined) {
            clean[field] = null;
        }
    });
    const sanitized: any = {};
    allowedColumns.forEach(col => {
        if (clean.hasOwnProperty(col)) {
            sanitized[col] = clean[col];
        }
    });
    return sanitized;
};

// --- MAPPING PRICE LIST ---
const mapPriceFromDb = (item: any): PriceItem => ({
    id: item.id,
    serviceGroup: item.service_group || item.serviceGroup,
    areaType: item.area_type || item.areaType,
    serviceName: item.service_name || item.serviceName,
    minArea: item.min_area !== undefined ? item.min_area : item.minArea,
    maxArea: item.max_area !== undefined ? item.max_area : item.maxArea,
    unit: item.unit,
    price: item.price,
    vatRate: item.vat_rate !== undefined ? item.vat_rate : item.vatRate,
    vatIsPercent: item.vat_is_percent !== undefined ? item.vat_is_percent : item.vatIsPercent
});
const mapPriceToDb = (item: PriceItem) => ({
    id: item.id,
    service_group: item.serviceGroup,
    area_type: item.areaType,
    service_name: item.serviceName,
    min_area: item.minArea,
    max_area: item.maxArea,
    unit: item.unit,
    price: item.price,
    vat_rate: item.vatRate,
    vat_is_percent: item.vatIsPercent
});

// --- API RECORDS ---
export const fetchRecords = async (): Promise<RecordFile[]> => {
  // Ưu tiên load từ Cache nếu không cấu hình hoặc offline
  if (!isConfigured) return getFromCache(CACHE_KEYS.RECORDS, MOCK_RECORDS);

  try {
    let allRecords: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('records')
            .select('*')
            .order('receivedDate', { ascending: false })
            .range(from, from + step - 1);

        if (error) throw error;

        if (data && data.length > 0) {
            allRecords = [...allRecords, ...data];
            from += step;
            if (data.length < step) hasMore = false;
        } else {
            hasMore = false;
        }
    }
    
    // Lưu vào Cache khi thành công
    saveToCache(CACHE_KEYS.RECORDS, allRecords);
    return allRecords as RecordFile[];
  } catch (error) {
    logError("fetchRecords", error);
    // Fallback: Đọc từ Cache
    return getFromCache(CACHE_KEYS.RECORDS, MOCK_RECORDS);
  }
};

export const createRecordApi = async (record: RecordFile): Promise<RecordFile | null> => {
  if (!isConfigured) {
      // Offline Simulation
      const newRec = { ...record, id: Math.random().toString(36).substr(2, 9) };
      // Cập nhật cache local để UI hiển thị ngay
      const cached = getFromCache<RecordFile[]>(CACHE_KEYS.RECORDS, []);
      saveToCache(CACHE_KEYS.RECORDS, [newRec, ...cached]);
      return newRec;
  }
  try {
    const cleanRecord = sanitizeData(record, RECORD_DB_COLUMNS); 
    const { data, error } = await supabase.from('records').insert(cleanRecord).select().single();
    if (error) throw error;
    
    // Update cache
    const cached = getFromCache<RecordFile[]>(CACHE_KEYS.RECORDS, []);
    saveToCache(CACHE_KEYS.RECORDS, [data, ...cached]);
    
    return data;
  } catch (error) {
    logError("createRecordApi", error);
    return null;
  }
};

export const createRecordsBatchApi = async (records: RecordFile[]): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
      const cleanRecords = records.map(r => sanitizeData(r, RECORD_DB_COLUMNS));
      const { error } = await supabase.from('records').insert(cleanRecords);
      if (error) throw error;
      return true;
    } catch (error) {
      logError("createRecordsBatchApi", error);
      return false;
    }
  };

export const updateRecordApi = async (record: RecordFile): Promise<RecordFile | null> => {
  if (!isConfigured) return record;
  try {
    const cleanRecord = sanitizeData(record, RECORD_DB_COLUMNS);
    const { data, error } = await supabase.from('records').update(cleanRecord).eq('id', record.id).select().single();
    if (error) throw error;
    
    // Update cache
    const cached = getFromCache<RecordFile[]>(CACHE_KEYS.RECORDS, []);
    const updatedCache = cached.map(r => r.id === record.id ? data : r);
    saveToCache(CACHE_KEYS.RECORDS, updatedCache);

    return data;
  } catch (error) {
    logError("updateRecordApi", error);
    return null;
  }
};

export const deleteRecordApi = async (id: string): Promise<boolean> => {
  if (!isConfigured) return true;
  try {
    const { error } = await supabase.from('records').delete().eq('id', id);
    if (error) throw error;

    // Update cache
    const cached = getFromCache<RecordFile[]>(CACHE_KEYS.RECORDS, []);
    saveToCache(CACHE_KEYS.RECORDS, cached.filter(r => r.id !== id));

    return true;
  } catch (error) {
    logError("deleteRecordApi", error);
    return false;
  }
};

// --- API EMPLOYEES ---
export const fetchEmployees = async (): Promise<Employee[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES);
    try {
        const { data, error } = await supabase.from('employees').select('*');
        if (error) throw error;
        saveToCache(CACHE_KEYS.EMPLOYEES, data);
        return data as Employee[];
    } catch (e) { 
        logError("fetchEmployees", e);
        return getFromCache(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES); 
    }
};

export const saveEmployeeApi = async (employee: Employee, isUpdate: boolean): Promise<Employee | null> => {
    if (!isConfigured) return employee;
    try {
        const { data, error } = await supabase.from('employees').upsert(employee).select().single();
        if (error) throw error;
        return data;
    } catch (e) { logError("saveEmployeeApi", e); return null; }
};

export const deleteEmployeeApi = async (id: string): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const { error } = await supabase.from('employees').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (e) { logError("deleteEmployeeApi", e); return false; }
};

// --- API USERS ---
export const fetchUsers = async (): Promise<User[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.USERS, MOCK_USERS);
    try {
        const { data, error } = await supabase.from('users').select('*');
        if (error) throw error;
        saveToCache(CACHE_KEYS.USERS, data);
        return data as User[];
    } catch (e) { 
        logError("fetchUsers", e); 
        return getFromCache(CACHE_KEYS.USERS, MOCK_USERS);
    }
};

export const saveUserApi = async (user: User, isUpdate: boolean): Promise<User | null> => {
    if (!isConfigured) return user;
    try {
        const { data, error } = await supabase.from('users').upsert(user).select().single();
        if (error) throw error;
        return data;
    } catch (e) { logError("saveUserApi", e); return null; }
};

export const deleteUserApi = async (username: string): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const { error } = await supabase.from('users').delete().eq('username', username);
        if (error) throw error;
        return true;
    } catch (e) { logError("deleteUserApi", e); return false; }
};

// --- API EXCERPTS ---
export const fetchExcerptHistory = async () => {
  if (!isConfigured) return getFromCache(CACHE_KEYS.EXCERPT_HISTORY, []);
  try {
    const { data, error } = await supabase.from('excerpt_history').select('*').order('createdAt', { ascending: false }).limit(1000);
    if (error) throw error;
    saveToCache(CACHE_KEYS.EXCERPT_HISTORY, data);
    return data;
  } catch (e) { 
      logError("fetchExcerptHistory", e); 
      return getFromCache(CACHE_KEYS.EXCERPT_HISTORY, []);
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
    if (!isConfigured) return getFromCache(CACHE_KEYS.EXCERPT_COUNTERS, {'Minh Hưng': 100}); 
    try {
        const { data, error } = await supabase.from('excerpt_counters').select('*');
        if (error) throw error;
        const countersObj: Record<string, number> = {};
        data.forEach((row: any) => { countersObj[row.ward] = Number(row.count); });
        saveToCache(CACHE_KEYS.EXCERPT_COUNTERS, countersObj);
        return countersObj;
    } catch (e) { 
        logError("fetchExcerptCounters", e); 
        return getFromCache(CACHE_KEYS.EXCERPT_COUNTERS, {});
    }
};

export const saveExcerptCounters = async (counters: Record<string, number>) => {
    if (!isConfigured) return;
    try {
        const upsertData = Object.entries(counters).map(([ward, count]) => ({ ward, count }));
        const { error } = await supabase.from('excerpt_counters').upsert(upsertData);
        if (error) throw error;
    } catch (e) { logError("saveExcerptCounters", e); }
};

// --- API CONTRACTS ---
export const fetchContracts = async (): Promise<Contract[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.CONTRACTS, []);
    try {
        const { data, error } = await supabase.from('contracts').select('*').order('createdDate', { ascending: false });
        if (error) throw error;
        saveToCache(CACHE_KEYS.CONTRACTS, data);
        return data as Contract[];
    } catch (e) {
        logError("fetchContracts", e);
        return getFromCache(CACHE_KEYS.CONTRACTS, []);
    }
};

export const createContractApi = async (contract: Contract): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const cleanRecord = sanitizeData(contract, CONTRACT_DB_COLUMNS);
        const { error } = await supabase.from('contracts').insert(cleanRecord);
        if (error) throw error;
        return true;
    } catch (e) {
        logError("createContractApi", e);
        return false;
    }
};

// --- API PRICE LIST ---
export const fetchPriceList = async (): Promise<PriceItem[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.PRICE_LIST, []);
    try {
        const { data, error } = await supabase.from('price_list').select('*');
        if (error) throw error;
        const mapped = data.map(mapPriceFromDb);
        saveToCache(CACHE_KEYS.PRICE_LIST, mapped);
        return mapped;
    } catch (e) {
        logError("fetchPriceList", e);
        return getFromCache(CACHE_KEYS.PRICE_LIST, []);
    }
};

export const savePriceListBatch = async (items: PriceItem[]): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        await supabase.from('price_list').delete().neq('id', '0'); 
        const dbItems = items.map(mapPriceToDb);
        const { error } = await supabase.from('price_list').insert(dbItems);
        if (error) throw error;
        return true;
    } catch (e) {
        logError("savePriceListBatch", e);
        return false;
    }
};

// --- API HOLIDAYS ---
export const fetchHolidays = async (): Promise<Holiday[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.HOLIDAYS, []);
    try {
        const { data, error } = await supabase.from('holidays').select('*');
        if (error) throw error;
        const mapped = data.map((item: any) => ({
            id: item.id,
            name: item.name,
            day: item.day,
            month: item.month,
            isLunar: item.is_lunar
        }));
        saveToCache(CACHE_KEYS.HOLIDAYS, mapped);
        return mapped;
    } catch (e) {
        logError("fetchHolidays", e);
        return getFromCache(CACHE_KEYS.HOLIDAYS, []);
    }
};

export const saveHolidays = async (items: Holiday[]): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        await supabase.from('holidays').delete().neq('id', '0'); // Xóa cũ
        const dbItems = items.map(item => ({
            id: item.id,
            name: item.name,
            day: item.day,
            month: item.month,
            is_lunar: item.isLunar
        }));
        const { error } = await supabase.from('holidays').insert(dbItems);
        if (error) throw error;
        return true;
    } catch (e) {
        logError("saveHolidays", e);
        return false;
    }
};

// --- OTHER APIS (No heavy caching needed) ---
export const deleteAllDataApi = async (): Promise<boolean> => {
  if (!isConfigured) {
      alert("Đang ở chế độ Demo, không thể xóa dữ liệu Cloud.");
      return false;
  }
  try {
    const { error: err1 } = await supabase.from('records').delete().neq('id', '0');
    const { error: err2 } = await supabase.from('excerpt_history').delete().neq('id', '0');
    const { error: err3 } = await supabase.from('contracts').delete().neq('id', '0');
    if (err1 || err2 || err3) throw new Error("Lỗi xóa dữ liệu");
    
    // Clear cache
    localStorage.removeItem(CACHE_KEYS.RECORDS);
    localStorage.removeItem(CACHE_KEYS.EXCERPT_HISTORY);
    localStorage.removeItem(CACHE_KEYS.CONTRACTS);
    
    return true;
  } catch (error) {
    logError("deleteAllDataApi", error);
    return false;
  }
};

export const fetchChatGroups = async (): Promise<ChatGroup[]> => {
    if (!isConfigured) return [];
    try {
        const { data, error } = await supabase.from('chat_groups').select('*').order('created_at', { ascending: true });
        if (error) { if (error.code === '42P01') return []; throw error; }
        return data as ChatGroup[];
    } catch (e) { return []; }
};

export const createChatGroup = async (name: string, type: 'CUSTOM' | 'SYSTEM' = 'CUSTOM', user?: string, members?: string[]): Promise<ChatGroup | null> => {
    if (!isConfigured) return null;
    try {
        const newGroup = { id: Math.random().toString(36).substr(2, 9), name, type, created_by: user, created_at: new Date().toISOString(), members: members || null };
        const { data, error } = await supabase.from('chat_groups').insert(newGroup).select().single();
        if (error) throw error;
        return data;
    } catch (e) { logError("createChatGroup", e); return null; }
};

export const deleteChatGroup = async (id: string): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        const { error } = await supabase.from('chat_groups').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (e) { logError("deleteChatGroup", e); return false; }
};

export const addMemberToGroupApi = async (groupId: string, members: string[]): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        const { error } = await supabase.from('chat_groups').update({ members }).eq('id', groupId);
        if (error) throw error;
        return true;
    } catch (e) { logError("addMemberToGroupApi", e); return false; }
};

export const fetchMessages = async (limit = 50, groupId: string = 'GENERAL'): Promise<Message[]> => {
    if (!isConfigured) return [];
    try {
        let query = supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(limit);
        if (groupId === 'GENERAL') query = query.or(`group_id.eq.GENERAL,group_id.is.null`);
        else query = query.eq('group_id', groupId);
        const { data, error } = await query;
        if (error) throw error;
        return (data as Message[]).reverse();
    } catch (e) { logError("fetchMessages", e); return []; }
};

export const sendMessageApi = async (message: Omit<Message, 'id' | 'created_at'>): Promise<Message | null> => {
    if (!isConfigured) return null;
    try {
        const { data, error } = await supabase.from('messages').insert(message).select().single();
        if (error) throw error;
        return data as Message;
    } catch (e) { logError("sendMessageApi", e); return null; }
};

export const deleteMessageApi = async (id: string): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        const { error } = await supabase.from('messages').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (e) { logError("deleteMessageApi", e); return false; }
};

export const uploadChatFile = async (file: File): Promise<string | null> => {
    if (!isConfigured) return null;
    try {
        const safeName = sanitizeFileName(file.name);
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${safeName}`;
        const { error } = await supabase.storage.from('chat-files').upload(fileName, file);
        if (error) throw error;
        const { data } = supabase.storage.from('chat-files').getPublicUrl(fileName);
        return data.publicUrl;
    } catch (e) { logError("uploadChatFile", e); return null; }
};