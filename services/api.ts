
import { supabase, isConfigured } from './supabaseClient';
import { RecordFile, Employee, User, Contract, PriceItem, Message, ChatGroup, Holiday, RecordStatus } from '../types';
import { MOCK_RECORDS, MOCK_EMPLOYEES, MOCK_USERS } from '../constants';
import { API_BASE_URL } from '../constants'; // Đảm bảo import này có sẵn hoặc định nghĩa URL

// --- CACHE KEYS ---
const CACHE_KEYS = {
    RECORDS: 'offline_records',
    EMPLOYEES: 'offline_employees',
    USERS: 'offline_users',
    CONTRACTS: 'offline_contracts',
    EXCERPT_HISTORY: 'offline_excerpt_history',
    EXCERPT_COUNTERS: 'offline_excerpt_counters',
    PRICE_LIST: 'offline_price_list',
    HOLIDAYS: 'offline_holidays',
    SYSTEM_CONFIG: 'offline_system_config'
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

// Hàm chuẩn hóa chuỗi để so sánh mã (Code) chính xác hơn
const normalizeCode = (code: any): string => {
    if (!code) return '';
    let str = String(code).trim().toLowerCase();
    // Loại bỏ các ký tự ẩn không in được (zero width space...)
    // eslint-disable-next-line no-control-regex
    str = str.replace(/[\u200B-\u200D\uFEFF]/g, '');
    return str;
};

const logError = (context: string, error: any) => {
    const msg = error?.message || JSON.stringify(error);
    const code = error?.code;

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
    } else if (code === '406') {
         console.warn(`⚠️ [Info] ${context}: Không tìm thấy dữ liệu (406).`);
    } else if (code === '22007' || code === '22008') {
         console.error(`❌ Lỗi tại ${context}: Dữ liệu ngày tháng không hợp lệ (Lỗi ${code}).`);
         alert(`LỖI DỮ LIỆU: File Excel chứa ngày tháng không hợp lệ (Ví dụ: "619-0032" hoặc "2025-06-60").\nVui lòng kiểm tra lại file Excel.`);
    } else if (code === '21000') {
         console.error(`❌ Lỗi tại ${context}: Dữ liệu trùng lặp trong cùng một yêu cầu (Lỗi ${code}).`);
         alert(`LỖI TRÙNG LẶP: File Excel có chứa nhiều dòng cùng Mã Hồ Sơ. Hệ thống đã cố gắng xử lý nhưng Server từ chối.\nVui lòng kiểm tra file Excel và xóa các dòng trùng lặp mã.`);
    } else {
        console.error(`❌ Lỗi tại ${context}:`, error);
    }
};

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

const RECORD_DB_COLUMNS = [
    'id', 'code', 'customerName', 'phoneNumber', 'cccd', 'ward', 'landPlot', 'mapSheet', 
    'area', 'address', 'group', 'content', 'recordType', 'receivedDate', 'deadline', 
    'assignedDate', 'submissionDate', 'approvalDate', 'completedDate', 'status', 'assignedTo', 'notes', 'privateNotes', 
    'authorizedBy', 'authDocType', 'otherDocs', 'exportBatch', 'exportDate', 
    'measurementNumber', 'excerptNumber'
];

const CONTRACT_DB_COLUMNS = [
    'id', 'code', 'customerName', 'phoneNumber', 'ward', 'address', 'landPlot', 'mapSheet', 'area',
    'contractType', 'serviceType', 'areaType', 'plotCount', 'markerCount', 'splitItems',
    'quantity', 'unitPrice', 'vatRate', 'vatAmount', 'totalAmount', 'deposit', 'content', 
    'createdDate', 'status'
];

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
    const dateFields = ['receivedDate', 'deadline', 'assignedDate', 'submissionDate', 'approvalDate', 'completedDate', 'createdDate', 'exportDate'];
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

