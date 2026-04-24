
import { supabase, isConfigured } from './supabaseClient';
import { logError, getFromCache, saveToCache } from './apiCore';

// --- TYPES ---
export interface ArchiveRecord {
    id: string;
    created_at: string;
    created_by: string;
    type: 'saoluc' | 'vaoso' | 'congvan' | 'dangky';
    status: 'draft' | 'assigned' | 'executed' | 'pending_sign' | 'signed' | 'completed' | 'returned' | 'tiep_nhan' | 'xu_ly' | 'tham_tra_thue' | 'chuyen_thue' | 'dong_thue' | 'ky_gcn' | 'hoan_thanh'; // Nháp | Đã giao | Đã thực hiện | Trình ký | Đã ký | Đã giao 1 cửa | Đã trả kết quả | Tiếp nhận | Xử lý | Thẩm tra thuế | Chuyển thuế | Đóng thuế | Ký GCN | Hoàn thành
    so_hieu: string; // Số hiệu/Số hồ sơ
    trich_yeu: string; // Nội dung/Trích yếu
    ngay_thang: string;
    noi_nhan_gui: string;
    data: any; // Các trường mở rộng khác
}

// Mock Data Stores
let MOCK_ARCHIVE: ArchiveRecord[] = [];

// In-Memory Cache for fetched records to solve high egress without breaking UI
let CACHED_ARCHIVE_RECORDS: Record<string, ArchiveRecord[]> = {
    saoluc: [], vaoso: [], congvan: [], dangky: []
};
let IS_CACHED_LOADED: Record<string, boolean> = {
    saoluc: false, vaoso: false, congvan: false, dangky: false
};
let IS_REALTIME_ARCHIVE_SUBSCRIBED = false;

const CACHE_KEY_ARCHIVE = 'offline_archive_records';

// Function to clear cache (e.g. for refresh button)
export const clearArchiveCache = (type?: 'saoluc' | 'vaoso' | 'congvan' | 'dangky') => {
    if (type) {
        IS_CACHED_LOADED[type] = false;
        CACHED_ARCHIVE_RECORDS[type] = [];
    } else {
        IS_CACHED_LOADED = { saoluc: false, vaoso: false, congvan: false, dangky: false };
        CACHED_ARCHIVE_RECORDS = { saoluc: [], vaoso: [], congvan: [], dangky: [] };
    }
};

export const initRealtimeArchive = () => {
    if (!isConfigured || IS_REALTIME_ARCHIVE_SUBSCRIBED) return;
    IS_REALTIME_ARCHIVE_SUBSCRIBED = true;

    supabase.channel('public:archive_records')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'archive_records' }, (payload) => {
            let changed = false;
            let typeChanged: string | null = null;

            if (payload.eventType === 'INSERT') {
                const newRec = payload.new as ArchiveRecord;
                typeChanged = newRec.type;
                if (IS_CACHED_LOADED[newRec.type]) {
                    const arr = CACHED_ARCHIVE_RECORDS[newRec.type];
                    if (!arr.find(r => r.id === newRec.id)) {
                        arr.unshift(newRec);
                        changed = true;
                    }
                }
            } else if (payload.eventType === 'UPDATE') {
                const newRec = payload.new as ArchiveRecord;
                typeChanged = newRec.type;
                if (IS_CACHED_LOADED[newRec.type]) {
                    const arr = CACHED_ARCHIVE_RECORDS[newRec.type];
                    const idx = arr.findIndex(r => r.id === newRec.id);
                    if (idx !== -1) {
                        arr[idx] = newRec;
                        changed = true;
                    } else {
                        arr.unshift(newRec);
                        changed = true;
                    }
                }
            } else if (payload.eventType === 'DELETE') {
                const oldRec = payload.old;
                // Finding which type it belongs to
                Object.keys(CACHED_ARCHIVE_RECORDS).forEach(type => {
                    const arr = CACHED_ARCHIVE_RECORDS[type];
                    const beforeLen = arr.length;
                    CACHED_ARCHIVE_RECORDS[type] = arr.filter(r => r.id !== oldRec.id);
                    if (CACHED_ARCHIVE_RECORDS[type].length < beforeLen) {
                        changed = true;
                        typeChanged = type;
                    }
                });
            }

            if (changed && typeChanged) {
                // Dispatch custom event to notify React components
                window.dispatchEvent(new CustomEvent('archive_realtime_update', { detail: { type: typeChanged } }));
            }
        })
        .subscribe();
};

