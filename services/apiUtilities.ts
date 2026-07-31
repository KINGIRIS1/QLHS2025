
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

export interface ChinhLyRecord extends GenericRecord {
    // data chứa các trường chỉnh lý biến động
}

export interface TachThuaRecord extends GenericRecord {
    // data chứa các trường tách thửa (cấu trúc giống ChinhLyRecord)
}

export interface GiayMoiRecord extends GenericRecord {
    // data chứa formData của Giấy mời
}

export interface MapSheetConversion {
    id: string;
    created_at: string;
    xa_phuong_cu: string;
    so_to_cu: string;
    xa_phuong_moi: string;
    so_to_moi: string;
}

// Mock Data Stores
const MOCK_VPHC: VphcRecord[] = [];
const MOCK_BIENBAN: BienBanRecord[] = [];
const MOCK_THONGTIN: ThongTinRecord[] = [];
const MOCK_CHINHLY: ChinhLyRecord[] = [];
const MOCK_TACHTHUA: TachThuaRecord[] = [];
const MOCK_GIAYMOI: GiayMoiRecord[] = [];
let MOCK_MAP_CONVERSIONS: MapSheetConversion[] = [];

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

// ============================================================================
// 4. DANH SÁCH CHỈNH LÝ BIẾN ĐỘNG
// ============================================================================

export const fetchChinhLyRecords = async (): Promise<ChinhLyRecord[]> => {
    if (!isConfigured) return MOCK_CHINHLY;
    try {
        const { data, error } = await supabase
            .from('chinhly_records')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as ChinhLyRecord[];
    } catch (error) {
        // Fallback or ignore if table not created
        return MOCK_CHINHLY;
    }
};

export const saveChinhLyRecord = async (record: Partial<ChinhLyRecord>): Promise<boolean> => {
    if (!isConfigured) {
        if (!record.id) {
            const newRec = { ...record, id: generateId(), created_at: new Date().toISOString() } as ChinhLyRecord;
            MOCK_CHINHLY.unshift(newRec);
        } else {
            const idx = MOCK_CHINHLY.findIndex(r => r.id === record.id);
            if (idx !== -1) MOCK_CHINHLY[idx] = { ...MOCK_CHINHLY[idx], ...record } as ChinhLyRecord;
        }
        return true;
    }
    try {
        if (record.id) {
            const { error } = await supabase.from('chinhly_records').update({ 
                customer_name: record.customer_name,
                data: record.data,
                created_by: record.created_by
            }).eq('id', record.id);
            if (error) throw error;
        } else {
            const newRecord = { ...record, id: generateId() };
            const { error } = await supabase.from('chinhly_records').insert([newRecord]);
            if (error) throw error;
        }
        return true;
    } catch (error) {
        logError("saveChinhLyRecord", error);
        return false;
    }
};

export const deleteChinhLyRecord = async (id: string): Promise<boolean> => {
    if (!isConfigured) {
        const idx = MOCK_CHINHLY.findIndex(r => r.id === id);
        if (idx !== -1) MOCK_CHINHLY.splice(idx, 1);
        return true;
    }
    try {
        const { error } = await supabase.from('chinhly_records').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteChinhLyRecord", error);
        return false;
    }
};

// ============================================================================
// 5. HỒ SƠ TÁCH THỬA (NEW)
// ============================================================================

export const fetchTachThuaRecords = async (): Promise<TachThuaRecord[]> => {
    if (!isConfigured) return MOCK_TACHTHUA;
    try {
        const { data, error } = await supabase
            .from('tachthua_records')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as TachThuaRecord[];
    } catch (error) {
        return MOCK_TACHTHUA;
    }
};

export const saveTachThuaRecord = async (record: Partial<TachThuaRecord>): Promise<boolean> => {
    if (!isConfigured) {
        if (!record.id) {
            const newRec = { ...record, id: generateId(), created_at: new Date().toISOString() } as TachThuaRecord;
            MOCK_TACHTHUA.unshift(newRec);
        } else {
            const idx = MOCK_TACHTHUA.findIndex(r => r.id === record.id);
            if (idx !== -1) MOCK_TACHTHUA[idx] = { ...MOCK_TACHTHUA[idx], ...record } as TachThuaRecord;
        }
        return true;
    }
    try {
        if (record.id) {
            const { error } = await supabase.from('tachthua_records').update({ 
                customer_name: record.customer_name,
                data: record.data,
                created_by: record.created_by
            }).eq('id', record.id);
            if (error) throw error;
        } else {
            const newRecord = { ...record, id: generateId() };
            const { error } = await supabase.from('tachthua_records').insert([newRecord]);
            if (error) throw error;
        }
        return true;
    } catch (error) {
        logError("saveTachThuaRecord", error);
        return false;
    }
};

