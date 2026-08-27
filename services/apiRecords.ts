import { supabase, isConfigured } from './supabaseClient';
import { RecordFile, RecordStatus } from '../types';
import { MOCK_RECORDS, API_BASE_URL } from '../constants';
import { logError, getFromCache, saveToCache, CACHE_KEYS, sanitizeData, normalizeCode } from './apiCore';

const RECORD_DB_COLUMNS = [
    'id', 'code', 'customerName', 'phoneNumber', 'cccd', 'ward', 'landPlot', 'mapSheet', 
    'area', 'address', 'group', 'content', 'recordType', 'receivedDate', 'deadline', 
    'assignedDate', 'submissionDate', 'approvalDate', 'completedDate', 'status', 'assignedTo', 
    'notes', 'privateNotes', 'personalNotes', 
    'authorizedBy', 'authDocType', 'otherDocs', 'exportBatch', 'exportDate', 'receivingWard',
    'measurementNumber', 'excerptNumber',
    'reminderDate', 'lastRemindedAt',
    'receiptNumber', 'resultReturnedDate', 'receiverName',
    'needsMapCorrection', // Cột mới
    'plotCount',
    'createdBy', // Người tiếp nhận hồ sơ
    'workCompletedDate', // Cột vật lý lưu ngày Đã thực hiện
    'forwardPendingTo',
    'forwardFrom',
    'forwardDate',
    'forwardNotes',
    'forwardHistory',
    'isPriority',
    'priorityNote',
    'isCancelled',
    'cancelReason',
    'cancelledBy',
    'cancelledAt'
];

// Helper functions to serialize and deserialize workCompletedDate, extendedDeadline, receivingWard, isPriority, isCancelled inside privateNotes securely
export const packRecord = (record: RecordFile): RecordFile => {
    const copy = { ...record };
    let notes = copy.privateNotes || '';
    
    // Xoá các tag cũ để chèn lại chuẩn xác
    notes = notes.replace(/\[WCD:\d{4}-\d{2}-\d{2}\]/g, '').trim();
    notes = notes.replace(/\[EXT_DL:\d{4}-\d{2}-\d{2}\]/g, '').trim();
    notes = notes.replace(/\[REC_WARD:[^\]]+\]/g, '').trim();
    notes = notes.replace(/\[PRIO:(true|false)\]/g, '').trim();
    notes = notes.replace(/\[PRIO_NOTE:[^\]]*\]/g, '').trim();
    notes = notes.replace(/\[CANCEL:(true|false)\]/g, '').trim();
    notes = notes.replace(/\[CANCEL_REASON:[^\]]*\]/g, '').trim();
    notes = notes.replace(/\[CANCEL_BY:[^\]]*\]/g, '').trim();
    notes = notes.replace(/\[CANCEL_AT:[^\]]*\]/g, '').trim();
    
    if (copy.extendedDeadline) {
        notes = `${notes} [EXT_DL:${copy.extendedDeadline}]`.trim();
    }
    if (copy.receivingWard) {
        notes = `${notes} [REC_WARD:${copy.receivingWard}]`.trim();
    }
    if (copy.isPriority) {
        notes = `${notes} [PRIO:true]`.trim();
    } else {
        notes = `${notes} [PRIO:false]`.trim();
    }
    if (copy.priorityNote) {
        const safeNote = encodeURIComponent(copy.priorityNote);
        notes = `${notes} [PRIO_NOTE:${safeNote}]`.trim();
    }
    if (copy.isCancelled) {
        notes = `${notes} [CANCEL:true]`.trim();
        if (copy.cancelReason) {
            notes = `${notes} [CANCEL_REASON:${encodeURIComponent(copy.cancelReason)}]`.trim();
        }
        if (copy.cancelledBy) {
            notes = `${notes} [CANCEL_BY:${encodeURIComponent(copy.cancelledBy)}]`.trim();
        }
        if (copy.cancelledAt) {
            notes = `${notes} [CANCEL_AT:${copy.cancelledAt}]`.trim();
        }
    } else {
        notes = `${notes} [CANCEL:false]`.trim();
    }
    
    copy.privateNotes = notes === '' ? null : notes;
    return copy;
};

