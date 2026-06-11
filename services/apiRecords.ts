import { supabase, isConfigured } from './supabaseClient';
import { RecordFile, RecordStatus } from '../types';
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
    'receiptNumber', 'resultReturnedDate', 'receiverName',
    'needsMapCorrection', // Cột mới
    'plotCount',
    'createdBy', // Người tiếp nhận hồ sơ
    'workCompletedDate' // Cột vật lý lưu ngày Đã thực hiện
];

// Helper functions to serialize and deserialize workCompletedDate inside privateNotes securely
export const packRecord = (record: RecordFile): RecordFile => {
    const copy = { ...record };
    
    // Vì đã có cột vật lý trực tiếp 'workCompletedDate' nên không cần đóng gói vào privateNotes nữa.
    // Tuy nhiên, ta vẫn dọn dẹp các thẻ [WCD:...] cũ nếu có trong privateNotes để ghi chú luôn sạch sẽ.
    if (copy.privateNotes) {
        const cleanedNotes = copy.privateNotes.replace(/\[WCD:\d{4}-\d{2}-\d{2}\]/g, '').trim();
        copy.privateNotes = cleanedNotes === '' ? null : cleanedNotes;
    }
    return copy;
};

export const unpackRecord = (record: RecordFile): RecordFile => {
    const copy = { ...record };
    
    // Nếu privateNotes có chứa [WCD:YYYY-MM-DD], ta vẫn phân tích để lấy giá trị cho trường hợp dữ liệu cũ lưu dưới dạng text
    if (copy.privateNotes) {
        const match = copy.privateNotes.match(/\[WCD:(\d{4}-\d{2}-\d{2})\]/);
        if (match) {
            // Ưu tiên cột vật lý có sẵn, nếu chưa có thì fallback về dữ liệu cũ trong privateNotes
            if (!copy.workCompletedDate) {
                copy.workCompletedDate = match[1];
            }
            // Dọn dẹp thẻ tag trong privateNotes cho giao diện sạch sẽ
            const cleanedNotes = copy.privateNotes.replace(/\[WCD:\d{4}-\d{2}-\d{2}\]/g, '').trim();
            copy.privateNotes = cleanedNotes === '' ? null : cleanedNotes;
        }
    }
    return copy;
};

let CACHED_RECORDS: RecordFile[] = [];
let IS_CACHED_RECORDS_LOADED = false;
let IS_REALTIME_SUBSCRIBED = false;

// Function to clear cache
export const clearRecordsCache = () => {
    IS_CACHED_RECORDS_LOADED = false;
    CACHED_RECORDS = [];
};

export const initRealtimeRecords = () => {
    if (!isConfigured || IS_REALTIME_SUBSCRIBED) return;
    IS_REALTIME_SUBSCRIBED = true;

    supabase.channel('public:records')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, (payload) => {
            let changed = false;
            if (payload.eventType === 'INSERT') {
                const unpackedNew = unpackRecord(payload.new as RecordFile);
                if (!CACHED_RECORDS.find(r => r.id === unpackedNew.id)) {
                    CACHED_RECORDS.unshift(unpackedNew);
                    changed = true;
                }
            } else if (payload.eventType === 'UPDATE') {
                const unpackedNew = unpackRecord(payload.new as RecordFile);
                const idx = CACHED_RECORDS.findIndex(r => r.id === unpackedNew.id);
                if (idx !== -1) {
                    CACHED_RECORDS[idx] = unpackedNew;
                    changed = true;
                } else {
                    CACHED_RECORDS.unshift(unpackedNew);
                    changed = true;
                }
            } else if (payload.eventType === 'DELETE') {
                const beforeLen = CACHED_RECORDS.length;
                CACHED_RECORDS = CACHED_RECORDS.filter(r => r.id !== payload.old.id);
                if (CACHED_RECORDS.length < beforeLen) changed = true;
            }

            if (changed) {
                // Dispatch custom event to notify React components
                window.dispatchEvent(new CustomEvent('records_realtime_update'));
            }
        })
        .subscribe();
};

export const fetchRecords = async (forceUpdate: boolean = false): Promise<RecordFile[]> => {
  if (!isConfigured) {
      console.warn("Supabase chưa được cấu hình. Đang dùng dữ liệu Cache/Mock.");
      return getFromCache(CACHE_KEYS.RECORDS, MOCK_RECORDS);
  }

  // Return from cache to save egress!
  if (!forceUpdate && IS_CACHED_RECORDS_LOADED) {
      return [...CACHED_RECORDS];
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
                const unpackedData = data.map(r => unpackRecord(r as RecordFile));
                allRecords = [...allRecords, ...unpackedData];
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
    
    CACHED_RECORDS = uniqueRecords as RecordFile[];
    IS_CACHED_RECORDS_LOADED = true;
    
    return CACHED_RECORDS;

  } catch (error) {
    logError("fetchRecords", error);
    return getFromCache(CACHE_KEYS.RECORDS, MOCK_RECORDS);
  }
};