// --- API ---

export const fetchArchiveRecords = async (type: 'saoluc' | 'vaoso' | 'congvan' | 'dangky', forceUpdate: boolean = false): Promise<ArchiveRecord[]> => {
    if (!isConfigured) {
        const cached = getFromCache<ArchiveRecord[]>(CACHE_KEY_ARCHIVE, []);
        if (MOCK_ARCHIVE.length === 0 && cached.length > 0) MOCK_ARCHIVE = cached;
        return MOCK_ARCHIVE.filter(r => r.type === type);
    }
    
    // Return from memory cache to save egress!
    if (!forceUpdate && IS_CACHED_LOADED[type]) {
        return [...CACHED_ARCHIVE_RECORDS[type]];
    }

    try {
        let allData: ArchiveRecord[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from('archive_records')
                .select('*')
                .eq('type', type)
                .order('created_at', { ascending: false })
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) throw error;
            
            if (data && data.length > 0) {
                allData = [...allData, ...data as ArchiveRecord[]];
                if (data.length < pageSize) hasMore = false;
                else page++;
            } else {
                hasMore = false;
            }
        }
        
        CACHED_ARCHIVE_RECORDS[type] = allData;
        IS_CACHED_LOADED[type] = true;
        
        return [...allData];
    } catch (error) {
        logError(`fetchArchiveRecords-${type}`, error);
        return MOCK_ARCHIVE.filter(r => r.type === type);
    }
};

export const saveArchiveRecord = async (record: Partial<ArchiveRecord>): Promise<ArchiveRecord | null> => {
    if (!isConfigured) {
        if (record.id) {
            const idx = MOCK_ARCHIVE.findIndex(r => r.id === record.id);
            if (idx !== -1) {
                MOCK_ARCHIVE[idx] = { ...MOCK_ARCHIVE[idx], ...record } as ArchiveRecord;
                saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);
                return MOCK_ARCHIVE[idx];
            }
        } else {
            const newRec = { 
                ...record, 
                id: Math.random().toString(36).substr(2, 9), 
                created_at: new Date().toISOString() 
            } as ArchiveRecord;
            MOCK_ARCHIVE.unshift(newRec);
            saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);
            return newRec;
        }
        return null;
    }
    try {
        // Chuẩn hóa dữ liệu
        const payload: any = { ...record };
        
        // Xử lý ngày tháng: Nếu rỗng thì set null để tránh lỗi định dạng DATE của PostgreSQL
        if (payload.ngay_thang === '') payload.ngay_thang = null;

        if (record.id) {
            const { data, error } = await supabase.from('archive_records').update({ 
                type: payload.type,
                status: payload.status,
                so_hieu: payload.so_hieu,
                trich_yeu: payload.trich_yeu,
                ngay_thang: payload.ngay_thang,
                noi_nhan_gui: payload.noi_nhan_gui,
                data: payload.data
            }).eq('id', record.id).select().single();
            
            if (error) throw error;
            
            // Mutate cache
            if (IS_CACHED_LOADED[data.type]) {
                const arr = CACHED_ARCHIVE_RECORDS[data.type];
                const index = arr.findIndex(r => r.id === data.id);
                if (index !== -1) arr[index] = data as ArchiveRecord;
            }
            
            return data as ArchiveRecord;
        } else {
            // Khi Insert: KHÔNG tự sinh ID bằng Math.random() vì DB dùng UUID.
            // Để Supabase/Postgres tự sinh ID.
            delete payload.id; 
            
            const { data, error } = await supabase.from('archive_records').insert([payload]).select().single();
            if (error) throw error;
            
            // Mutate cache
            if (IS_CACHED_LOADED[data.type]) {
                CACHED_ARCHIVE_RECORDS[data.type].unshift(data as ArchiveRecord);
            }
            
            return data as ArchiveRecord;
        }
    } catch (error: any) {
        // Xử lý thông báo lỗi cụ thể cho 22P02 (Sai kiểu dữ liệu, ví dụ text vào trường UUID hoặc Date sai format)
        if (error.code === '22P02') {
            console.error("Lỗi định dạng dữ liệu (22P02):", error.message);
            logError("saveArchiveRecord", "Sai định dạng dữ liệu (Lỗi 22P02). Kiểm tra các trường Số hoặc Ngày tháng.");
        } else {
            logError("saveArchiveRecord", error);
        }
        return null;
    }
};

