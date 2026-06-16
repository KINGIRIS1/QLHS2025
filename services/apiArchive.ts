
import { supabase, isConfigured } from './supabaseClient';
import { logError, getFromCache, saveToCache } from './apiCore';

// --- TYPES ---
export interface ArchiveRecord {
    id: string;
    created_at: string;
    created_by: string;
    type: 'saoluc' | 'vaoso' | 'congvan' | 'dangky' | 'kho';
    status: 'draft' | 'assigned' | 'executed' | 'pending_sign' | 'signed' | 'completed' | 'returned' | 'tiep_nhan' | 'xu_ly' | 'tham_tra_thue' | 'chuyen_thue' | 'dong_thue' | 'ky_gcn' | 'hoan_thanh'; // Nháp | Đã giao | Đã thực hiện | Trình ký | Đã ký | Đã giao 1 cửa | Đã trả kết quả | Tiếp nhận | Xử lý | Thẩm tra thuế | Chuyển thuế | Đóng thuế | Ký GCN | Hoàn thành
    so_hieu: string; // Số hiệu/Số hồ sơ
    trich_yeu: string; // Nội dung/Trích yếu
    ngay_thang: string;
    noi_nhan_gui: string;
    attached_files?: any[];
    data: any; // Các trường mở rộng khác
}

// Mock Data Stores
let MOCK_ARCHIVE: ArchiveRecord[] = [];

// In-Memory Cache for fetched records to solve high egress without breaking UI
let CACHED_ARCHIVE_RECORDS: Record<string, ArchiveRecord[]> = {
    saoluc: [], vaoso: [], congvan: [], dangky: [], kho: []
};
let IS_CACHED_LOADED: Record<string, boolean> = {
    saoluc: false, vaoso: false, congvan: false, dangky: false, kho: false
};
let IS_REALTIME_ARCHIVE_SUBSCRIBED = false;

const CACHE_KEY_ARCHIVE = 'offline_archive_records';