export const createRecordApi = async (record: RecordFile): Promise<RecordFile | null> => {
    if (!isConfigured) return { ...record, createdBy: record.createdBy || null };
    try {
        const packed = packRecord(record);
        const payload = sanitizeData(packed, RECORD_DB_COLUMNS);
        const { data, error } = await supabase.from('records').insert([payload]).select();
        
        if (error) {
            const errCode = (error as any).code;
            const errMsg = String((error as any).message || '');
            if (errCode === 'PGRST204' || errCode === '42703' || errMsg.includes('createdBy') || errMsg.includes('plotCount') || errMsg.includes('workCompletedDate')) {
                console.warn("⚠️ [Database out of sync] Thử lại createRecordApi loại bỏ cột lỗi...");
                let fallbackColumns = RECORD_DB_COLUMNS.slice();
                if (errCode === '42703' || errMsg.includes('createdBy')) {
                    fallbackColumns = fallbackColumns.filter(col => col !== 'createdBy');
                }
                if (errCode === 'PGRST204' || errMsg.includes('plotCount')) {
                    fallbackColumns = fallbackColumns.filter(col => col !== 'plotCount');
                }
                if (errMsg.includes('workCompletedDate')) {
                    fallbackColumns = fallbackColumns.filter(col => col !== 'workCompletedDate');
                }
                const fallbackPayload = sanitizeData(packed, fallbackColumns);
                const { data: fbData, error: fbError } = await supabase.from('records').insert([fallbackPayload]).select();
                
                if (fbError) {
                    // Thử an toàn hoàn toàn bằng cách loại bỏ cả plotCount lẫn createdBy
                    const safeColumns = RECORD_DB_COLUMNS.filter(col => col !== 'plotCount' && col !== 'createdBy');
                    const safePayload = sanitizeData(packed, safeColumns);
                    const { data: safeData, error: safeError } = await supabase.from('records').insert([safePayload]).select();
                    if (safeError) throw safeError;
                    if (safeData?.[0]) {
                        const unpacked = unpackRecord(safeData[0] as RecordFile);
                        if (IS_CACHED_RECORDS_LOADED) CACHED_RECORDS.unshift(unpacked);
                        return unpacked;
                    }
                }
                if (fbData?.[0]) {
                    const unpacked = unpackRecord(fbData[0] as RecordFile);
                    if (IS_CACHED_RECORDS_LOADED) CACHED_RECORDS.unshift(unpacked);
                    return unpacked;
                }
            }
            throw error;
        }
        
        if (data?.[0]) {
            const unpacked = unpackRecord(data[0] as RecordFile);
            if (IS_CACHED_RECORDS_LOADED) CACHED_RECORDS.unshift(unpacked);
            return unpacked;
        }
        return null;
    } catch (error) {
        logError("createRecordApi", error);
        return null;
    }
};

export const updateRecordApi = async (record: RecordFile): Promise<RecordFile | null> => {
    if (!isConfigured) return record;
    try {
        const packed = packRecord(record);
        const payload = sanitizeData(packed, RECORD_DB_COLUMNS);
        const { data, error } = await supabase.from('records').update(payload).eq('id', record.id).select();
        
        if (error) {
            const errCode = (error as any).code;
            const errMsg = String((error as any).message || '');
            if (errCode === 'PGRST204' || errCode === '42703' || errMsg.includes('createdBy') || errMsg.includes('plotCount') || errMsg.includes('workCompletedDate')) {
                console.warn("⚠️ [Database out of sync] Thử lại updateRecordApi loại bỏ cột lỗi...");
                let fallbackColumns = RECORD_DB_COLUMNS.slice();
                if (errCode === '42703' || errMsg.includes('createdBy')) {
                    fallbackColumns = fallbackColumns.filter(col => col !== 'createdBy');
                }
                if (errCode === 'PGRST204' || errMsg.includes('plotCount')) {
                    fallbackColumns = fallbackColumns.filter(col => col !== 'plotCount');
                }
                if (errMsg.includes('workCompletedDate')) {
                    fallbackColumns = fallbackColumns.filter(col => col !== 'workCompletedDate');
                }
                const fallbackPayload = sanitizeData(packed, fallbackColumns);
                const { data: fbData, error: fbError } = await supabase.from('records').update(fallbackPayload).eq('id', record.id).select();
                
                if (fbError) {
                    const safeColumns = RECORD_DB_COLUMNS.filter(col => col !== 'plotCount' && col !== 'createdBy');
                    const safePayload = sanitizeData(packed, safeColumns);
                    const { data: safeData, error: safeError } = await supabase.from('records').update(safePayload).eq('id', record.id).select();
                    if (safeError) throw safeError;
                    if (safeData?.[0]) {
                        const unpacked = unpackRecord(safeData[0] as RecordFile);
                        if (IS_CACHED_RECORDS_LOADED) {
                            const idx = CACHED_RECORDS.findIndex(r => r.id === unpacked.id);
                            if (idx !== -1) CACHED_RECORDS[idx] = unpacked;
                        }
                        return unpacked;
                    }
                }
                if (fbData?.[0]) {
                    const unpacked = unpackRecord(fbData[0] as RecordFile);
                    if (IS_CACHED_RECORDS_LOADED) {
                        const idx = CACHED_RECORDS.findIndex(r => r.id === unpacked.id);
                        if (idx !== -1) CACHED_RECORDS[idx] = unpacked;
                    }
                    return unpacked;
                }
            }
            throw error;
        }
        
        if (data?.[0]) {
            const unpacked = unpackRecord(data[0] as RecordFile);
            if (IS_CACHED_RECORDS_LOADED) {
                const idx = CACHED_RECORDS.findIndex(r => r.id === unpacked.id);
                if (idx !== -1) CACHED_RECORDS[idx] = unpacked;
            }
            return unpacked;
        }
        return null;
    } catch (error) {
        logError("updateRecordApi", error);
        return null;
    }
};