export const deleteArchiveRecord = async (id: string): Promise<boolean> => {
    if (!isConfigured) {
        const idx = MOCK_ARCHIVE.findIndex(r => r.id === id);
        if (idx !== -1) MOCK_ARCHIVE.splice(idx, 1);
        saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);
        return true;
    }
    try {
        const { data, error } = await supabase.from('archive_records').delete().eq('id', id).select().single();
        if (error) {
            // It might fail to select if it was already deleted, just fallback to return true unless it's a real error
            // Fallback: we should just update cache based on id removal across all types
            Object.keys(CACHED_ARCHIVE_RECORDS).forEach(t => {
                CACHED_ARCHIVE_RECORDS[t] = CACHED_ARCHIVE_RECORDS[t].filter(r => r.id !== id);
            });
        } else if (data) {
            const arr = CACHED_ARCHIVE_RECORDS[data.type as string];
            if (arr) CACHED_ARCHIVE_RECORDS[data.type as string] = arr.filter(r => r.id !== id);
        }
        return true;
    } catch (error) {
        logError("deleteArchiveRecord", error);
        return false;
    }
};

export const deleteAllArchiveRecordsByType = async (type: string): Promise<boolean> => {
    if (!isConfigured) {
        const newArchive = MOCK_ARCHIVE.filter(r => r.type !== type);
        MOCK_ARCHIVE.length = 0;
        MOCK_ARCHIVE.push(...newArchive);
        saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);
        return true;
    }
    try {
        const { error } = await supabase.from('archive_records').delete().eq('type', type);
        if (error) throw error;
        
        CACHED_ARCHIVE_RECORDS[type] = [];
        
        return true;
    } catch (error) {
        logError("deleteAllArchiveRecordsByType", error);
        return false;
    }
};

export const importArchiveRecords = async (records: Partial<ArchiveRecord>[]): Promise<boolean> => {
    if (!isConfigured) {
        records.forEach(r => {
            const newRec = { 
                ...r, 
                id: Math.random().toString(36).substr(2, 9), 
                created_at: new Date().toISOString() 
            } as ArchiveRecord;
            MOCK_ARCHIVE.unshift(newRec);
        });
        saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);
        return true;
    }
    try {
        // Chuẩn hóa dữ liệu trước khi insert
        const payload = records.map(r => {
            const p: any = { ...r };
            delete p.id; // Để DB tự sinh UUID
            if (p.ngay_thang === '' || !p.ngay_thang) {
                p.ngay_thang = null;
            } else {
                // Ensure it's a valid YYYY-MM-DD format, otherwise set to null
                if (!/^\d{4}-\d{2}-\d{2}$/.test(p.ngay_thang)) {
                    p.ngay_thang = null;
                }
            }
            return p;
        });

        const { data, error } = await supabase.from('archive_records').insert(payload).select();
        if (error) throw error;
        
        if (data) {
            data.forEach((r: any) => {
                const arr = CACHED_ARCHIVE_RECORDS[r.type];
                if (arr) arr.unshift(r as ArchiveRecord);
            });
        }
        
        return true;
    } catch (error) {
        logError("importArchiveRecords", error);
        return false;
    }
};