export const unpackRecord = (record: RecordFile): RecordFile => {
    const copy = { ...record };
    copy.extendedDeadline = null;
    copy.isPriority = !!record.isPriority;
    copy.priorityNote = record.priorityNote || null;
    copy.isCancelled = !!record.isCancelled;
    copy.cancelReason = record.cancelReason || null;
    copy.cancelledBy = record.cancelledBy || null;
    copy.cancelledAt = record.cancelledAt || null;
    
    if (copy.privateNotes) {
        // Parse PRIO
        const prioMatch = copy.privateNotes.match(/\[PRIO:(true|false)\]/);
        if (prioMatch) {
            copy.isPriority = prioMatch[1] === 'true';
        }

        // Parse PRIO_NOTE
        const noteMatch = copy.privateNotes.match(/\[PRIO_NOTE:([^\]]*)\]/);
        if (noteMatch) {
            try {
                copy.priorityNote = decodeURIComponent(noteMatch[1]);
            } catch (e) {
                copy.priorityNote = noteMatch[1];
            }
        }

        // Parse CANCEL
        const cancelMatch = copy.privateNotes.match(/\[CANCEL:(true|false)\]/);
        if (cancelMatch) {
            copy.isCancelled = cancelMatch[1] === 'true';
        }

        // Parse CANCEL_REASON
        const reasonMatch = copy.privateNotes.match(/\[CANCEL_REASON:([^\]]*)\]/);
        if (reasonMatch) {
            try {
                copy.cancelReason = decodeURIComponent(reasonMatch[1]);
            } catch (e) {
                copy.cancelReason = reasonMatch[1];
            }
        }

        // Parse CANCEL_BY
        const byMatch = copy.privateNotes.match(/\[CANCEL_BY:([^\]]*)\]/);
        if (byMatch) {
            try {
                copy.cancelledBy = decodeURIComponent(byMatch[1]);
            } catch (e) {
                copy.cancelledBy = byMatch[1];
            }
        }

        // Parse CANCEL_AT
        const atMatch = copy.privateNotes.match(/\[CANCEL_AT:([^\]]+)\]/);
        if (atMatch) {
            copy.cancelledAt = atMatch[1];
        }

        // Parse REC_WARD
        const recMatch = copy.privateNotes.match(/\[REC_WARD:([^\]]+)\]/);
        if (recMatch) {
            copy.receivingWard = recMatch[1];
        }

        // Parse EXT_DL
        const extMatch = copy.privateNotes.match(/\[EXT_DL:(\d{4}-\d{2}-\d{2})\]/);
        if (extMatch) {
            copy.extendedDeadline = extMatch[1];
        }
        
        // Parse WCD (nếu có để bảo toàn nghiệp vụ cũ)
        const match = copy.privateNotes.match(/\[WCD:(\d{4}-\d{2}-\d{2})\]/);
        if (match) {
            if (!copy.workCompletedDate) {
                copy.workCompletedDate = match[1];
            }
        }
        
        // Dọn dẹp hết các tag hiển thị
        const cleanedNotes = copy.privateNotes
            .replace(/\[WCD:\d{4}-\d{2}-\d{2}\]/g, '')
            .replace(/\[EXT_DL:\d{4}-\d{2}-\d{2}\]/g, '')
            .replace(/\[REC_WARD:[^\]]+\]/g, '')
            .replace(/\[PRIO:(true|false)\]/g, '')
            .replace(/\[PRIO_NOTE:[^\]]*\]/g, '')
            .replace(/\[CANCEL:(true|false)\]/g, '')
            .replace(/\[CANCEL_REASON:[^\]]*\]/g, '')
            .replace(/\[CANCEL_BY:[^\]]*\]/g, '')
            .replace(/\[CANCEL_AT:[^\]]*\]/g, '')
            .trim();
            
        copy.privateNotes = cleanedNotes === '' ? null : cleanedNotes;
    }
    return copy;
};