export const deleteRecordApi = async (id: string): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const { error, data } = await supabase.from('records').delete().eq('id', id).select().single();
        
        if (error) {
           if (IS_CACHED_RECORDS_LOADED) CACHED_RECORDS = CACHED_RECORDS.filter(r => r.id !== id);
        } else if (data) {
           if (IS_CACHED_RECORDS_LOADED) CACHED_RECORDS = CACHED_RECORDS.filter(r => r.id !== id);
        }
        
        return true;
    } catch (error) {
        logError("deleteRecordApi", error);
        return false;
    }
};

export const createRecordsBatchApi = async (records: RecordFile[]): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        const payload = records.map(r => sanitizeData(packRecord(r), RECORD_DB_COLUMNS));
        const { error, data } = await supabase.from('records').insert(payload).select();
        if (error) throw error;
        
        if (data && IS_CACHED_RECORDS_LOADED) {
            const unpackedData = data.map(r => unpackRecord(r as RecordFile));
            CACHED_RECORDS = [...unpackedData, ...CACHED_RECORDS];
        }
        return true;
    } catch (error) {
        logError("createRecordsBatchApi", error);
        return false;
    }
};

export interface OnlineRecord {
    id: string;
    code: string;
    customerName: string;
    cccd: string;
    phoneNumber: string;
    address: string;
    ward: string;
    landPlot: string;
    mapSheet: string;
    content: string;
    recordType: string;
    status: string; // 'pending', 'approved', 'rejected'
    created_at: string;
    data?: any;
}

const MOCK_ONLINE: OnlineRecord[] = [];

export const submitOnlineRecordApi = async (record: Partial<OnlineRecord>): Promise<boolean> => {
    if (!isConfigured) {
        const newRec = { ...record, id: Math.random().toString(36).substr(2, 9), created_at: new Date().toISOString(), status: 'pending' } as OnlineRecord;
        MOCK_ONLINE.unshift(newRec);
        return true;
    }
    try {
        const { error } = await supabase.from('online_records').insert([record]);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("submitOnlineRecordApi", error);
        return false;
    }
};

export const fetchOnlineSubmissionsApi = async (): Promise<OnlineRecord[]> => {
    if (!isConfigured) return MOCK_ONLINE;
    try {
        const { data, error } = await supabase
            .from('online_records')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as OnlineRecord[];
    } catch (error) {
        logError("fetchOnlineSubmissionsApi", error);
        return MOCK_ONLINE;
    }
};

export const processOnlineSubmissionApi = async (id: string, action: 'approve' | 'reject'): Promise<boolean> => {
    if (!isConfigured) {
        const idx = MOCK_ONLINE.findIndex(r => r.id === id);
        if (idx !== -1) {
            MOCK_ONLINE[idx].status = action === 'approve' ? 'approved' : 'rejected';
        }
        return true;
    }
    try {
        const { error } = await supabase.from('online_records').update({ status: action === 'approve' ? 'approved' : 'rejected' }).eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("processOnlineSubmissionApi", error);
        return false;
    }
};