// --- NEW FUNCTION: TEST DATABASE CONNECTION ---
export const testDatabaseConnection = async (): Promise<{ status: string, message: string }> => {
    if (!isConfigured) {
        return { status: 'OFFLINE', message: 'Hệ thống chưa nhận diện được URL hoặc Key của Supabase.' };
    }
    try {
        // Thử lấy 1 dòng từ bảng users để test quyền đọc
        const { data, error, status } = await supabase
            .from('users')
            .select('count')
            .limit(1)
            .maybeSingle();

        if (error) {
            if (error.code === '42P01') return { status: 'ERROR', message: 'Lỗi 42P01: Bảng dữ liệu chưa tồn tại. Hãy chạy mã SQL trong nút "Xem mã SQL".' };
            if (error.message.includes('FetchError')) return { status: 'ERROR', message: 'Lỗi mạng: Không thể kết nối tới URL Supabase. Kiểm tra lại đường dẫn.' };
            if (error.code === 'PGRST301') return { status: 'ERROR', message: 'Lỗi quyền (JWT): Key không hợp lệ hoặc đã hết hạn.' };
            return { status: 'ERROR', message: `Lỗi Supabase: ${error.message} (Code: ${error.code})` };
        }
        
        return { status: 'SUCCESS', message: 'Kết nối thành công! Đã đọc được dữ liệu từ Supabase.' };

    } catch (e: any) {
        return { status: 'ERROR', message: `Lỗi ngoại lệ: ${e.message}` };
    }
};

// --- SYSTEM SETTINGS (CẤU HÌNH HỆ THỐNG) ---

export const fetchUpdateInfo = async (): Promise<{ version: string | null, url: string | null }> => {
    if (!isConfigured) return { version: null, url: null };
    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('key, value')
            .in('key', ['app_version', 'app_update_url']);
            
        if (error) throw error;
        
        let version = null;
        let url = null;

        if (data) {
            data.forEach((item: any) => {
                if (item.key === 'app_version') version = item.value;
                if (item.key === 'app_update_url') url = item.value;
            });
        }
        return { version, url };
    } catch (e: any) {
        if (e?.code === '42P01') return { version: null, url: null };
        logError("fetchUpdateInfo", e);
        return { version: null, url: null };
    }
};

export const fetchLatestVersion = async (): Promise<string | null> => {
    const info = await fetchUpdateInfo();
    return info.version;
};

export const saveUpdateInfo = async (version: string, url: string): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        const updates = [
            { key: 'app_version', value: version },
            { key: 'app_update_url', value: url }
        ];
        const { error } = await supabase.from('system_settings').upsert(updates);
        if (error) throw error;
        return true;
    } catch (e) {
        logError("saveUpdateInfo", e);
        return false;
    }
};

// Hàm lấy cấu hình hệ thống (dùng chung cho Template URL, v.v.)
export const getSystemSetting = async (key: string): Promise<string | null> => {
    if (!isConfigured) return null;
    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', key)
            .single();
        if (error) throw error;
        return data?.value || null;
    } catch (error) {
        // logError("getSystemSetting", error); // Tắt log lỗi này để tránh spam console khi không tìm thấy key
        return null;
    }
};

// Hàm lưu cấu hình hệ thống
export const saveSystemSetting = async (key: string, value: string): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        const { error } = await supabase
            .from('system_settings')
            .upsert({ key, value });
        if (error) throw error;
        return true;
    } catch (error) {
        logError("saveSystemSetting", error);
        return false;
    }
};

export const updateLatestVersion = async (version: string): Promise<boolean> => {
    return saveUpdateInfo(version, ''); 
};

export const fetchRecords = async (): Promise<RecordFile[]> => {
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
    
    // FIX: Lọc trùng lặp ID (Deduplication) để tránh lỗi "Duplicate Key" trong React
    const uniqueMap = new Map();
    allRecords.forEach((item: any) => {
        uniqueMap.set(item.id, item);
    });
    const uniqueRecords = Array.from(uniqueMap.values());

    saveToCache(CACHE_KEYS.RECORDS, uniqueRecords);
    return uniqueRecords as RecordFile[];
  } catch (error) {
    logError("fetchRecords", error);
    return getFromCache(CACHE_KEYS.RECORDS, MOCK_RECORDS);
  }
};

export const createRecordApi = async (record: RecordFile): Promise<RecordFile | null> => {
    if (!isConfigured) return record;
    try {
        const payload = sanitizeData(record, RECORD_DB_COLUMNS);
        const { data, error } = await supabase.from('records').insert([payload]).select();
        if (error) throw error;
        return data?.[0] as RecordFile;
    } catch (error) {
        logError("createRecordApi", error);
        return null;
    }
};

