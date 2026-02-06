
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
        if (record.id) {
            const { error } = await supabase.from('archive_records').update({ 
                status: record.status,
                so_hieu: record.so_hieu,
                trich_yeu: record.trich_yeu,
                ngay_thang: record.ngay_thang,
                noi_nhan_gui: record.noi_nhan_gui,
                data: record.data
            }).eq('id', record.id);
            if (error) throw error;
        } else {
            const newRecord = { ...record, id: Math.random().toString(36).substr(2, 9) };
            const { error } = await supabase.from('archive_records').insert([newRecord]);
            if (error) throw error;
        }
        return true;
    } catch (error) {
        logError("saveArchiveRecord", error);
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
