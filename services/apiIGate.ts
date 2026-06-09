import { supabase, isConfigured } from './supabaseClient';
import { logError } from './apiCore';

export interface IGateRecord {
    id: string;
    soHieu: string;        // Số hồ sơ
    tenThuTuc: string;      // Tên thủ tục hành chính
    tenLinhVuc: string;     // Tên lĩnh vực
    ngayTiepNhan: string;   // Ngày tiếp nhận
    ngayHenTra: string;     // Ngày hẹn trả
    ngayKetThuc: string;    // Ngày kết thúc xử lý
    donVi: string;          // Cơ quan/đơn vị
    chuHoSo: string;        // Chủ hồ sơ
    soDienThoai: string;    // Số điện thoại
    canBoXuLy: string;      // Cán bộ xử lý hiện tại
    trangThai: string;      // Trạng thái hồ sơ
}

function parseSafeDate(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;
    const trimmed = dateStr.trim();
    if (!trimmed || trimmed === '' || trimmed.toLowerCase() === 'null') return null;
    
    // Tách phần ngày và giờ
    const parts = trimmed.split(/\s+/);
    const datePart = parts[0];
    const timePart = parts[1] || '';
    
    let parsedDate = '';
    
    // Định dạng YYYY-MM-DD chuẩn
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        parsedDate = datePart;
    }
    // Nếu có dạng DD/MM/YYYY hoặc D/M/YYYY, tự chuyển sang YYYY-MM-DD
    else {
        const ddmmyyyyMatch = datePart.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
        if (ddmmyyyyMatch) {
             const day = ddmmyyyyMatch[1].padStart(2, '0');
             const month = ddmmyyyyMatch[2].padStart(2, '0');
             const year = ddmmyyyyMatch[3];
             parsedDate = `${year}-${month}-${day}`;
        }
    }
    
    if (parsedDate) {
        return timePart ? `${parsedDate} ${timePart}` : parsedDate;
    }
    
    try {
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
            const datePartIso = parsed.toISOString().split('T')[0];
            const timePartIso = parsed.toISOString().split('T')[1].split('.')[0];
            return timePartIso && timePartIso !== '00:00:00' ? `${datePartIso} ${timePartIso}` : datePartIso;
        }
    } catch (e) {}

    return null;
}

export const mapIGateToDb = (r: IGateRecord) => ({
    id: r.id,
    so_hieu: r.soHieu,
    ten_thu_tuc: r.tenThuTuc,
    ten_linh_vuc: r.tenLinhVuc,
    ngay_tiep_nhan: parseSafeDate(r.ngayTiepNhan),
    ngay_hen_tra: parseSafeDate(r.ngayHenTra),
    ngay_ket_thuc: parseSafeDate(r.ngayKetThuc),
    don_vi: r.donVi,
    chu_ho_so: r.chuHoSo,
    so_dien_thoai: r.soDienThoai,
    can_bo_xu_ly: r.canBoXuLy,
    trang_thai: r.trangThai
});

export const mapIGateFromDb = (r: any): IGateRecord => ({
    id: r.id,
    soHieu: r.so_hieu || r.soHieu,
    tenThuTuc: r.ten_thu_tuc || r.tenThuTuc,
    tenLinhVuc: r.ten_linh_vuc || r.tenLinhVuc,
    ngayTiepNhan: r.ngay_tiep_nhan || r.ngayTiepNhan || '',
    ngayHenTra: r.ngay_hen_tra || r.ngayHenTra || '',
    ngayKetThuc: r.ngay_ket_thuc || r.ngayKetThuc || '',
    donVi: r.don_vi || r.donVi || '',
    chuHoSo: r.chu_ho_so || r.chuHoSo,
    soDienThoai: r.so_dien_thoai || r.soDienThoai || '',
    canBoXuLy: r.can_bo_xu_ly || r.canBoXuLy || '',
    trangThai: r.trang_thai || r.trangThai || ''
});

const LOCAL_STORAGE_KEY = 'IGATE_RECORDS';