export const updateRecordApi = async (record: RecordFile): Promise<RecordFile | null> => {
    if (!isConfigured) return record;
    try {
        const payload = sanitizeData(record, RECORD_DB_COLUMNS);
        const { data, error } = await supabase.from('records').update(payload).eq('id', record.id).select();
        if (error) throw error;
        return data?.[0] as RecordFile;
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
        return true;
    } catch (error) {
        logError("deleteRecordApi", error);
        return false;
    }
};

export const createRecordsBatchApi = async (records: RecordFile[]): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const payload = records.map(r => sanitizeData(r, RECORD_DB_COLUMNS));
        const { error } = await supabase.from('records').insert(payload);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("createRecordsBatchApi", error);
        return false;
    }
};

// --- NEW FUNCTION: UPDATE MISSING FIELDS ONLY ---
export const updateMissingFieldsBatchApi = async (records: RecordFile[]): Promise<{ success: boolean, count: number }> => {
    if (!isConfigured) return { success: true, count: 0 };
    
    // Kiểm tra xem đang chạy trên Supabase (Cloud) hay JSON Server (Local)
    const isSupabase = API_BASE_URL.includes('supabase.co');

    if (isSupabase) {
        try {
            const { data: existingRecords, error } = await supabase
                .from('records')
                .select('id, code'); 
            
            if (error) throw error;
            
            const dbMap = new Map();
            if (existingRecords) {
                existingRecords.forEach((r: any) => {
                    dbMap.set(normalizeCode(r.code), r);
                });
            }

            const updatesToPush: any[] = [];
            let updateCount = 0;

            const idsToFetch: string[] = [];
            const excelMapByCode = new Map<string, RecordFile>();

            records.forEach(excelRecord => {
                const normCode = normalizeCode(excelRecord.code);
                const dbRecord = dbMap.get(normCode);
                if (dbRecord) {
                    idsToFetch.push(dbRecord.id);
                    excelMapByCode.set(normCode, excelRecord);
                }
            });

            if (idsToFetch.length === 0) return { success: true, count: 0 };

            const { data: fullDbRecords, error: fetchError } = await supabase
                .from('records')
                .select('*')
                .in('id', idsToFetch);

            if (fetchError) throw fetchError;

            if (fullDbRecords) {
                fullDbRecords.forEach((dbRecord: any) => {
                    const normCode = normalizeCode(dbRecord.code);
                    const excelRecord = excelMapByCode.get(normCode);

                    if (excelRecord) {
                        let changed = false;
                        const updatedRecord = { ...dbRecord };

                        Object.keys(excelRecord).forEach(key => {
                            if (key === 'id' || key === 'status') return; 
                            
                            const dbVal = dbRecord[key];
                            const newVal = (excelRecord as any)[key];
                            const isDbEmpty = dbVal === null || dbVal === undefined || dbVal === '' || dbVal === 'Nhập từ Excel';
                            const isNewHasData = newVal !== null && newVal !== undefined && newVal !== '';

                            if (isDbEmpty && isNewHasData) {
                                updatedRecord[key] = newVal;
                                changed = true;
                            }
                        });

                        if (changed) {
                            updatesToPush.push(sanitizeData(updatedRecord, RECORD_DB_COLUMNS));
                            updateCount++;
                        }
                    }
                });
            }

            if (updatesToPush.length > 0) {
                // Sửa lỗi 21000: Dùng Map để loại bỏ bản ghi trùng ID trong payload
                const uniqueUpdates = new Map();
                updatesToPush.forEach(item => uniqueUpdates.set(item.id, item));
                const finalPayload = Array.from(uniqueUpdates.values());

                const { error: upsertError } = await supabase.from('records').upsert(finalPayload);
                if (upsertError) throw upsertError;
            }

            return { success: true, count: updateCount };

        } catch (error) {
            logError("updateMissingFieldsBatchApi (Supabase)", error);
            return { success: false, count: 0 };
        }
    } else {
        // LOGIC CHO JSON SERVER (LOCAL)
        try {
            const response = await fetch(`${API_BASE_URL}/custom/update-missing`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(records)
            });
            
            if (!response.ok) throw new Error('Network response was not ok');
            const result = await response.json();
            return { success: true, count: result.count || 0 };
        } catch (error) {
            logError("updateMissingFieldsBatchApi (Local)", error);
            return { success: false, count: 0 };
        }
    }
};