// Function to clear cache (e.g. for refresh button)
export const clearArchiveCache = (type?: 'saoluc' | 'vaoso' | 'congvan' | 'dangky' | 'kho') => {
    if (type) {
        IS_CACHED_LOADED[type] = false;
        CACHED_ARCHIVE_RECORDS[type] = [];
    } else {
        IS_CACHED_LOADED = { saoluc: false, vaoso: false, congvan: false, dangky: false, kho: false };
        CACHED_ARCHIVE_RECORDS = { saoluc: [], vaoso: [], congvan: [], dangky: [], kho: [] };
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

export const fetchArchiveRecords = async (type: 'saoluc' | 'vaoso' | 'congvan' | 'dangky' | 'kho', forceUpdate: boolean = false, allowedWards?: string[]): Promise<ArchiveRecord[]> => {
    if (!isConfigured) {
        const cached = getFromCache<ArchiveRecord[]>(CACHE_KEY_ARCHIVE, []);
        if (MOCK_ARCHIVE.length === 0 && cached.length > 0) MOCK_ARCHIVE = cached;
        let list = MOCK_ARCHIVE.filter(r => r.type === type);
        // Tạm lọc offline
        if (allowedWards && allowedWards.length > 0) {
            list = list.filter(r => allowedWards.some(w => r.data?.dia_danh?.includes(w)));
        }
        return list;
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

        let baseQuery = supabase.from('archive_records').select('*').eq('type', type);
        
        // CHỐNG RÒ RỈ DỮ LIỆU: Filter phía Server!
        if (allowedWards && allowedWards.length > 0) {
            const orConditions = allowedWards.map(w => `data->>dia_danh.ilike.%${w}%`).join(',');
            baseQuery = baseQuery.or(orConditions);
        }

        while (hasMore) {
            const { data, error } = await baseQuery
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
        
        // KIỂM TRA TRÙNG LẶP SỐ HIỆU (Chống Lỗ hổng 4)
        if (payload.so_hieu && payload.so_hieu.trim() !== '') {
            // Kiểm tra trên archive_records
            let query = supabase.from('archive_records')
                .select('id')
                .eq('type', payload.type)
                .eq('so_hieu', payload.so_hieu.trim());
            
            if (record.id) {
                query = query.neq('id', record.id);
            }
            
            const { data: existing, error: errCheck } = await query.limit(1);
            if (errCheck) throw errCheck;
            
            if (existing && existing.length > 0) {
                throw new Error("Mã hồ sơ / Số hiệu đã tồn tại trong hệ thống!");
            }

            // Đồng thời kiểm tra trên warehouse_records nếu type là kho
            if (payload.type === 'kho') {
                try {
                    let wQuery = supabase.from('warehouse_records')
                        .select('id')
                        .eq('so_hieu', payload.so_hieu.trim());
                    if (record.id) {
                        wQuery = wQuery.neq('id', record.id);
                    }
                    const { data: wExisting } = await wQuery.limit(1);
                    if (wExisting && wExisting.length > 0) {
                        throw new Error("Mã hồ sơ / Số hiệu đã tồn tại trong hệ thống kho!");
                    }
                } catch (e) {
                    // Bỏ qua nếu bảng warehouse_records chưa tồn tại
                }
            }
        }

        if (record.id) {
            const { data, error } = await supabase.from('archive_records').update({ 
                type: payload.type,
                status: payload.status,
                so_hieu: payload.so_hieu,
                trich_yeu: payload.trich_yeu,
                ngay_thang: parseAndFormatDateSafe(payload.ngay_thang),
                noi_nhan_gui: payload.noi_nhan_gui,
                attached_files: payload.attached_files,
                data: payload.data
            }).eq('id', record.id).select().single();
            
            if (error) throw error;
            
            // Đồng bộ sang bảng warehouse_records chuyên dụng
            if (payload.type === 'kho') {
                try {
                    const wPayload = mapToWarehousePayload(data);
                    const { error: wErr } = await supabase.from('warehouse_records').upsert(wPayload);
                    if (wErr) {
                        console.error("❌ Lỗi đồng bộ sang warehouse_records (update):", wErr);
                    }
                } catch (wErr) {
                    // Bỏ qua nếu table chưa được tạo
                }
            }

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
            
            const insertPayload = {
                type: payload.type,
                status: payload.status,
                so_hieu: payload.so_hieu,
                trich_yeu: payload.trich_yeu,
                ngay_thang: parseAndFormatDateSafe(payload.ngay_thang),
                noi_nhan_gui: payload.noi_nhan_gui,
                attached_files: payload.attached_files,
                data: payload.data,
                created_by: payload.created_by
            };
            
            const { data, error } = await supabase.from('archive_records').insert([insertPayload]).select().single();
            if (error) throw error;
            
            // Đồng bộ sang bảng warehouse_records chuyên dụng
            if (payload.type === 'kho') {
                try {
                    const wPayload = mapToWarehousePayload(data);
                    const { error: wErr } = await supabase.from('warehouse_records').insert(wPayload);
                    if (wErr) {
                        console.error("❌ Lỗi đồng bộ sang warehouse_records (insert):", wErr);
                    }
                } catch (wErr) {
                    // Bỏ qua nếu table chưa được tạo
                }
            }

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
        // Đồng thời xóa bên warehouse_records (nếu có bảng)
        try {
            await supabase.from('warehouse_records').delete().eq('id', id);
        } catch (we) {
            // Bỏ qua lỗi bảng chưa tồn tại
        }

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
        if (type === 'kho') {
            try {
                await supabase.from('warehouse_records').delete().neq('id', 'dummy_id_prevent_error');
            } catch (we) {
                // Bỏ qua lỗi bảng chưa tồn tại
            }
        }

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
        // Tách biệt bản ghi 'kho' và bản ghi khác để lưu đúng bảng tối ưu hóa
        const warehouseRecords = records.filter(r => r.type === 'kho');
        const normalRecords = records.filter(r => r.type !== 'kho');

        if (warehouseRecords.length > 0) {
            const wPayloads = warehouseRecords.map(r => {
                const mapped = mapToWarehousePayload(r);
                delete mapped.id; // Để DB tự sinh UUID
                return mapped;
            });

            // Ghi trực tiếp hàng loạt vào bảng warehouse_records chuyên dụng
            const { error: wErr } = await supabase.from('warehouse_records').insert(wPayloads);
            if (wErr) throw wErr;
        }

        if (normalRecords.length > 0) {
            // Chuẩn hóa dữ liệu trước khi insert vào archive_records gốc
            const payload = normalRecords.map(r => {
                const p: any = { ...r };
                delete p.id; // Để DB tự sinh UUID
                if (p.ngay_thang === '' || !p.ngay_thang) {
                    p.ngay_thang = null;
                } else {
                    // Đảm bảo định dạng YYYY-MM-DD
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
            .select('*')
            .in('id', ids);
            
        if (fetchError) throw fetchError;

        const upsertPayloads = currentRecords.map(r => {
            let mergedData = { ...r.data, ...(updates.data || {}) };

            // Special handling for history: append instead of replace if updates.data.history exists
            if (updates.data && updates.data.history && Array.isArray(updates.data.history)) {
                const oldHistory = Array.isArray(r.data?.history) ? r.data.history : [];
                // Assuming updates.data.history contains NEW items to append
                mergedData.history = [...oldHistory, ...updates.data.history];
            }

            return { ...r, ...updates, data: mergedData };
        });

        // Use bulk upsert to save all in 1 request
        const { data: results, error: upsertError } = await supabase
            .from('archive_records')
            .upsert(upsertPayloads)
            .select();
            
        if (upsertError) throw upsertError;

        if (results) {
            results.forEach(res => {
                const type = res.type;
                if (IS_CACHED_LOADED[type]) {
                    const arr = CACHED_ARCHIVE_RECORDS[type];
                    const idx = arr.findIndex(x => x.id === res.id);
                    if (idx !== -1) arr[idx] = res as ArchiveRecord;
                }
            });
        }
        
        return true;
    } catch (error) {
        logError("updateArchiveRecordsBatch", error);
        return false;
    }
};

export const rawUpsertArchiveRecords = async (records: any[]): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        const { data, error } = await supabase.from('archive_records').upsert(records).select();
        if (error) throw error;
        // Mutate cache manually if needed or let real-time handle it
        if (data) {
            data.forEach(res => {
                const type = res.type;
                if (IS_CACHED_LOADED[type]) {
                    const arr = CACHED_ARCHIVE_RECORDS[type];
                    const idx = arr.findIndex((x:any) => x.id === res.id);
                    if (idx !== -1) arr[idx] = res as ArchiveRecord;
                }
            });
        }
        return true;
    } catch (e) {
        logError("rawUpsertArchiveRecords", e);
        return false;
    }
}

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

export const findArchiveRecordBySoHieu = async (type: 'saoluc' | 'vaoso' | 'congvan' | 'dangky' | 'kho', soHieu: string): Promise<ArchiveRecord | null> => {
    if (!isConfigured) {
        return MOCK_ARCHIVE.find(r => r.type === type && r.so_hieu === soHieu) || null;
    }
    try {
        const { data, error } = await supabase
            .from('archive_records')
            .select('*')
            .eq('type', type)
            .eq('so_hieu', soHieu)
            .limit(1);
        
        if (error) throw error;
        if (data && data.length > 0) return data[0] as ArchiveRecord;
        return null;
    } catch (e) {
        logError("findArchiveRecordBySoHieu", e);
        return null;
    }
};

export const fetchArchiveRecordById = async (id: string): Promise<ArchiveRecord | null> => {
    if (!isConfigured) {
        return MOCK_ARCHIVE.find(r => r.id === id) || null;
    }
    try {
        // Thử tìm ở table warehouse_records trước
        const { data: wData, error: wError } = await supabase
            .from('warehouse_records')
            .select('*')
            .eq('id', id)
            .limit(1);
        if (!wError && wData && wData.length > 0) {
            return mapFromWarehouseRecord(wData[0]);
        }

        const { data, error } = await supabase
            .from('archive_records')
            .select('*')
            .eq('id', id)
            .limit(1);
        
        if (error) throw error;
        if (data && data.length > 0) return data[0] as ArchiveRecord;
        return null;
    } catch (e) {
        logError("fetchArchiveRecordById", e);
        return null;
    }
};

// --- HỖ TRỢ PHÂN TRANG KHO DỮ LIỆU ĐỒ SỘ (300K DÒNG) ---

export interface WarehouseFilters {
    searchTerm?: string;
    advMaBienNhan?: string;
    advLoaiHoSo?: string;
    advChuSuDung?: string;
    advCccd?: string;
    advToThua?: string;
    advKeTang?: string;
    advHopSo?: string;
    advSoPhatHanh?: string;
    advNguoiNhap?: string;
}

export interface PaginatedWarehouseResponse {
    records: ArchiveRecord[];
    totalCount: number;
}

// Hàm chuẩn hóa & định dạng ngày tháng cực kỳ an toàn, chống mọi lỗi 22007, 22P07, 22008 của PostgreSQL
export const parseAndFormatDateSafe = (val: any): string | null => {
    if (val === undefined || val === null || val === '') return null;
    
    // Nếu là số SERIAL từ Excel (ví dụ: 45132)
    if (typeof val === 'number') {
        try {
            const parsedDate = new Date((val - 25569) * 86400 * 1000);
            if (!isNaN(parsedDate.getTime())) {
                return parsedDate.toISOString().split('T')[0];
            }
        } catch {
            return null;
        }
    }
    
    const str = String(val).trim();
    if (!str || str === '-' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') return null;

    // Định dạng dd/mm/yyyy phổ biến ở Việt Nam
    const dmyRegex = /^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/;
    const dmyMatch = str.match(dmyRegex);
    if (dmyMatch) {
        const day = parseInt(dmyMatch[1], 10);
        const month = parseInt(dmyMatch[2], 10);
        const year = parseInt(dmyMatch[3], 10);
        
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            // Kiểm tra tính hợp lệ bằng Constructor Date (Ví dụ tránh 30/02)
            const dateObj = new Date(year, month - 1, day);
            if (dateObj.getFullYear() === year && dateObj.getMonth() === month - 1 && dateObj.getDate() === day) {
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }
        return null;
    }

    // Định dạng yyyy-mm-dd
    const ymdRegex = /^(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})$/;
    const ymdMatch = str.match(ymdRegex);
    if (ymdMatch) {
         const year = parseInt(ymdMatch[1], 10);
         const month = parseInt(ymdMatch[2], 10);
         const day = parseInt(ymdMatch[3], 10);
         if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
             const dateObj = new Date(year, month - 1, day);
             if (dateObj.getFullYear() === year && dateObj.getMonth() === month - 1 && dateObj.getDate() === day) {
                 return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
             }
         }
         return null;
    }

    // Parse chung qua Javascript Date
    try {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            const yr = d.getFullYear();
            if (yr > 1900 && yr < 2100) {
                return d.toISOString().split('T')[0];
            }
        }
    } catch {
        // bỏ qua
    }
    
    return null;
};

// Convert payload cho table warehouse_records riêng
export const mapToWarehousePayload = (record: Partial<ArchiveRecord>): any => {
    const d = { ...(record.data || {}) };
    
    // Đảm bảo dữ liệu thời gian luôn sạch sẽ kể cả bên trong data JSONB và bên ngoài cột vật lý
    const parsedNgayNhap = parseAndFormatDateSafe(d.ngaynhap);
    const parsedNgayCapGCN = parseAndFormatDateSafe(d.ngaycapgcnmoi);
    const parsedNgayThang = parseAndFormatDateSafe(record.ngay_thang) || parsedNgayNhap;
    
    if (d.ngaynhap !== undefined && d.ngaynhap !== null) d.ngaynhap = parsedNgayNhap;
    if (d.ngaycapgcnmoi !== undefined && d.ngaycapgcnmoi !== null) d.ngaycapgcnmoi = parsedNgayCapGCN;

    return {
        id: record.id,
        created_by: record.created_by,
        type: 'kho',
        status: record.status || 'completed',
        so_hieu: record.so_hieu,
        trich_yeu: record.trich_yeu,
        ngay_thang: parsedNgayThang,
        noi_nhan_gui: record.noi_nhan_gui || d.hoten1 || '',
        attached_files: record.attached_files || [],
        
        // Cột cấu trúc tối ưu index hóa
        loaihoso: d.loaihoso || null,
        hoten1: d.hoten1 || null,
        namsinh1: d.namsinh1 ? parseInt(d.namsinh1.toString()) : null,
        loaicccd1: d.loaicccd1 || null,
        socccd: d.socccd || null,
        diachitt1: d.diachitt1 || null,
        hoten2: d.hoten2 || null,
        namsinh2: d.namsinh2 ? parseInt(d.namsinh2.toString()) : null,
        loaicccd2: d.loaicccd2 || null,
        socccd2: d.socccd2 || null,
        diachitt2: d.diachitt2 || null,
        matd: d.matd || record.so_hieu || null,
        tobando: d.tobando || null,
        sothua: d.sothua || null,
        dientich: d.dientich ? parseFloat(d.dientich.toString()) : null,
        hinhthucsd: d.hinhthucsd || null,
        loaidato: d.loaidato || null,
        dientichdato: d.dientichdato ? parseFloat(d.dientichdato.toString()) : null,
        mavach: d.mavach || null,
        maxa: d.maxa || null,
        manam: d.manam || null,
        sophathanhgcnmoi: d.sophathanhgcnmoi || null,
        sovaosomoi: d.sovaosomoi || null,
        ngaycapgcnmoi: parsedNgayCapGCN,
        diachiap: d.diachiap || null,
        soke_tang: d.soke_tang || null,
        so_o: d.so_o || null,
        so_tep: d.so_tep || d.So_tep || null,
        sott_tep: d.sott_tep || null,
        nguoinhap: d.nguoinhap || null,
        ngaynhap: parsedNgayNhap,
        ghichu: d.ghichu || null,
        
        // Dư phòng toàn bộ JSON nâng cao
        data: d
    };
};

// Khôi phục từ table warehouse_records sang kiểu ArchiveRecord tương thích tuyệt đối hệ thống
export const mapFromWarehouseRecord = (w: any): ArchiveRecord => {
    if (!w) return {} as ArchiveRecord;
    return {
        id: w.id,
        created_at: w.created_at,
        created_by: w.created_by,
        type: 'kho',
        status: w.status,
        so_hieu: w.so_hieu,
        trich_yeu: w.trich_yeu,
        ngay_thang: w.ngay_thang,
        noi_nhan_gui: w.noi_nhan_gui,
        attached_files: w.attached_files,
        data: {
            sott: w.sott,
            loaihoso: w.loaihoso,
            hoten1: w.hoten1,
            namsinh1: w.namsinh1,
            loaicccd1: w.loaicccd1,
            socccd: w.socccd,
            diachitt1: w.diachitt1,
            hoten2: w.hoten2,
            namsinh2: w.namsinh2,
            loaicccd2: w.loaicccd2,
            socccd2: w.socccd2,
            diachitt2: w.diachitt2,
            matd: w.matd,
            tobando: w.tobando,
            sothua: w.sothua,
            dientich: w.dientich,
            hinhthucsd: w.hinhthucsd,
            loaidato: w.loaidato,
            dientichdato: w.dientichdato,
            mavach: w.mavach,
            maxa: w.maxa,
            manam: w.manam,
            sophathanhgcnmoi: w.sophathanhgcnmoi,
            sovaosomoi: w.sovaosomoi,
            ngaycapgcnmoi: w.ngaycapgcnmoi,
            diachiap: w.diachiap,
            soke_tang: w.soke_tang,
            so_o: w.so_o,
            so_tep: w.so_tep,
            So_tep: w.so_tep,
            sott_tep: w.sott_tep,
            nguoinhap: w.nguoinhap,
            ngaynhap: w.ngaynhap,
            ghichu: w.ghichu,
            ...(w.data || {})
        }
    };
};

export const fetchWarehouseRecordsPaginated = async (
    page: number, // 1-indexed
    limit: number,
    filters: WarehouseFilters
): Promise<PaginatedWarehouseResponse> => {
    if (!isConfigured) {
        // Fallback offline khi server chưa config kết nối
        const cached = getFromCache<ArchiveRecord[]>(CACHE_KEY_ARCHIVE, []);
        if (MOCK_ARCHIVE.length === 0 && cached.length > 0) MOCK_ARCHIVE = cached;
        let list = MOCK_ARCHIVE.filter(r => r.type === 'kho');

        if (filters.searchTerm) {
            const term = filters.searchTerm.toLowerCase();
            list = list.filter(r => {
                const d = r.data || {};
                return (r.so_hieu || '').toLowerCase().includes(term) ||
                    (d.loaihoso || '').toLowerCase().includes(term) ||
                    (d.hoten1 || '').toLowerCase().includes(term) ||
                    (d.hoten2 || '').toLowerCase().includes(term) ||
                    (d.socccd || '').toLowerCase().includes(term) ||
                    (d.socccd2 || '').toLowerCase().includes(term) ||
                    (d.sophathanhgcnmoi || '').toLowerCase().includes(term) ||
                    (d.sovaosomoi || '').toLowerCase().includes(term) ||
                    (d.soke_tang || '').toLowerCase().includes(term) ||
                    (d.so_o || '').toLowerCase().includes(term) ||
                    (d.matd || '').toLowerCase().includes(term);
            });
        }

        if (filters.advMaBienNhan) {
            list = list.filter(r => (r.so_hieu || '').toLowerCase().includes(filters.advMaBienNhan!.toLowerCase()));
        }
        if (filters.advLoaiHoSo) {
            list = list.filter(r => ((r.data?.loaihoso || '')).toLowerCase().includes(filters.advLoaiHoSo!.toLowerCase()));
        }
        if (filters.advChuSuDung) {
            const term = filters.advChuSuDung.toLowerCase();
            list = list.filter(r => (r.data?.hoten1 || '').toLowerCase().includes(term) || (r.data?.hoten2 || '').toLowerCase().includes(term));
        }
        if (filters.advCccd) {
            const term = filters.advCccd.toLowerCase();
            list = list.filter(r => (r.data?.socccd || '').toLowerCase().includes(term) || (r.data?.socccd2 || '').toLowerCase().includes(term));
        }
        if (filters.advToThua) {
            const term = filters.advToThua.toLowerCase();
            list = list.filter(r => (r.data?.tobando || '').toString().includes(term) || (r.data?.sothua || '').toString().includes(term));
        }
        if (filters.advKeTang) {
            list = list.filter(r => (r.data?.soke_tang || '').toLowerCase().includes(filters.advKeTang!.toLowerCase()));
        }
        if (filters.advHopSo) {
            const term = filters.advHopSo.toLowerCase();
            list = list.filter(r => (r.data?.so_o || '').toLowerCase().includes(term) || (r.data?.so_tep || r.data?.So_tep || '').toLowerCase().includes(term));
        }
        if (filters.advSoPhatHanh) {
            list = list.filter(r => (r.data?.sophathanhgcnmoi || '').toLowerCase().includes(filters.advSoPhatHanh!.toLowerCase()));
        }
        if (filters.advNguoiNhap) {
            list = list.filter(r => (r.data?.nguoinhap || '').toLowerCase().includes(filters.advNguoiNhap!.toLowerCase()));
        }

        const totalCount = list.length;
        const startIndex = (page - 1) * limit;
        return {
            records: list.slice(startIndex, startIndex + limit),
            totalCount
        };
    }

    try {
        const fromIndex = (page - 1) * limit;
        const toIndex = page * limit - 1;

        // BƯỚC 1: THỬ TRUY VẤN TRÊN BẢNG CHUYÊN DỤNG VIP 'warehouse_records' TRƯỚC
        try {
            let query = supabase
                .from('warehouse_records')
                .select('*', { count: 'exact' });

            if (filters.searchTerm && filters.searchTerm.trim() !== '') {
                const term = `%${filters.searchTerm.trim()}%`;
                query = query.or(`so_hieu.ilike.${term},loaihoso.ilike.${term},hoten1.ilike.${term},hoten2.ilike.${term},socccd.ilike.${term},socccd2.ilike.${term},sophathanhgcnmoi.ilike.${term},sovaosomoi.ilike.${term},soke_tang.ilike.${term},so_o.ilike.${term},matd.ilike.${term}`);
            }

            // Bộ lọc nâng cao trên các cột index siêu tốc
            if (filters.advMaBienNhan && filters.advMaBienNhan.trim() !== '') {
                query = query.ilike('so_hieu', `%${filters.advMaBienNhan.trim()}%`);
            }
            if (filters.advLoaiHoSo && filters.advLoaiHoSo.trim() !== '') {
                query = query.ilike('loaihoso', `%${filters.advLoaiHoSo.trim()}%`);
            }
            if (filters.advChuSuDung && filters.advChuSuDung.trim() !== '') {
                const term = `%${filters.advChuSuDung.trim()}%`;
                query = query.or(`hoten1.ilike.${term},hoten2.ilike.${term}`);
            }
            if (filters.advCccd && filters.advCccd.trim() !== '') {
                const term = `%${filters.advCccd.trim()}%`;
                query = query.or(`socccd.ilike.${term},socccd2.ilike.${term}`);
            }
            if (filters.advToThua && filters.advToThua.trim() !== '') {
                const term = `%${filters.advToThua.trim()}%`;
                query = query.or(`tobando.ilike.${term},sothua.ilike.${term}`);
            }
            if (filters.advKeTang && filters.advKeTang.trim() !== '') {
                query = query.ilike('soke_tang', `%${filters.advKeTang.trim()}%`);
            }
            if (filters.advHopSo && filters.advHopSo.trim() !== '') {
                const term = `%${filters.advHopSo.trim()}%`;
                query = query.or(`so_o.ilike.${term},so_tep.ilike.${term}`);
            }
            if (filters.advSoPhatHanh && filters.advSoPhatHanh.trim() !== '') {
                query = query.ilike('sophathanhgcnmoi', `%${filters.advSoPhatHanh.trim()}%`);
            }
            if (filters.advNguoiNhap && filters.advNguoiNhap.trim() !== '') {
                query = query.ilike('nguoinhap', `%${filters.advNguoiNhap.trim()}%`);
            }

            const { data, count, error } = await query
                .order('created_at', { ascending: false })
                .range(fromIndex, toIndex);

            if (error) {
                // Nếu code === '42P01' tức là table warehouse_records chưa được chạy migration SQL, ta nhảy sang khối catch để fallback
                if (error.code === '42P01') throw error;
                throw error;
            }

            return {
                records: (data || []).map(mapFromWarehouseRecord),
                totalCount: count || 0
            };
        } catch (innerError: any) {
            // Chỉ fallback sang archive_records nếu chưa tạo bảng warehouse_records
            if (innerError.code === '42P01') {
                // FALLBACK SANG BẢNG GỐC 'archive_records' (mặc dù chậm hơn đối với 300k, nhưng giúp app KHÔNG BỊ CRASH)
                let query = supabase
                    .from('archive_records')
                    .select('*', { count: 'exact' })
                    .eq('type', 'kho');

                if (filters.searchTerm && filters.searchTerm.trim() !== '') {
                    const term = `%${filters.searchTerm.trim()}%`;
                    query = query.or(`so_hieu.ilike.${term},data->>hoten1.ilike.${term},data->>hoten2.ilike.${term},data->>socccd.ilike.${term},data->>socccd2.ilike.${term},data->>sophathanhgcnmoi.ilike.${term},data->>sovaosomoi.ilike.${term},data->>soke_tang.ilike.${term},data->>so_o.ilike.${term},data->>matd.ilike.${term},data->>loaihoso.ilike.${term}`);
                }

                if (filters.advMaBienNhan && filters.advMaBienNhan.trim() !== '') {
                    query = query.ilike('so_hieu', `%${filters.advMaBienNhan.trim()}%`);
                }
                if (filters.advLoaiHoSo && filters.advLoaiHoSo.trim() !== '') {
                    query = query.ilike('data->>loaihoso', `%${filters.advLoaiHoSo.trim()}%`);
                }
                if (filters.advChuSuDung && filters.advChuSuDung.trim() !== '') {
                    const term = `%${filters.advChuSuDung.trim()}%`;
                    query = query.or(`data->>hoten1.ilike.${term},data->>hoten2.ilike.${term}`);
                }
                if (filters.advCccd && filters.advCccd.trim() !== '') {
                    const term = `%${filters.advCccd.trim()}%`;
                    query = query.or(`data->>socccd.ilike.${term},data->>socccd2.ilike.${term}`);
                }
                if (filters.advToThua && filters.advToThua.trim() !== '') {
                    const term = `%${filters.advToThua.trim()}%`;
                    query = query.or(`data->>tobando.ilike.${term},data->>sothua.ilike.${term}`);
                }
                if (filters.advKeTang && filters.advKeTang.trim() !== '') {
                    query = query.ilike('data->>soke_tang', `%${filters.advKeTang.trim()}%`);
                }
                if (filters.advHopSo && filters.advHopSo.trim() !== '') {
                    const term = `%${filters.advHopSo.trim()}%`;
                    query = query.or(`data->>so_o.ilike.${term},data->>so_tep.ilike.${term}`);
                }
                if (filters.advSoPhatHanh && filters.advSoPhatHanh.trim() !== '') {
                    query = query.ilike('data->>sophathanhgcnmoi', `%${filters.advSoPhatHanh.trim()}%`);
                }
                if (filters.advNguoiNhap && filters.advNguoiNhap.trim() !== '') {
                    query = query.ilike('data->>nguoinhap', `%${filters.advNguoiNhap.trim()}%`);
                }

                const { data, count, error } = await query
                    .order('created_at', { ascending: false })
                    .range(fromIndex, toIndex);

                if (error) throw error;

                return {
                    records: (data || []) as ArchiveRecord[],
                    totalCount: count || 0
                };
            }
            throw innerError;
        }
    } catch (e) {
        logError('fetchWarehouseRecordsPaginated', e);
        return { records: [], totalCount: 0 };
    }
};

