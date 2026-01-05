
import { supabase, isConfigured } from './supabaseClient';
import { logError } from './apiCore';

// --- COMMON TYPES ---
export interface GenericRecord {
    id: string;
    created_at: string;
    created_by: string;
    customer_name: string; // Tên chủ/người yêu cầu để tìm kiếm
    data: any; // Toàn bộ dữ liệu form (JSON)
}

export interface VphcRecord extends GenericRecord {
    record_type: 'mau01' | 'mau02';
}

export interface BienBanRecord extends GenericRecord {
    // data chứa formData, boundaryChanges, boundaryChangesBDDC
}

export interface ThongTinRecord extends GenericRecord {
    // data chứa formData
}

// Mock Data Stores
const MOCK_VPHC: VphcRecord[] = [];
const MOCK_BIENBAN: BienBanRecord[] = [];
const MOCK_THONGTIN: ThongTinRecord[] = [];

// Helper sinh ID ngẫu nhiên
const generateId = () => Math.random().toString(36).substr(2, 9);

// ============================================================================
// 1. BIÊN BẢN VPHC
// ============================================================================

export const fetchVphcRecords = async (): Promise<VphcRecord[]> => {
    if (!isConfigured) return MOCK_VPHC;
    try {
        const { data, error } = await supabase
            .from('vphc_records')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as VphcRecord[];
    } catch (error) {
        logError("fetchVphcRecords", error);
        return MOCK_VPHC;
    }
};

export const saveVphcRecord = async (record: Partial<VphcRecord>): Promise<boolean> => {
    if (!isConfigured) {
        if (!record.id) {
            const newRec = { ...record, id: generateId(), created_at: new Date().toISOString() } as VphcRecord;
            MOCK_VPHC.unshift(newRec);
        } else {
            const idx = MOCK_VPHC.findIndex(r => r.id === record.id);
            if (idx !== -1) MOCK_VPHC[idx] = { ...MOCK_VPHC[idx], ...record } as VphcRecord;
        }
        return true;
    }
    try {
        if (record.id) {
            // Update
            const { error } = await supabase.from('vphc_records').update({ 
                customer_name: record.customer_name,
                record_type: record.record_type,
                data: record.data,
                created_by: record.created_by
            }).eq('id', record.id);
            if (error) throw error;
        } else {
            // Insert - FIX: Sinh ID trước khi gửi
            const newRecord = { ...record, id: generateId() };
            const { error } = await supabase.from('vphc_records').insert([newRecord]);
            if (error) throw error;
        }
        return true;
    } catch (error) {
        logError("saveVphcRecord", error);
        return false;
    }
};

export const deleteVphcRecord = async (id: string): Promise<boolean> => {
    if (!isConfigured) {
        const idx = MOCK_VPHC.findIndex(r => r.id === id);
        if (idx !== -1) MOCK_VPHC.splice(idx, 1);
        return true;
    }
    try {
        const { error } = await supabase.from('vphc_records').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteVphcRecord", error);
        return false;
    }
};

// ============================================================================
// 2. BIÊN BẢN HIỆN TRẠNG
// ============================================================================

export const fetchBienBanRecords = async (): Promise<BienBanRecord[]> => {
    if (!isConfigured) return MOCK_BIENBAN;
    try {
        const { data, error } = await supabase
            .from('bienban_records')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as BienBanRecord[];
    } catch (error) {
        // Fallback: Create table if not exists or ignore
        // logError("fetchBienBanRecords", error);
        return MOCK_BIENBAN;
    }
};

export const saveBienBanRecord = async (record: Partial<BienBanRecord>): Promise<boolean> => {
    if (!isConfigured) {
        if (!record.id) {
            const newRec = { ...record, id: generateId(), created_at: new Date().toISOString() } as BienBanRecord;
            MOCK_BIENBAN.unshift(newRec);
        } else {
            const idx = MOCK_BIENBAN.findIndex(r => r.id === record.id);
            if (idx !== -1) MOCK_BIENBAN[idx] = { ...MOCK_BIENBAN[idx], ...record } as BienBanRecord;
        }
        return true;
    }
    try {
        if (record.id) {
            // Update
            const { error } = await supabase.from('bienban_records').update({ 
                customer_name: record.customer_name,
                data: record.data,
                created_by: record.created_by
            }).eq('id', record.id);
            if (error) throw error;
        } else {
            // Insert - FIX: Sinh ID trước khi gửi
            const newRecord = { ...record, id: generateId() };
            const { error } = await supabase.from('bienban_records').insert([newRecord]);
            if (error) throw error;
        }
        return true;
    } catch (error) {
        logError("saveBienBanRecord", error);
        return false;
    }
};

export const deleteBienBanRecord = async (id: string): Promise<boolean> => {
    if (!isConfigured) {
        const idx = MOCK_BIENBAN.findIndex(r => r.id === id);
        if (idx !== -1) MOCK_BIENBAN.splice(idx, 1);
        return true;
    }
    try {
        const { error } = await supabase.from('bienban_records').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteBienBanRecord", error);
        return false;
    }
};

// ============================================================================
// 3. CUNG CẤP THÔNG TIN
// ============================================================================

export const fetchThongTinRecords = async (): Promise<ThongTinRecord[]> => {
    if (!isConfigured) return MOCK_THONGTIN;
    try {
        const { data, error } = await supabase
            .from('thongtin_records')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as ThongTinRecord[];
    } catch (error) {
        // logError("fetchThongTinRecords", error);
        return MOCK_THONGTIN;
    }
};

export const saveThongTinRecord = async (record: Partial<ThongTinRecord>): Promise<boolean> => {
    if (!isConfigured) {
        if (!record.id) {
            const newRec = { ...record, id: generateId(), created_at: new Date().toISOString() } as ThongTinRecord;
            MOCK_THONGTIN.unshift(newRec);
        } else {
            const idx = MOCK_THONGTIN.findIndex(r => r.id === record.id);
            if (idx !== -1) MOCK_THONGTIN[idx] = { ...MOCK_THONGTIN[idx], ...record } as ThongTinRecord;
        }
        return true;
    }
    try {
        if (record.id) {
            // Update
            const { error } = await supabase.from('thongtin_records').update({ 
                customer_name: record.customer_name,
                data: record.data,
                created_by: record.created_by
            }).eq('id', record.id);
            if (error) throw error;
        } else {
            // Insert - FIX: Sinh ID trước khi gửi
            const newRecord = { ...record, id: generateId() };
            const { error } = await supabase.from('thongtin_records').insert([newRecord]);
            if (error) throw error;
        }
        return true;
    } catch (error) {
        logError("saveThongTinRecord", error);
        return false;
    }
};

export const deleteThongTinRecord = async (id: string): Promise<boolean> => {
    if (!isConfigured) {
        const idx = MOCK_THONGTIN.findIndex(r => r.id === id);
        if (idx !== -1) MOCK_THONGTIN.splice(idx, 1);
        return true;
    }
    try {
        const { error } = await supabase.from('thongtin_records').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteThongTinRecord", error);
        return false;
    }
};