// --- NEW FUNCTION: FORCE UPDATE (OVERWRITE) RECORDS FROM EXCEL ---
export const forceUpdateRecordsBatchApi = async (records: RecordFile[]): Promise<{ success: boolean, count: number }> => {
    if (!isConfigured) return { success: true, count: 0 };
    
    const isSupabase = API_BASE_URL.includes('supabase.co');
    if (!isSupabase) {
        return updateMissingFieldsBatchApi(records);
    }

    try {
        const rawCodes = records.map(r => r.code).filter(c => c);
        if (rawCodes.length === 0) return { success: true, count: 0 };

        const { data: existingRecords, error } = await supabase
            .from('records')
            .select('id, code');
        
        if (error) throw error;

        const updatesToPush: any[] = [];
        let updateCount = 0;

        const dbMap = new Map();
        if (existingRecords) {
            existingRecords.forEach((r: any) => {
                dbMap.set(normalizeCode(r.code), r);
            });
        }

        records.forEach((excelRecord) => {
            const normCode = normalizeCode(excelRecord.code);
            const dbRecord = dbMap.get(normCode);
            
            if (dbRecord) {
                updatesToPush.push(sanitizeData({
                    ...excelRecord,
                    id: dbRecord.id 
                }, RECORD_DB_COLUMNS));
                updateCount++;
            }
        });

        const idsToUpdate = updatesToPush.map(u => u.id);
        if (idsToUpdate.length === 0) return { success: true, count: 0 };

        const { data: fullDbRecords, error: fetchFullError } = await supabase
            .from('records')
            .select('*')
            .in('id', idsToUpdate);
            
        if (fetchFullError) throw fetchFullError;
        
        // FIX ERROR 21000: Sử dụng Map để đảm bảo ID duy nhất trong payload
        // Nếu file Excel có 2 dòng cùng mã (trùng ID), dòng sau sẽ ghi đè dòng trước.
        const finalPayloadMap = new Map();
        
        updatesToPush.forEach(updateItem => {
            const oldRecord = fullDbRecords?.find(r => r.id === updateItem.id);
            if (oldRecord) {
                const merged = { ...oldRecord };
                Object.keys(updateItem).forEach(key => {
                    const val = updateItem[key];
                    if (val !== null && val !== undefined && val !== '') {
                        merged[key] = val;
                    }
                });
                const sanitized = sanitizeData(merged, RECORD_DB_COLUMNS);
                finalPayloadMap.set(sanitized.id, sanitized);
            }
        });

        const finalPayload = Array.from(finalPayloadMap.values());

        if (finalPayload.length > 0) {
            const { error: upsertError } = await supabase.from('records').upsert(finalPayload);
            if (upsertError) throw upsertError;
        }

        return { success: true, count: updateCount };

    } catch (error) {
        logError("forceUpdateRecordsBatchApi", error);
        return { success: false, count: 0 };
    }
};

export const deleteAllDataApi = async (): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        await supabase.from('records').delete().neq('id', '0');
        await supabase.from('contracts').delete().neq('id', '0');
        await supabase.from('excerpt_history').delete().neq('id', '0');
        return true;
    } catch (error) {
        logError("deleteAllDataApi", error);
        return false;
    }
};

// --- EMPLOYEES ---
export const fetchEmployees = async (): Promise<Employee[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES);
    try {
        const { data, error } = await supabase.from('employees').select('*');
        if (error) throw error;
        saveToCache(CACHE_KEYS.EMPLOYEES, data);
        return data as Employee[];
    } catch (error) {
        logError("fetchEmployees", error);
        return getFromCache(CACHE_KEYS.EMPLOYEES, MOCK_EMPLOYEES);
    }
};

export const saveEmployeeApi = async (employee: Employee, isUpdate: boolean): Promise<Employee | null> => {
    if (!isConfigured) return employee;
    try {
        if (isUpdate) {
            const { data, error } = await supabase.from('employees').update(employee).eq('id', employee.id).select();
            if (error) throw error;
            return data?.[0] as Employee;
        } else {
            const { data, error } = await supabase.from('employees').insert([employee]).select();
            if (error) throw error;
            return data?.[0] as Employee;
        }
    } catch (error) {
        logError("saveEmployeeApi", error);
        return null;
    }
};

export const deleteEmployeeApi = async (id: string): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const { error } = await supabase.from('employees').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteEmployeeApi", error);
        return false;
    }
};