export const deleteTachThuaRecord = async (id: string): Promise<boolean> => {
    if (!isConfigured) {
        const idx = MOCK_TACHTHUA.findIndex(r => r.id === id);
        if (idx !== -1) MOCK_TACHTHUA.splice(idx, 1);
        return true;
    }
    try {
        const { error } = await supabase.from('tachthua_records').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteTachThuaRecord", error);
        return false;
    }
};

// ============================================================================
// 6. GIẤY MỜI
// ============================================================================

export const fetchGiayMoiRecords = async (): Promise<GiayMoiRecord[]> => {
    if (!isConfigured) return MOCK_GIAYMOI;
    try {
        const { data, error } = await supabase
            .from('giaymoi_records')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as GiayMoiRecord[];
    } catch (error) {
        return MOCK_GIAYMOI;
    }
};

export const saveGiayMoiRecord = async (record: Partial<GiayMoiRecord>): Promise<boolean> => {
    if (!isConfigured) {
        if (!record.id) {
            const newRec = { ...record, id: generateId(), created_at: new Date().toISOString() } as GiayMoiRecord;
            MOCK_GIAYMOI.unshift(newRec);
        } else {
            const idx = MOCK_GIAYMOI.findIndex(r => r.id === record.id);
            if (idx !== -1) MOCK_GIAYMOI[idx] = { ...MOCK_GIAYMOI[idx], ...record } as GiayMoiRecord;
        }
        return true;
    }
    try {
        if (record.id) {
            const { error } = await supabase.from('giaymoi_records').update({ 
                customer_name: record.customer_name,
                data: record.data,
                created_by: record.created_by
            }).eq('id', record.id);
            if (error) throw error;
        } else {
            const newRecord = { ...record, id: generateId() };
            const { error } = await supabase.from('giaymoi_records').insert([newRecord]);
            if (error) throw error;
        }
        return true;
    } catch (error) {
        logError("saveGiayMoiRecord", error);
        return false;
    }
};

export const deleteGiayMoiRecord = async (id: string): Promise<boolean> => {
    if (!isConfigured) {
        const idx = MOCK_GIAYMOI.findIndex(r => r.id === id);
        if (idx !== -1) MOCK_GIAYMOI.splice(idx, 1);
        return true;
    }
    try {
        const { error } = await supabase.from('giaymoi_records').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteGiayMoiRecord", error);
        return false;
    }
};

export interface LateSubmission extends GenericRecord {
    // data chứa formData của phiếu chậm nộp
}

const MOCK_LATE: LateSubmission[] = [];

export const fetchLateSubmissions = async (): Promise<LateSubmission[]> => {
    if (!isConfigured) return MOCK_LATE;
    try {
        const { data, error } = await supabase
            .from('late_submissions')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as LateSubmission[];
    } catch (error) {
        logError("fetchLateSubmissions", error);
        return MOCK_LATE;
    }
};

export const saveLateSubmission = async (record: Partial<LateSubmission>): Promise<boolean> => {
    if (!isConfigured) {
        if (!record.id) {
            const newRec = { ...record, id: generateId(), created_at: new Date().toISOString() } as LateSubmission;
            MOCK_LATE.unshift(newRec);
        } else {
            const idx = MOCK_LATE.findIndex(r => r.id === record.id);
            if (idx !== -1) MOCK_LATE[idx] = { ...MOCK_LATE[idx], ...record } as LateSubmission;
        }
        return true;
    }
    try {
        if (record.id) {
            const { error } = await supabase.from('late_submissions').update({ 
                customer_name: record.customer_name,
                data: record.data,
                created_by: record.created_by
            }).eq('id', record.id);
            if (error) throw error;
        } else {
            const newRecord = { ...record, id: generateId() };
            const { error } = await supabase.from('late_submissions').insert([newRecord]);
            if (error) throw error;
        }
        return true;
    } catch (error) {
        logError("saveLateSubmission", error);
        return false;
    }
};