let CACHED_RECORDS: RecordFile[] = [];
let IS_CACHED_RECORDS_LOADED = false;
let IS_REALTIME_SUBSCRIBED = false;

// BroadcastChannel for instant cross-tab sync in same browser session
const syncChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('qlhs_realtime_sync')
    : null;

if (syncChannel) {
    syncChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'RECORDS_UPDATED') {
            window.dispatchEvent(new CustomEvent('records_realtime_update'));
        }
    };
}

export const broadcastCrossTab = (type: string, detail?: any) => {
    if (syncChannel) {
        try {
            syncChannel.postMessage({ type, detail });
        } catch (e) {
            // ignore
        }
    }
};

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
                broadcastCrossTab('RECORDS_UPDATED');
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

const extractMissingColumn = (error: any): string | null => {
    if (!error) return null;
    const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
    const match1 = msg.match(/Could not find the '([^']+)' column/i);
    if (match1) return match1[1];
    const match2 = msg.match(/column ["']?([a-zA-Z0-9_]+)["']? (?:of relation|does not exist)/i);
    if (match2) return match2[1];
    return null;
};

export const createRecordApi = async (record: RecordFile): Promise<RecordFile | null> => {
    if (!isConfigured) return { ...record, createdBy: record.createdBy || null };
    try {
        const packed = packRecord(record);
        let activeColumns = [...RECORD_DB_COLUMNS];
        let attempts = 0;
        let lastError: any = null;

        while (attempts < 10) {
            attempts++;
            const payload = sanitizeData(packed, activeColumns);
            const { data, error } = await supabase.from('records').insert([payload]).select();

            if (!error && data?.[0]) {
                const unpacked = unpackRecord(data[0] as RecordFile);
                if (IS_CACHED_RECORDS_LOADED) CACHED_RECORDS.unshift(unpacked);
                broadcastCrossTab('RECORDS_UPDATED');
                return unpacked;
            }

            if (error) {
                lastError = error;
                const errCode = (error as any).code;
                const errMsg = String((error as any).message || '');
                const errDetails = String((error as any).details || '');

                if (errCode === 'PGRST204' || errCode === '42703' || errMsg.includes('column') || errDetails.includes('column')) {
                    const missingCol = extractMissingColumn(error);
                    if (missingCol && activeColumns.includes(missingCol)) {
                        console.warn(`⚠️ [Database out of sync] Thử lại createRecordApi loại bỏ cột '${missingCol}'...`);
                        activeColumns = activeColumns.filter(c => c !== missingCol);
                        continue;
                    }

                    const suspectCols = [
                        'workCompletedDate', 'forwardPendingTo', 'forwardFrom', 'forwardDate', 
                        'forwardNotes', 'forwardHistory', 'createdBy', 'plotCount', 'needsMapCorrection',
                        'receiverName', 'personalNotes', 'reminderDate', 'lastRemindedAt', 'receiptNumber',
                        'resultReturnedDate', 'receivingWard', 'authorizedBy', 'authDocType', 'otherDocs'
                    ];
                    const found = suspectCols.find(c => activeColumns.includes(c) && (errMsg.includes(c) || errDetails.includes(c)));
                    if (found) {
                        console.warn(`⚠️ [Database out of sync] Loại bỏ cột nghi ngờ '${found}'...`);
                        activeColumns = activeColumns.filter(c => c !== found);
                        continue;
                    }

                    const remainingSuspects = suspectCols.filter(c => activeColumns.includes(c));
                    if (remainingSuspects.length > 0) {
                        const toRemove = remainingSuspects[remainingSuspects.length - 1];
                        console.warn(`⚠️ [Database out of sync] Fallback loại bỏ cột '${toRemove}'...`);
                        activeColumns = activeColumns.filter(c => c !== toRemove);
                        continue;
                    }
                }

                break;
            }
        }

        if (lastError) throw lastError;
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
        let activeColumns = [...RECORD_DB_COLUMNS];
        let attempts = 0;
        let lastError: any = null;

        while (attempts < 10) {
            attempts++;
            const payload = sanitizeData(packed, activeColumns);
            const { data, error } = await supabase.from('records').update(payload).eq('id', record.id).select();

            if (!error && data?.[0]) {
                const unpacked = unpackRecord(data[0] as RecordFile);
                if (IS_CACHED_RECORDS_LOADED) {
                    const idx = CACHED_RECORDS.findIndex(r => r.id === unpacked.id);
                    if (idx !== -1) CACHED_RECORDS[idx] = unpacked;
                    else CACHED_RECORDS.unshift(unpacked);
                }
                broadcastCrossTab('RECORDS_UPDATED');
                return unpacked;
            }

            if (error) {
                lastError = error;
                const errCode = (error as any).code;
                const errMsg = String((error as any).message || '');
                const errDetails = String((error as any).details || '');

                if (errCode === 'PGRST204' || errCode === '42703' || errMsg.includes('column') || errDetails.includes('column')) {
                    const missingCol = extractMissingColumn(error);
                    if (missingCol && activeColumns.includes(missingCol)) {
                        console.warn(`⚠️ [Database out of sync] Thử lại updateRecordApi loại bỏ cột '${missingCol}'...`);
                        activeColumns = activeColumns.filter(c => c !== missingCol);
                        continue;
                    }

                    const suspectCols = [
                        'workCompletedDate', 'forwardPendingTo', 'forwardFrom', 'forwardDate', 
                        'forwardNotes', 'forwardHistory', 'createdBy', 'plotCount', 'needsMapCorrection',
                        'receiverName', 'personalNotes', 'reminderDate', 'lastRemindedAt', 'receiptNumber',
                        'resultReturnedDate', 'receivingWard', 'authorizedBy', 'authDocType', 'otherDocs'
                    ];
                    const found = suspectCols.find(c => activeColumns.includes(c) && (errMsg.includes(c) || errDetails.includes(c)));
                    if (found) {
                        console.warn(`⚠️ [Database out of sync] Loại bỏ cột nghi ngờ '${found}'...`);
                        activeColumns = activeColumns.filter(c => c !== found);
                        continue;
                    }

                    const remainingSuspects = suspectCols.filter(c => activeColumns.includes(c));
                    if (remainingSuspects.length > 0) {
                        const toRemove = remainingSuspects[remainingSuspects.length - 1];
                        console.warn(`⚠️ [Database out of sync] Fallback loại bỏ cột '${toRemove}'...`);
                        activeColumns = activeColumns.filter(c => c !== toRemove);
                        continue;
                    }
                }

                break;
            }
        }

        if (lastError) throw lastError;
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
        
        broadcastCrossTab('RECORDS_UPDATED');
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
        broadcastCrossTab('RECORDS_UPDATED');
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

export const updateBulkRecordTypeApi = async (ids: string[], targetRecordType: string): Promise<boolean> => {
    if (!isConfigured) {
        if (IS_CACHED_RECORDS_LOADED) {
            CACHED_RECORDS = CACHED_RECORDS.map(r => {
                if (ids.includes(r.id)) {
                    return { ...r, recordType: targetRecordType };
                }
                return r;
            });
        }
        return true;
    }
    try {
        const { error, data } = await supabase
            .from('records')
            .update({ recordType: targetRecordType })
            .in('id', ids)
            .select();
        
        if (error) throw error;
        
        if (data && IS_CACHED_RECORDS_LOADED) {
            data.forEach((r: any) => {
                const unpacked = unpackRecord(r as RecordFile);
                const idx = CACHED_RECORDS.findIndex(c => c.id === unpacked.id);
                if (idx !== -1) CACHED_RECORDS[idx] = unpacked;
            });
        }
        return true;
    } catch (error) {
        logError("updateBulkRecordTypeApi", error);
        return false;
    }
};