export const updateArchiveRecordsBatch = async (ids: string[], updates: Partial<ArchiveRecord>): Promise<boolean> => {
    if (!isConfigured) {
        MOCK_ARCHIVE = MOCK_ARCHIVE.map(r => {
            if (ids.includes(r.id)) {
                // Merge data field if exists
                const newData = updates.data ? { ...r.data, ...updates.data } : r.data;
                return { ...r, ...updates, data: newData } as ArchiveRecord;
            }
            return r;
        });
        saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);
        return true;
    }
    try {
        // Lưu ý: data field trong supabase update sẽ replace toàn bộ jsonb nếu không dùng jsonb_set.
        // Tuy nhiên, ở đây ta giả định updates.data chứa các trường cần merge, nhưng Supabase JS client update jsonb là replace.
        // Để merge, ta cần logic phức tạp hơn hoặc fetch về rồi update.
        // Nhưng với yêu cầu "Chuyển Scan", ta chỉ update thêm trường vào data.
        // Cách đơn giản: Dùng RPC hoặc chấp nhận fetch-update nếu số lượng ít.
        // Hoặc: update từng dòng (chậm nhưng an toàn cho JSON merge).
        
        // Cách tối ưu hơn cho Supabase: Update các trường thường, còn JSON thì...
        // Tạm thời loop update để đảm bảo merge JSON đúng (an toàn nhất mà không cần store procedure)
        
        const { data: currentRecords, error: fetchError } = await supabase
            .from('archive_records')
            .select('id, data')
            .in('id', ids);
            
        if (fetchError) throw fetchError;

        const promises = currentRecords.map(r => {
            let mergedData = { ...r.data, ...(updates.data || {}) };

            // Special handling for history: append instead of replace if updates.data.history exists
            if (updates.data && updates.data.history && Array.isArray(updates.data.history)) {
                const oldHistory = Array.isArray(r.data?.history) ? r.data.history : [];
                // Assuming updates.data.history contains NEW items to append
                mergedData.history = [...oldHistory, ...updates.data.history];
            }

            const payload = { ...updates, data: mergedData };
            return supabase.from('archive_records').update(payload).eq('id', r.id).select().single();
        });

        const results = await Promise.all(promises);
        
        results.forEach(res => {
            if (res.data) {
                const type = res.data.type;
                if (IS_CACHED_LOADED[type]) {
                    const arr = CACHED_ARCHIVE_RECORDS[type];
                    const idx = arr.findIndex(x => x.id === res.data.id);
                    if (idx !== -1) arr[idx] = res.data as ArchiveRecord;
                }
            }
        });
        
        return true;
    } catch (error) {
        logError("updateArchiveRecordsBatch", error);
        return false;
    }
};

export const fetchListsByDate = async (type: 'saoluc' | 'congvan', date: string): Promise<string[]> => {
    if (!isConfigured) {
        const lists = new Set<string>();
        MOCK_ARCHIVE.forEach(r => {
            if (r.type === type && r.data?.ngay_hoan_thanh === date && r.data?.danh_sach) {
                lists.add(r.data.danh_sach);
            }
        });
        return Array.from(lists).sort();
    }

    try {
        const { data, error } = await supabase
            .from('archive_records')
            .select('data')
            .eq('type', type)
            .contains('data', { ngay_hoan_thanh: date });

        if (error) throw error;

        const lists = new Set<string>();
        data?.forEach((r: any) => {
            if (r.data?.danh_sach) {
                lists.add(r.data.danh_sach);
            }
        });
        
        return Array.from(lists).sort();
    } catch (error) {
        logError(`fetchListsByDate-${type}`, error);
        return [];
    }
};
