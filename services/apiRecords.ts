
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
    'receiptNumber', 'resultReturnedDate', 'receiverName',
    'needsMapCorrection' // Cột mới
];

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
                if (!CACHED_RECORDS.find(r => r.id === payload.new.id)) {
                    CACHED_RECORDS.unshift(payload.new as RecordFile);
                    changed = true;
                }
            } else if (payload.eventType === 'UPDATE') {
                const idx = CACHED_RECORDS.findIndex(r => r.id === payload.new.id);
                if (idx !== -1) {
                    CACHED_RECORDS[idx] = payload.new as RecordFile;
                    changed = true;
                } else {
                    CACHED_RECORDS.unshift(payload.new as RecordFile);
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
    
    CACHED_RECORDS = uniqueRecords as RecordFile[];
    IS_CACHED_RECORDS_LOADED = true;
    
    return CACHED_RECORDS;

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
        
        if (data?.[0]) {
            if (IS_CACHED_RECORDS_LOADED) CACHED_RECORDS.unshift(data[0] as RecordFile);
            return data[0] as RecordFile;
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
        const payload = sanitizeData(record, RECORD_DB_COLUMNS);
        const { data, error } = await supabase.from('records').update(payload).eq('id', record.id).select();
        if (error) throw error;
        
        if (data?.[0]) {
            if (IS_CACHED_RECORDS_LOADED) {
                const idx = CACHED_RECORDS.findIndex(r => r.id === data[0].id);
                if (idx !== -1) CACHED_RECORDS[idx] = data[0] as RecordFile;
            }
            return data[0] as RecordFile;
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
        const payload = records.map(r => sanitizeData(r, RECORD_DB_COLUMNS));
        const { error, data } = await supabase.from('records').insert(payload).select();
        if (error) throw error;
        
        if (data && IS_CACHED_RECORDS_LOADED) {
            CACHED_RECORDS = [...(data as RecordFile[]), ...CACHED_RECORDS];
        }
        return true;
    } catch (error) {
        logError("createRecordsBatchApi", error);
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
                const merged = { ...dbRecord };
                let hasChange = false;

                Object.keys(excelRecord).forEach(key => {
                    const newVal = (excelRecord as any)[key];
                    const isValidValue = newVal !== null && newVal !== undefined && newVal !== '';
                    
                    if (isValidValue && key !== 'id') {
                        if (String(merged[key]) !== String(newVal)) {
                            merged[key] = newVal;
                            hasChange = true;
                        }
                    }
                });

                if (hasChange) {
                    updatesToPush.push(sanitizeData(merged, RECORD_DB_COLUMNS));
                    updateCount++;
                }
            }
        });

        if (updatesToPush.length > 0) {
            const { error: upsertError, data } = await supabase.from('records').upsert(updatesToPush).select();
            if (upsertError) throw upsertError;
            
            if (data && IS_CACHED_RECORDS_LOADED) {
               data.forEach((r: any) => {
                   const idx = CACHED_RECORDS.findIndex(c => c.id === r.id);
                   if (idx !== -1) CACHED_RECORDS[idx] = r as RecordFile;
               });
            }
        }

        return { success: true, count: updateCount };

    } catch (error) {
        logError("forceUpdateRecordsBatchApi", error);
        return { success: false, count: 0 };
    }
};