export const deleteLateSubmission = async (id: string): Promise<boolean> => {
    if (!isConfigured) {
        const idx = MOCK_LATE.findIndex(r => r.id === id);
        if (idx !== -1) MOCK_LATE.splice(idx, 1);
        return true;
    }
    try {
        const { error } = await supabase.from('late_submissions').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteLateSubmission", error);
        return false;
    }
};

// ============================================================================
// 6. CHUYỂN ĐỔI TỜ BẢN ĐỒ
// ============================================================================

export const fetchMapSheetConversions = async (): Promise<MapSheetConversion[]> => {
    if (!isConfigured) return MOCK_MAP_CONVERSIONS;
    try {
        const { data, error } = await supabase
            .from('map_sheet_conversions')
            .select('*')
            .order('xa_phuong_cu', { ascending: true });
        if (error) throw error;
        return data as MapSheetConversion[];
    } catch (error) {
        logError("fetchMapSheetConversions", error);
        return MOCK_MAP_CONVERSIONS;
    }
};

export const saveMapSheetConversions = async (records: Partial<MapSheetConversion>[]): Promise<boolean> => {
    if (!isConfigured) {
        const newRecords = records.map(r => ({
            ...r,
            id: generateId(),
            created_at: new Date().toISOString()
        })) as MapSheetConversion[];
        MOCK_MAP_CONVERSIONS = [...MOCK_MAP_CONVERSIONS, ...newRecords];
        return true;
    }
    try {
        // Prepare records for insertion
        const newRecords = records.map(r => ({
            xa_phuong_cu: r.xa_phuong_cu,
            so_to_cu: r.so_to_cu,
            xa_phuong_moi: r.xa_phuong_moi,
            so_to_moi: r.so_to_moi
        }));

        const { error } = await supabase.from('map_sheet_conversions').insert(newRecords);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("saveMapSheetConversions", error);
        return false;
    }
};