// --- USERS ---
export const fetchUsers = async (): Promise<User[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.USERS, MOCK_USERS);
    try {
        const { data, error } = await supabase.from('users').select('*');
        if (error) throw error;
        saveToCache(CACHE_KEYS.USERS, data);
        return data as User[];
    } catch (error) {
        logError("fetchUsers", error);
        return getFromCache(CACHE_KEYS.USERS, MOCK_USERS);
    }
};

export const saveUserApi = async (user: User, isUpdate: boolean): Promise<User | null> => {
    if (!isConfigured) return user;
    try {
        if (isUpdate) {
            const { data, error } = await supabase.from('users').update(user).eq('username', user.username).select();
            if (error) throw error;
            return data?.[0] as User;
        } else {
            const { data, error } = await supabase.from('users').insert([user]).select();
            if (error) throw error;
            return data?.[0] as User;
        }
    } catch (error) {
        logError("saveUserApi", error);
        return null;
    }
};

export const deleteUserApi = async (username: string): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const { error } = await supabase.from('users').delete().eq('username', username);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteUserApi", error);
        return false;
    }
};

// --- EXCERPTS ---
export const fetchExcerptHistory = async (): Promise<any[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.EXCERPT_HISTORY, []);
    try {
        const { data, error } = await supabase.from('excerpt_history').select('*').order('createdAt', { ascending: false }).limit(200);
        if (error) throw error;
        saveToCache(CACHE_KEYS.EXCERPT_HISTORY, data);
        return data;
    } catch (error) {
        logError("fetchExcerptHistory", error);
        return getFromCache(CACHE_KEYS.EXCERPT_HISTORY, []);
    }
};

export const saveExcerptRecord = async (record: any): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const { error } = await supabase.from('excerpt_history').insert([record]);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("saveExcerptRecord", error);
        return false;
    }
};

export const fetchExcerptCounters = async (): Promise<Record<string, number>> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.EXCERPT_COUNTERS, {});
    try {
        const { data, error } = await supabase.from('excerpt_counters').select('*');
        if (error) throw error;
        const counters: Record<string, number> = {};
        data.forEach((item: any) => {
            counters[item.ward] = item.count;
        });
        saveToCache(CACHE_KEYS.EXCERPT_COUNTERS, counters);
        return counters;
    } catch (error) {
        logError("fetchExcerptCounters", error);
        return getFromCache(CACHE_KEYS.EXCERPT_COUNTERS, {});
    }
};

export const saveExcerptCounters = async (counters: Record<string, number>): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const upsertData = Object.entries(counters).map(([ward, count]) => ({ ward, count }));
        const { error } = await supabase.from('excerpt_counters').upsert(upsertData);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("saveExcerptCounters", error);
        return false;
    }
};

// --- HOLIDAYS ---
export const fetchHolidays = async (): Promise<Holiday[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.HOLIDAYS, []);
    try {
        const { data, error } = await supabase.from('holidays').select('*');
        if (error) throw error;
        
        const mapped = data.map((h: any) => ({
            id: h.id,
            name: h.name,
            day: h.day,
            month: h.month,
            isLunar: h.is_lunar
        }));
        saveToCache(CACHE_KEYS.HOLIDAYS, mapped);
        return mapped;
    } catch (error) {
        logError("fetchHolidays", error);
        return getFromCache(CACHE_KEYS.HOLIDAYS, []);
    }
};

export const saveHolidays = async (holidays: Holiday[]): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        await supabase.from('holidays').delete().neq('id', '0');
        const dbHolidays = holidays.map(h => ({
            id: h.id,
            name: h.name,
            day: h.day,
            month: h.month,
            is_lunar: h.isLunar
        }));
        const { error } = await supabase.from('holidays').insert(dbHolidays);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("saveHolidays", error);
        return false;
    }
};

// --- CONTRACTS ---
export const fetchContracts = async (): Promise<Contract[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.CONTRACTS, []);
    try {
        const { data, error } = await supabase.from('contracts').select('*').order('createdDate', { ascending: false });
        if (error) throw error;
        saveToCache(CACHE_KEYS.CONTRACTS, data);
        return data as Contract[];
    } catch (error) {
        logError("fetchContracts", error);
        return getFromCache(CACHE_KEYS.CONTRACTS, []);
    }
};

export const createContractApi = async (contract: Contract): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const payload = sanitizeData(contract, CONTRACT_DB_COLUMNS);
        const { error } = await supabase.from('contracts').insert([payload]);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("createContractApi", error);
        return false;
    }
};