export const fetchIGateRecords = async (defaultRecords: IGateRecord[]): Promise<IGateRecord[]> => {
    if (!isConfigured) {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
            try { return JSON.parse(stored); } catch (e) { return defaultRecords; }
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(defaultRecords));
        return defaultRecords;
    }
    try {
        let allData: any[] = [];
        let from = 0;
        const limit = 1000;
        let hasMore = true;
        
        while (hasMore) {
            const { data, error } = await supabase
                .from('igate_records')
                .select('*')
                .order('created_at', { ascending: false })
                .range(from, from + limit - 1);
                
            if (error) {
                if (error.code === '42P01') {
                    console.warn("⚠️ Bảng igate_records chưa được khởi tạo trên Supabase Cloud. Tự động chuyển vùng dữ liệu dự phòng LocalStorage.");
                } else {
                    throw error;
                }
                const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
                return stored ? JSON.parse(stored) : defaultRecords;
            }
            
            if (data && data.length > 0) {
                allData = [...allData, ...data];
                if (data.length < limit) {
                    hasMore = false;
                } else {
                    from += limit;
                }
            } else {
                hasMore = false;
            }
        }
        
        if (allData.length === 0) {
            const mappedDefaults = defaultRecords.map(mapIGateToDb);
            await supabase.from('igate_records').insert(mappedDefaults);
            return defaultRecords;
        }
        
        const mapped = allData.map(mapIGateFromDb);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mapped));
        return mapped;
    } catch (e) {
        logError("fetchIGateRecords", e);
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        return stored ? JSON.parse(stored) : defaultRecords;
    }
};

export const saveIGateRecordApi = async (record: IGateRecord, isUpdate: boolean, defaultRecords: IGateRecord[]): Promise<boolean> => {
    if (!isConfigured) {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        let list: IGateRecord[] = stored ? JSON.parse(stored) : defaultRecords;
        if (isUpdate) {
            list = list.map(r => r.id === record.id ? record : r);
        } else {
            list = [record, ...list];
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
        return true;
    }
    try {
        const payload = mapIGateToDb(record);
        if (isUpdate) {
            const { error } = await supabase.from('igate_records').update(payload).eq('id', record.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('igate_records').insert([payload]);
            if (error) throw error;
        }
        // Đồng bộ LocalStorage
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        let list: IGateRecord[] = stored ? JSON.parse(stored) : defaultRecords;
        if (isUpdate) {
            list = list.map(r => r.id === record.id ? record : r);
        } else {
            list = [record, ...list];
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
        return true;
    } catch (e) {
        logError("saveIGateRecordApi", e);
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        let list: IGateRecord[] = stored ? JSON.parse(stored) : defaultRecords;
        if (isUpdate) {
            list = list.map(r => r.id === record.id ? record : r);
        } else {
            list = [record, ...list];
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
        return true;
    }
};

export const saveIGateRecordsBatchApi = async (recordsList: IGateRecord[], defaultRecords: IGateRecord[]): Promise<boolean> => {
    if (!isConfigured) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(recordsList));
        return true;
    }
    try {
        const { error: deleteError } = await supabase.from('igate_records').delete().neq('id', '___non_existent_id___');
        if (deleteError) throw deleteError;
        
        if (recordsList.length > 0) {
            const payloads = recordsList.map(mapIGateToDb);
            const { error: insertError } = await supabase.from('igate_records').insert(payloads);
            if (insertError) throw insertError;
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(recordsList));
        return true;
    } catch (e) {
        logError("saveIGateRecordsBatchApi", e);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(recordsList));
        return true;
    }
};

export const deleteIGateRecordApi = async (id: string, defaultRecords: IGateRecord[]): Promise<boolean> => {
    if (!isConfigured) {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        let list: IGateRecord[] = stored ? JSON.parse(stored) : defaultRecords;
        list = list.filter(r => r.id !== id);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
        return true;
    }
    try {
        const { error } = await supabase.from('igate_records').delete().eq('id', id);
        if (error) throw error;
        
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        let list: IGateRecord[] = stored ? JSON.parse(stored) : defaultRecords;
        list = list.filter(r => r.id !== id);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
        return true;
    } catch (e) {
        logError("deleteIGateRecordApi", e);
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        let list: IGateRecord[] = stored ? JSON.parse(stored) : defaultRecords;
        list = list.filter(r => r.id !== id);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
        return true;
    }
};

export const deleteAllIGateRecordsApi = async (): Promise<boolean> => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([]));
    if (!isConfigured) {
        return true;
    }
    try {
        const { error } = await supabase.from('igate_records').delete().neq('id', '___non_existent_id___');
        if (error) throw error;
        return true;
    } catch (e) {
        logError("deleteAllIGateRecordsApi", e);
        return true;
    }
};

export const resetIGateRecordsToDefaultApi = async (defaultRecords: IGateRecord[]): Promise<boolean> => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(defaultRecords));
    if (!isConfigured) {
        return true;
    }
    try {
        const { error: deleteError } = await supabase.from('igate_records').delete().neq('id', '___non_existent_id___');
        if (deleteError) throw deleteError;
        
        const mappedDefaults = defaultRecords.map(mapIGateToDb);
        const { error: insertError } = await supabase.from('igate_records').insert(mappedDefaults);
        if (insertError) throw insertError;
        
        return true;
    } catch (e) {
        logError("resetIGateRecordsToDefaultApi", e);
        return true;
    }
};