export const deleteAllMapSheetConversions = async (): Promise<boolean> => {
    if (!isConfigured) {
        MOCK_MAP_CONVERSIONS = [];
        return true;
    }
    try {
        // Supabase requires a filter for delete. We can delete where id is not null.
        const { error } = await supabase.from('map_sheet_conversions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteAllMapSheetConversions", error);
        return false;
    }
};

// ============================================================================
// 7. MÃ MÀU QUY HOẠCH
// ============================================================================

export interface PlanningColor {
    id: string;
    created_at?: string;
    loai_dat: string;
    ky_hieu: string;
    mau_sac: string;
    so_mau_sac?: string;
    r: number;
    g: number;
    b: number;
}

const DEFAULT_PLANNING_COLORS: PlanningColor[] = [
    { id: '1', loai_dat: 'Đất ở tại đô thị', ky_hieu: 'ODT', mau_sac: 'Hồng sẫm', so_mau_sac: '85', r: 242, g: 63, b: 153 },
    { id: '2', loai_dat: 'Đất ở tại nông thôn', ky_hieu: 'ONT', mau_sac: 'Hồng nhạt', so_mau_sac: '15', r: 254, g: 181, b: 181 },
    { id: '3', loai_dat: 'Đất trồng lúa', ky_hieu: 'LUA', mau_sac: 'Vàng chanh', so_mau_sac: '3', r: 255, g: 255, b: 0 },
    { id: '4', loai_dat: 'Đất trồng cây hàng năm khác', ky_hieu: 'BHK', mau_sac: 'Vàng nhạt', so_mau_sac: '4', r: 255, g: 255, b: 173 },
    { id: '5', loai_dat: 'Đất trồng cây lâu năm', ky_hieu: 'CLN', mau_sac: 'Vàng cam', so_mau_sac: '5', r: 248, g: 181, b: 110 },
    { id: '6', loai_dat: 'Đất rừng sản xuất', ky_hieu: 'RSX', mau_sac: 'Xanh lá cây nhạt', so_mau_sac: '120', r: 196, g: 236, b: 196 },
    { id: '7', loai_dat: 'Đất rừng phòng hộ', ky_hieu: 'RPH', mau_sac: 'Xanh lá cây đậm', so_mau_sac: '123', r: 34, g: 139, b: 34 },
    { id: '8', loai_dat: 'Đất rừng đặc dụng', ky_hieu: 'RDD', mau_sac: 'Xanh lá mạ', so_mau_sac: '125', r: 124, g: 252, b: 0 },
    { id: '9', loai_dat: 'Đất nuôi trồng thủy sản', ky_hieu: 'NTS', mau_sac: 'Xanh biển lơ', so_mau_sac: '8', r: 135, g: 206, b: 250 },
    { id: '10', loai_dat: 'Đất làm muối', ky_hieu: 'LMU', mau_sac: 'Xám nhạt', so_mau_sac: '10', r: 220, g: 220, b: 220 },
    { id: '11', loai_dat: 'Đất thương mại, dịch vụ', ky_hieu: 'TMD', mau_sac: 'Đỏ cam', so_mau_sac: '11', r: 255, g: 127, b: 80 },
    { id: '12', loai_dat: 'Đất cơ sở sản xuất phi nông nghiệp', ky_hieu: 'SKC', mau_sac: 'Xám đậm', so_mau_sac: '12', r: 169, g: 169, b: 169 },
    { id: '13', loai_dat: 'Đất quốc phòng', ky_hieu: 'CQP', mau_sac: 'Đỏ tươi', so_mau_sac: '1', r: 255, g: 0, b: 0 },
    { id: '14', loai_dat: 'Đất an ninh', ky_hieu: 'CAN', mau_sac: 'Đỏ nhạt', so_mau_sac: '14', r: 255, g: 102, b: 102 },
    { id: '15', loai_dat: 'Đất khu vui chơi, giải trí công cộng', ky_hieu: 'DKV', mau_sac: 'Hồng cam', so_mau_sac: '24', r: 255, g: 192, b: 203 },
    { id: '16', loai_dat: 'Đất giao thông', ky_hieu: 'DGT', mau_sac: 'Xám', so_mau_sac: '16', r: 192, g: 192, b: 192 },
    { id: '17', loai_dat: 'Đất thủy lợi', ky_hieu: 'DTL', mau_sac: 'Xanh lam đậm', so_mau_sac: '17', r: 0, g: 0, b: 255 },
    { id: '18', loai_dat: 'Đất xây dựng trụ sở cơ quan', ky_hieu: 'TSC', mau_sac: 'Tím nhạt', so_mau_sac: '18', r: 216, g: 191, b: 216 },
    { id: '19', loai_dat: 'Đất nghĩa trang, nghĩa địa', ky_hieu: 'NTD', mau_sac: 'Xám xịt', so_mau_sac: '19', r: 128, g: 128, b: 128 },
    { id: '20', loai_dat: 'Đất sinh hoạt cộng đồng', ky_hieu: 'DSH', mau_sac: 'Xanh ngọc', so_mau_sac: '20', r: 64, g: 224, b: 208 }
];

let MOCK_PLANNING_COLORS: PlanningColor[] = [...DEFAULT_PLANNING_COLORS];

const LOCAL_STORAGE_KEY = 'PLANNING_COLORS_DATA';

// Load from localStorage if present
const initLocalStorageColors = () => {
    try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
            MOCK_PLANNING_COLORS = JSON.parse(saved);
        } else {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_PLANNING_COLORS));
            MOCK_PLANNING_COLORS = [...DEFAULT_PLANNING_COLORS];
        }
    } catch (e) {
        console.error('Error reading planning colors from localStorage', e);
    }
};

initLocalStorageColors();

export const fetchPlanningColors = async (): Promise<PlanningColor[]> => {
    if (!isConfigured) {
        initLocalStorageColors();
        return MOCK_PLANNING_COLORS;
    }
    try {
        const { data, error } = await supabase
            .from('planning_colors')
            .select('*')
            .order('ky_hieu', { ascending: true });
        if (error) throw error;
        return data as PlanningColor[];
    } catch (error) {
        // Fallback to localStorage if table doesn't exist yet
        initLocalStorageColors();
        return MOCK_PLANNING_COLORS;
    }
};

