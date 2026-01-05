
import { supabase, isConfigured } from './supabaseClient';
import { RecordFile } from '../types';
import { MOCK_RECORDS, API_BASE_URL } from '../constants';
import { logError, getFromCache, saveToCache, CACHE_KEYS, sanitizeData, normalizeCode } from './apiCore';

const RECORD_DB_COLUMNS = [
    'id', 'code', 'customerName', 'phoneNumber', 'cccd', 'ward', 'landPlot', 'mapSheet', 
    'area', 'address', 'group', 'content', 'recordType', 'receivedDate', 'deadline', 
    'assignedDate', 'submissionDate', 'approvalDate', 'completedDate', 'status', 'assignedTo', 
    'notes', 'privateNotes', 'personalNotes', 
    'authorizedBy', 'authDocType', 'otherDocs', 'exportBatch', 'exportDate', 
    'measurementNumber', 'excerptNumber',
    'reminderDate', 'lastRemindedAt',
    'receiptNumber', 'resultReturnedDate'
];

export const fetchRecords = async (): Promise<RecordFile[]> => {
  if (!isConfigured) {
      console.warn("Supabase chưa được cấu hình. Đang dùng dữ liệu Cache/Mock.");
      return getFromCache(CACHE_KEYS.RECORDS, MOCK_RECORDS);
  }

  try {
    let allRecords: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;
    let retryCount = 0;
    const maxRetries = 1;

    while (hasMore) {
        try {
            const { data, error } = await supabase
                .from('records')
                .select('*')
                .order('receivedDate', { ascending: false })
                .order('id', { ascending: true }) 
                .range(from, from + step - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                allRecords = [...allRecords, ...data];
                from += step;
                if (data.length < step) hasMore = false;
            } else {
                hasMore = false;
            }
        } catch (fetchError: any) {
            if (retryCount < maxRetries && (fetchError.message?.includes('fetch') || !fetchError.code)) {
                console.warn(`Lỗi fetchRecords, đang thử lại lần ${retryCount + 1}...`);
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue; 
            }
            throw fetchError;
        }
    }
    
    const uniqueMap = new Map();
    allRecords.forEach((item: any) => {
        if (item.id) uniqueMap.set(item.id, item);
    });
    const uniqueRecords = Array.from(uniqueMap.values());
    
    console.log(`[Fetch] Total fetched: ${uniqueRecords.length}`);
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

// Hàm này dùng cho chế độ Update từ Excel
export const forceUpdateRecordsBatchApi = async (records: RecordFile[]): Promise<{ success: boolean, count: number }> => {
    if (!isConfigured) return { success: true, count: 0 };
    
    const isSupabase = API_BASE_URL.includes('supabase.co');
    if (!isSupabase) {
        // Fallback cho Local Server (Giữ nguyên logic cũ hoặc đơn giản hóa)
        return { success: true, count: 0 };
    }

    try {
        const rawCodes = records.map(r => r.code).filter(c => c);
        if (rawCodes.length === 0) return { success: true, count: 0 };

        // 1. TẢI TOÀN BỘ DỮ LIỆU TỪ DB ĐỂ SO SÁNH (QUAN TRỌNG: Phải dùng loop để vượt giới hạn 1000 dòng)
        let allDbRecords: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('records')
                .select('*')
                .range(from, from + step - 1);
            
            if (error) throw error;

            if (data && data.length > 0) {
                allDbRecords = [...allDbRecords, ...data];
                from += step;
                if (data.length < step) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        // Tạo Map để tìm kiếm nhanh: Normalized Code -> Record
        const dbMap = new Map<string, any>();
        allDbRecords.forEach((r: any) => {
            if (r.code) {
                dbMap.set(normalizeCode(r.code), r);
            }
        });

        const updatesToPush: any[] = [];
        let updateCount = 0;

        records.forEach((excelRecord) => {
            const normCode = normalizeCode(excelRecord.code);
            const dbRecord = dbMap.get(normCode);
            
            if (dbRecord) {
                // LOGIC MERGE QUAN TRỌNG:
                // Bắt đầu với dữ liệu cũ (dbRecord)
                const merged = { ...dbRecord };
                let hasChange = false;

                // Duyệt qua các key của dữ liệu mới (excelRecord)
                Object.keys(excelRecord).forEach(key => {
                    const newVal = (excelRecord as any)[key];
                    
                    // CHỈ cập nhật nếu newVal có giá trị thực sự (không null, không undefined, không rỗng)
                    // Lưu ý: số 0 là giá trị hợp lệ, nên check type
                    const isValidValue = newVal !== null && newVal !== undefined && newVal !== '';
                    
                    if (isValidValue && key !== 'id') {
                        // So sánh lỏng (==) để tránh lỗi khác kiểu (ví dụ "1" vs 1)
                        if (String(merged[key]) !== String(newVal)) {
                            merged[key] = newVal;
                            hasChange = true;
                        }
                    }
                });

                if (hasChange) {
                    // Sanitize lần cuối để đảm bảo đúng định dạng DB
                    updatesToPush.push(sanitizeData(merged, RECORD_DB_COLUMNS));
                    updateCount++;
                }
            }
        });

        if (updatesToPush.length > 0) {
            // Upsert (Insert on conflict update)
            const { error: upsertError } = await supabase.from('records').upsert(updatesToPush);
            if (upsertError) throw upsertError;
        }

        return { success: true, count: updateCount };

    } catch (error) {
        logError("forceUpdateRecordsBatchApi", error);
        return { success: false, count: 0 };
    }
};