// --- PRICE LIST ---
export const fetchPriceList = async (): Promise<PriceItem[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.PRICE_LIST, []);
    try {
        const { data, error } = await supabase.from('price_list').select('*');
        if (error) throw error;
        const items = data.map(mapPriceFromDb);
        saveToCache(CACHE_KEYS.PRICE_LIST, items);
        return items;
    } catch (error) {
        logError("fetchPriceList", error);
        return getFromCache(CACHE_KEYS.PRICE_LIST, []);
    }
};

export const savePriceListBatch = async (items: PriceItem[]): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        await supabase.from('price_list').delete().neq('id', '0'); 
        if (items.length === 0) return true;
        const dbItems = items.map(mapPriceToDb);
        const { error } = await supabase.from('price_list').insert(dbItems);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("savePriceListBatch", error);
        return false;
    }
};

// --- CHAT & GROUPS ---
export const fetchChatGroups = async (): Promise<ChatGroup[]> => {
    if (!isConfigured) return [];
    try {
        const { data, error } = await supabase.from('chat_groups').select('*').order('created_at', { ascending: true });
        if (error) throw error;
        return data as ChatGroup[];
    } catch (error) {
        logError("fetchChatGroups", error);
        return [];
    }
};

export const createChatGroup = async (name: string, type: 'CUSTOM' | 'SYSTEM', creator: string, members: string[]): Promise<ChatGroup | null> => {
    if (!isConfigured) return null;
    try {
        const newGroup = {
            id: `GROUP_${Math.random().toString(36).substr(2, 9)}`,
            name,
            type,
            created_by: creator,
            members: members
        };
        const { data, error } = await supabase.from('chat_groups').insert([newGroup]).select();
        if (error) throw error;
        return data?.[0] as ChatGroup;
    } catch (error) {
        logError("createChatGroup", error);
        return null;
    }
};

export const deleteChatGroup = async (id: string): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        await supabase.from('messages').delete().eq('group_id', id);
        const { error } = await supabase.from('chat_groups').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteChatGroup", error);
        return false;
    }
};

export const addMemberToGroupApi = async (groupId: string, members: string[]): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        const { error } = await supabase.from('chat_groups').update({ members }).eq('id', groupId);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("addMemberToGroupApi", error);
        return false;
    }
};

export const fetchMessages = async (limit: number = 50, groupId: string = 'GENERAL'): Promise<Message[]> => {
    if (!isConfigured) return [];
    try {
        let query = supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(limit);
        
        if (groupId === 'GENERAL') {
            query = query.or(`group_id.eq.GENERAL,group_id.is.null`);
        } else {
            query = query.eq('group_id', groupId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).reverse() as Message[];
    } catch (error) {
        logError("fetchMessages", error);
        return [];
    }
};

export const sendMessageApi = async (msg: Partial<Message>): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        const { error } = await supabase.from('messages').insert([msg]);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("sendMessageApi", error);
        return false;
    }
};

export const toggleReactionApi = async (msgId: string, username: string, emoji: string): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        const { data, error: fetchError } = await supabase
            .from('messages')
            .select('reactions')
            .eq('id', msgId)
            .single();
            
        if (fetchError) throw fetchError;

        const currentReactions: Record<string, string> = data?.reactions || {};

        if (currentReactions[username] === emoji) {
            delete currentReactions[username];
        } else {
            currentReactions[username] = emoji;
        }

        const { error: updateError } = await supabase
            .from('messages')
            .update({ reactions: currentReactions })
            .eq('id', msgId);

        if (updateError) throw updateError;
        return true;
    } catch (error) {
        logError("toggleReactionApi", error);
        return false;
    }
};

export const deleteMessageApi = async (id: string): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        const { error } = await supabase.from('messages').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteMessageApi", error);
        return false;
    }
};

export const uploadChatFile = async (file: File): Promise<string | null> => {
    if (!isConfigured) return null;
    try {
        const fileName = `${Date.now()}_${sanitizeFileName(file.name)}`;
        const { data, error } = await supabase.storage.from('chat-files').upload(fileName, file);
        if (error) throw error;
        
        const { data: publicData } = supabase.storage.from('chat-files').getPublicUrl(fileName);
        return publicData.publicUrl;
    } catch (error) {
        logError("uploadChatFile", error);
        return null;
    }
};