export const savePlanningColor = async (record: Partial<PlanningColor>): Promise<boolean> => {
    if (!isConfigured) {
        if (!record.id) {
            const newRec = { 
                ...record, 
                id: generateId(), 
                created_at: new Date().toISOString() 
            } as PlanningColor;
            MOCK_PLANNING_COLORS.push(newRec);
        } else {
            const idx = MOCK_PLANNING_COLORS.findIndex(r => r.id === record.id);
            if (idx !== -1) {
                MOCK_PLANNING_COLORS[idx] = { ...MOCK_PLANNING_COLORS[idx], ...record } as PlanningColor;
            }
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(MOCK_PLANNING_COLORS));
        return true;
    }
    try {
        if (record.id) {
            const { error } = await supabase.from('planning_colors').update({
                loai_dat: record.loai_dat,
                ky_hieu: record.ky_hieu,
                mau_sac: record.mau_sac,
                so_mau_sac: record.so_mau_sac,
                r: record.r,
                g: record.g,
                b: record.b
            }).eq('id', record.id);
            if (error) throw error;
        } else {
            const newRec = { ...record, id: generateId() };
            const { error } = await supabase.from('planning_colors').insert([newRec]);
            if (error) throw error;
        }
        return true;
    } catch (error) {
        logError("savePlanningColor", error);
        // Fallback write
        if (!record.id) {
            const newRec = { ...record, id: generateId() } as PlanningColor;
            MOCK_PLANNING_COLORS.push(newRec);
        } else {
            const idx = MOCK_PLANNING_COLORS.findIndex(r => r.id === record.id);
            if (idx !== -1) {
                MOCK_PLANNING_COLORS[idx] = { ...MOCK_PLANNING_COLORS[idx], ...record } as PlanningColor;
            }
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(MOCK_PLANNING_COLORS));
        return true;
    }
};

export const savePlanningColorsBulk = async (records: Partial<PlanningColor>[]): Promise<boolean> => {
    if (!isConfigured) {
        const newRecs = records.map(r => ({
            ...r,
            id: generateId(),
            created_at: new Date().toISOString()
        })) as PlanningColor[];
        MOCK_PLANNING_COLORS = [...MOCK_PLANNING_COLORS, ...newRecs];
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(MOCK_PLANNING_COLORS));
        return true;
    }
    try {
        const newRecs = records.map(r => ({
            id: generateId(),
            loai_dat: r.loai_dat,
            ky_hieu: r.ky_hieu,
            mau_sac: r.mau_sac,
            so_mau_sac: r.so_mau_sac,
            r: Number(r.r),
            g: Number(r.g),
            b: Number(r.b)
        }));
        const { error } = await supabase.from('planning_colors').insert(newRecs);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("savePlanningColorsBulk", error);
        // Fallback
        const newRecs = records.map(r => ({
            ...r,
            id: generateId(),
            created_at: new Date().toISOString()
        })) as PlanningColor[];
        MOCK_PLANNING_COLORS = [...MOCK_PLANNING_COLORS, ...newRecs];
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(MOCK_PLANNING_COLORS));
        return true;
    }
};

export const deletePlanningColor = async (id: string): Promise<boolean> => {
    if (!isConfigured) {
        const idx = MOCK_PLANNING_COLORS.findIndex(r => r.id === id);
        if (idx !== -1) {
            MOCK_PLANNING_COLORS.splice(idx, 1);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(MOCK_PLANNING_COLORS));
        }
        return true;
    }
    try {
        const { error } = await supabase.from('planning_colors').delete().eq('id', id);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deletePlanningColor", error);
        const idx = MOCK_PLANNING_COLORS.findIndex(r => r.id === id);
        if (idx !== -1) {
            MOCK_PLANNING_COLORS.splice(idx, 1);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(MOCK_PLANNING_COLORS));
        }
        return true;
    }
};

export const deleteAllPlanningColors = async (): Promise<boolean> => {
    if (!isConfigured) {
        MOCK_PLANNING_COLORS = [];
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([]));
        return true;
    }
    try {
        const { error } = await supabase.from('planning_colors').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteAllPlanningColors", error);
        MOCK_PLANNING_COLORS = [];
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([]));
        return true;
    }
};

export const resetPlanningColorsToDefault = async (): Promise<boolean> => {
    MOCK_PLANNING_COLORS = [...DEFAULT_PLANNING_COLORS];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_PLANNING_COLORS));
    if (isConfigured) {
        try {
            await supabase.from('planning_colors').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            const dataToInsert = DEFAULT_PLANNING_COLORS.map(c => ({
                id: c.id,
                loai_dat: c.loai_dat,
                ky_hieu: c.ky_hieu,
                mau_sac: c.mau_sac,
                so_mau_sac: c.so_mau_sac,
                r: c.r,
                g: c.g,
                b: c.b
            }));
            await supabase.from('planning_colors').insert(dataToInsert);
        } catch (e) {
            console.error('Failed to reset in Supabase, kept locally', e);
        }
    }
    return true;
};