export const forceUpdateRecordsBatchApi = async (records: RecordFile[]): Promise<{ success: boolean, count: number }> => {
    if (!isConfigured) return { success: true, count: 0 };
    
    const isSupabase = API_BASE_URL.includes('supabase.co');
    if (!isSupabase) {
        return { success: true, count: 0 };
    }

    try {
        const rawCodes = records.map(r => r.code).filter(c => c);
        if (rawCodes.length === 0) return { success: true, count: 0 };

        let allDbRecords: any[] = [];
        
        // Chunk the codes into groups of 500 to avoid overly large queries
        const CHUNK_SIZE = 500;
        for (let i = 0; i < rawCodes.length; i += CHUNK_SIZE) {
            const chunk = rawCodes.slice(i, i + CHUNK_SIZE);
            const { data, error } = await supabase
                .from('records')
                .select('*')
                .in('code', chunk);
                
            if (error) throw error;
            if (data) {
                allDbRecords = [...allDbRecords, ...data];
            }
        }

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
                // Ensure dbRecord is unpacked first so we can merge with incoming excel record
                const unpackedDbRecord = unpackRecord(dbRecord);
                const merged = { ...unpackedDbRecord };
                const mergedAny = merged as any;
                const excelRecordAny = excelRecord as any;
                let hasChange = false;

                Object.keys(excelRecord).forEach(key => {
                    const newVal = excelRecordAny[key];
                    const isValidValue = newVal !== null && newVal !== undefined && newVal !== '';
                    
                    if (isValidValue && key !== 'id') {
                        if (String(mergedAny[key]) !== String(newVal)) {
                            mergedAny[key] = newVal;
                            hasChange = true;
                        }
                    }
                });

                if (hasChange) {
                    const packedMerged = packRecord(merged);
                    updatesToPush.push(sanitizeData(packedMerged, RECORD_DB_COLUMNS));
                    updateCount++;
                }
            }
        });

        if (updatesToPush.length > 0) {
            const { error: upsertError, data } = await supabase.from('records').upsert(updatesToPush).select();
            if (upsertError) throw upsertError;
            
            if (data && IS_CACHED_RECORDS_LOADED) {
               data.forEach((r: any) => {
                   const unpacked = unpackRecord(r as RecordFile);
                   const idx = CACHED_RECORDS.findIndex(c => c.id === unpacked.id);
                   if (idx !== -1) CACHED_RECORDS[idx] = unpacked;
               });
            }
        }

        return { success: true, count: updateCount };

    } catch (error) {
        logError("forceUpdateRecordsBatchApi", error);
        return { success: false, count: 0 };
    }
};

/**
 * Tự động rà soát và đồng bộ hóa các hồ sơ cũ chưa có giá trị vật lý ở cột workCompletedDate.
 */
export const syncLegacyCompletedDatesApi = async (): Promise<{ success: boolean; count: number }> => {
    if (!isConfigured) return { success: true, count: 0 };
    try {
        const { data, error } = await supabase.from('records').select('*');
        if (error) throw error;
        if (!data || data.length === 0) return { success: true, count: 0 };

        const updatesToPush: any[] = [];
        let countObj = 0;

        for (const raw of data) {
            const r = unpackRecord(raw as RecordFile);
            
            // Điều kiện: Trạng thái nằm trong các bước đã thực hiện xong trở đi
            const isCompletedOrBeyond = [
                RecordStatus.COMPLETED_WORK,
                RecordStatus.PENDING_SIGN,
                RecordStatus.SIGNED,
                RecordStatus.HANDOVER,
                RecordStatus.RETURNED
            ].includes(r.status);

            const hasNoPhysicalWCD = !raw.workCompletedDate;

            if (isCompletedOrBeyond && hasNoPhysicalWCD) {
                let targetWCD: string | null = null;

                // 1. Lấy từ tag ẩn [WCD:...] trong privateNotes cũ (đã được unpackRecord tự động bọc tách)
                if (r.workCompletedDate) {
                    targetWCD = r.workCompletedDate;
                } else {
                    // 2. Fallback logic nếu hoàn toàn không có tag [WCD:...]
                    targetWCD = r.submissionDate || r.completedDate || r.resultReturnedDate || r.assignedDate || r.receivedDate || new Date().toISOString().split('T')[0];
                }

                if (targetWCD) {
                    r.workCompletedDate = targetWCD;
                    const packed = packRecord(r);
                    const cleanPayload = sanitizeData(packed, RECORD_DB_COLUMNS);
                    updatesToPush.push(cleanPayload);
                    countObj++;
                }
            }
        }

        if (updatesToPush.length > 0) {
            const { error: upsertError } = await supabase.from('records').upsert(updatesToPush);
            if (upsertError) throw upsertError;
            
            clearRecordsCache();
        }

        return { success: true, count: countObj };
    } catch (error) {
        logError("syncLegacyCompletedDatesApi", error);
        return { success: false, count: 0 };
    }
};

