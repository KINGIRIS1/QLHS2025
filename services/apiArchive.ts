
import { supabase, isConfigured } from './supabaseClient';
import { logError, getFromCache, saveToCache } from './apiCore';

// --- TYPES ---
export interface ArchiveRecord {
    id: string;
    created_at: string;
    created_by: string;
    type: 'saoluc' | 'vaoso' | 'congvan';
    status: 'draft' | 'pending_sign' | 'completed'; // Nháp/Danh sách | Trình ký | Kết quả
    so_hieu: string; // Số hiệu/Số hồ sơ
    trich_yeu: string; // Nội dung/Trích yếu
    ngay_thang: string;
    noi_nhan_gui: string;
    data: any; // Các trường mở rộng khác
}

// Mock Data Stores
let MOCK_ARCHIVE: ArchiveRecord[] = [];

const CACHE_KEY_ARCHIVE = 'offline_archive_records';

// --- API ---

export const fetchArchiveRecords = async (type: 'saoluc' | 'vaoso' | 'congvan'): Promise<ArchiveRecord[]> => {
    if (!isConfigured) {
        const cached = getFromCache<ArchiveRecord[]>(CACHE_KEY_ARCHIVE, []);
        // Nếu cache rỗng và chưa có mock in-mem, dùng mảng rỗng. Nếu mock có data thì dùng mock (để sync trong session)
        if (MOCK_ARCHIVE.length === 0 && cached.length > 0) MOCK_ARCHIVE = cached;
        return MOCK_ARCHIVE.filter(r => r.type === type);
    }
    try {
        const { data, error } = await supabase
            .from('archive_records')
            .select('*')
            .eq('type', type)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as ArchiveRecord[];
    } catch (error) {
        logError(`fetchArchiveRecords-${type}`, error);
        return MOCK_ARCHIVE.filter(r => r.type === type);
    }
};

export const saveArchiveRecord = async (record: Partial<ArchiveRecord>): Promise<boolean> => {
    if (!isConfigured) {
        if (record.id) {
            const idx = MOCK_ARCHIVE.findIndex(r => r.id === record.id);
            if (idx !== -1) MOCK_ARCHIVE[idx] = { ...MOCK_ARCHIVE[idx], ...record } as ArchiveRecord;
        } else {
            const newRec = { 
                ...record, 
                id: Math.random().toString(36).substr(2, 9), 
                created_at: new Date().toISOString() 
            } as ArchiveRecord;
            MOCK_ARCHIVE.unshift(newRec);
        }
        saveToCache(CACHE_KEY_ARCHIVE, MOCK_ARCHIVE);
        return true;
    }
    try {
        // Chuẩn hóa dữ liệu
        const payload: any = { ...record };
        
        // Xử lý ngày tháng: Nếu rỗng thì set null để tránh lỗi định dạng DATE của PostgreSQL
        if (payload.ngay_thang === '') payload.ngay_thang = null;

        if (record.id) {
            const { error } = await supabase.from('archive_records').update({ 
                status: payload.status,
                so_hieu: payload.so_hieu,
                trich_yeu: payload.trich_yeu,
                ngay_thang: payload.ngay_thang,
                noi_nhan_gui: payload.noi_nhan_gui,
                data: payload.data
            }).eq('id', record.id);
            if (error) throw error;
        } else {
            // Khi Insert: KHÔNG tự sinh ID bằng Math.random() vì DB dùng UUID.
            // Để Supabase/Postgres tự sinh ID.
            delete payload.id; 
            
            const { error } = await supabase.from('archive_records').insert([payload]);
            if (error) throw error;
        }
        return true;
    } catch (error: any) {
        // Xử lý thông báo lỗi cụ thể cho 22P02 (Sai kiểu dữ liệu, ví dụ text vào trường UUID hoặc Date sai format)
        if (error.code === '22P02') {
            console.error("Lỗi định dạng dữ liệu (22P02):", error.message);
            logError("saveArchiveRecord", "Sai định dạng dữ liệu (Lỗi 22P02). Kiểm tra các trường Số hoặc Ngày tháng.");
        } else {
            logError("saveArchiveRecord", error);
        }
        return false;
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
        const { error } = await supabase.from('archive_records').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteArchiveRecord", error);
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
            if (p.ngay_thang === '') p.ngay_thang = null;
            return p;
        });

        const { error } = await supabase.from('archive_records').insert(payload);
        if (error) throw error;
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
            const mergedData = { ...r.data, ...(updates.data || {}) };
            const payload = { ...updates, data: mergedData };
            return supabase.from('archive_records').update(payload).eq('id', r.id);
        });

        await Promise.all(promises);
        return true;
    } catch (error) {
        logError("updateArchiveRecordsBatch", error);
        return false;
    }
};
