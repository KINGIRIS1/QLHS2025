
import { supabase, isConfigured } from './supabaseClient';
import { Holiday } from '../types';
import { logError, getFromCache, saveToCache, CACHE_KEYS } from './apiCore';

export const testDatabaseConnection = async (): Promise<{ status: string, message: string }> => {
    if (!isConfigured) {
        return { status: 'OFFLINE', message: 'Hệ thống chưa nhận diện được URL hoặc Key của Supabase.' };
    }
    try {
        const { data, error } = await supabase
            .from('users')
            .select('count')
            .limit(1)
            .maybeSingle();

        if (error) {
            if (error.code === '42P01') return { status: 'ERROR', message: 'Lỗi 42P01: Bảng dữ liệu chưa tồn tại. Hãy chạy mã SQL trong nút "Xem mã SQL".' };
            if (error.message.includes('FetchError')) return { status: 'ERROR', message: 'Lỗi mạng: Không thể kết nối tới URL Supabase. Kiểm tra lại đường dẫn.' };
            if (error.code === 'PGRST301') return { status: 'ERROR', message: 'Lỗi quyền (JWT): Key không hợp lệ hoặc đã hết hạn.' };
            return { status: 'ERROR', message: `Lỗi Supabase: ${error.message} (Code: ${error.code})` };
        }
        
        return { status: 'SUCCESS', message: 'Kết nối thành công! Đã đọc được dữ liệu từ Supabase.' };

    } catch (e: any) {
        return { status: 'ERROR', message: `Lỗi ngoại lệ: ${e.message}` };
    }
};

export const fetchUpdateInfo = async (): Promise<{ version: string | null, url: string | null }> => {
    if (!isConfigured) return { version: null, url: null };
    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('key, value')
            .in('key', ['app_version', 'app_update_url']);
            
        if (error) throw error;
        
        let version = null;
        let url = null;

        if (data) {
            data.forEach((item: any) => {
                if (item.key === 'app_version') version = item.value;
                if (item.key === 'app_update_url') url = item.value;
            });
        }
        return { version, url };
    } catch (e: any) {
        if (e?.code === '42P01') return { version: null, url: null };
        logError("fetchUpdateInfo", e);
        return { version: null, url: null };
    }
};

export const fetchLatestVersion = async (): Promise<string | null> => {
    const info = await fetchUpdateInfo();
    return info.version;
};

export const saveUpdateInfo = async (version: string, url: string): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        const updates = [
            { key: 'app_version', value: version },
            { key: 'app_update_url', value: url }
        ];
        const { error } = await supabase.from('system_settings').upsert(updates);
        if (error) throw error;
        return true;
    } catch (e) {
        logError("saveUpdateInfo", e);
        return false;
    }
};

export const getSystemSetting = async (key: string): Promise<string | null> => {
    if (!isConfigured) return null;
    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', key)
            .single();
        if (error) throw error;
        return data?.value || null;
    } catch (error) {
        return null;
    }
};

export const saveSystemSetting = async (key: string, value: string): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        const { error } = await supabase
            .from('system_settings')
            .upsert({ key, value });
        if (error) throw error;
        return true;
    } catch (error) {
        logError("saveSystemSetting", error);
        return false;
    }
};

export const deleteSystemSetting = async (key: string): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        const { error } = await supabase
            .from('system_settings')
            .delete()
            .eq('key', key);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("deleteSystemSetting", error);
        return false;
    }
};

export const updateLatestVersion = async (version: string): Promise<boolean> => {
    return saveUpdateInfo(version, ''); 
};

// --- HOLIDAYS ---
export const fetchHolidays = async (): Promise<Holiday[]> => {
    if (!isConfigured) return getFromCache(CACHE_KEYS.HOLIDAYS, []);
    try {
        const { data, error } = await supabase.from('holidays').select('*');
        if (error) throw error;
        
        const mapped = data.map((h: any) => ({
            id: h.id,
            name: h.name,
            day: h.day,
            month: h.month,
            isLunar: h.is_lunar // Map từ snake_case (DB) sang camelCase (App)
        }));
        saveToCache(CACHE_KEYS.HOLIDAYS, mapped);
        return mapped;
    } catch (error) {
        logError("fetchHolidays", error);
        return getFromCache(CACHE_KEYS.HOLIDAYS, []);
    }
};

export const saveHolidays = async (holidays: Holiday[]): Promise<boolean> => {
    if (!isConfigured) return true;
    try {
        // Xóa hết dữ liệu cũ trước khi insert mới
        // Lưu ý: Cần chắc chắn bảng holidays có ít nhất 1 dòng dummy với id='0' nếu dùng .neq('id', '0')
        // Hoặc xóa toàn bộ nếu không có dòng nào cần giữ. Ở đây ta xóa hết để sync chính xác.
        await supabase.from('holidays').delete().neq('id', 'dummy_id_prevent_error'); 
        
        const dbHolidays = holidays.map(h => ({
            id: h.id,
            name: h.name,
            day: h.day,
            month: h.month,
            is_lunar: h.isLunar // Map từ camelCase (App) sang snake_case (DB)
        }));
        
        const { error } = await supabase.from('holidays').insert(dbHolidays);
        if (error) throw error;
        return true;
    } catch (error) {
        logError("saveHolidays", error);
        return false;
    }
};

export const deleteAllDataApi = async (): Promise<boolean> => {
    if (!isConfigured) return false;
    try {
        // Thực hiện xóa dữ liệu trên các bảng nghiệp vụ
        // Sử dụng neq('id', '0') để xóa tất cả các dòng
        
        const { error: err1 } = await supabase.from('records').delete().neq('id', '0'); 
        if (err1) throw err1;

        const { error: err2 } = await supabase.from('contracts').delete().neq('id', '0');
        if (err2) throw err2;

        const { error: err3 } = await supabase.from('excerpt_history').delete().neq('id', '0');
        if (err3) throw err3;

        const { error: err4 } = await supabase.from('messages').delete().neq('id', '0');
        if (err4) throw err4;

        // Xóa cả bộ đếm trích lục (nếu cần reset số thứ tự)
        const { error: err5 } = await supabase.from('excerpt_counters').delete().neq('ward', '0');
        if (err5) throw err5;

        // Lưu ý: Không xóa Users và Employees và SystemSettings để đảm bảo hệ thống vẫn đăng nhập được
        return true;
    } catch (error) {
        logError("deleteAllDataApi", error);
        return false;
    }
};

export interface ContactSettings {
  ward_minhhung: string;
  ward_nhabich: string;
  ward_chonthanh: string;
  type_saoluc: string;
  type_thue: string;
}

export const DEFAULT_CONTACT_SETTINGS: ContactSettings = {
  ward_minhhung: "Nhân viên phụ trách Nguyễn Thìn Trung: 0886 385 757",
  ward_nhabich: "Nhân viên phụ trách Lê Văn Hạnh: 0919 334 344",
  ward_chonthanh: "Nhân viên phụ trách Phạm Hoài Sơn: 0972 219 691",
  type_saoluc: "Nhân viên phụ trách Hoàng Anh Thanh: 0961 239 393",
  type_thue: "Nhân viên phụ trách [Tên phụ trách]: [Số điện thoại]"
};

// Global in-memory cache to make lookups synchronous and lightning-fast!
let cachedContactSettings: ContactSettings | null = null;

if (typeof window !== 'undefined') {
    window.addEventListener('contact_settings_changed', (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail) {
            try {
                const parsed = typeof detail === 'string' ? JSON.parse(detail) : detail;
                cachedContactSettings = {
                    ...DEFAULT_CONTACT_SETTINGS,
                    ...parsed
                };
                localStorage.setItem('contact_settings_v2', typeof detail === 'string' ? detail : JSON.stringify(detail));
                window.dispatchEvent(new CustomEvent('contact_settings_cache_updated'));
                console.log("[DEBUG] Realtime updated contact settings cache", cachedContactSettings);
            } catch (err) {
                console.error("Error updating contact settings cache via realtime", err);
            }
        }
    });
}

export const fetchContactSettingsCached = async (): Promise<ContactSettings> => {
    if (cachedContactSettings) return cachedContactSettings;
    const settings = await fetchContactSettings();
    cachedContactSettings = settings;
    return settings;
};

export const fetchContactSettings = async (): Promise<ContactSettings> => {
    try {
        const value = await getSystemSetting('contact_settings_v2');
        if (value) {
            const parsed = JSON.parse(value);
            return {
                ...DEFAULT_CONTACT_SETTINGS,
                ...parsed
            };
        }
    } catch (e) {
        logError("fetchContactSettings", e);
    }
    // Also try local storage as fallback
    try {
        const local = localStorage.getItem('contact_settings_v2');
        if (local) {
            return {
                ...DEFAULT_CONTACT_SETTINGS,
                ...JSON.parse(local)
            };
        }
    } catch (_) {}
    return DEFAULT_CONTACT_SETTINGS;
};

export const saveContactSettings = async (settings: ContactSettings): Promise<boolean> => {
    cachedContactSettings = settings;
    const value = JSON.stringify(settings);
    // Save to local storage as redundant copy
    try {
        localStorage.setItem('contact_settings_v2', value);
    } catch (_) {}
    
    if (!isConfigured) return true;
    return await saveSystemSetting('contact_settings_v2', value);
};

export const getContactInfo = (settings: ContactSettings, ward: string, type: string): string => {
    const tLower = (type || "").toLowerCase();
    
    // Check type-specific settings first
    if (tLower.includes("sao lục") || tLower.includes("saoluc")) {
        return settings.type_saoluc || DEFAULT_CONTACT_SETTINGS.type_saoluc;
    }
    if (tLower.includes("thuế") || tLower.includes("thue")) {
        return settings.type_thue || DEFAULT_CONTACT_SETTINGS.type_thue;
    }
    
    // Fallback to ward-specific settings
    const wLower = (ward || "").toLowerCase();
    if (wLower.includes("minh hưng") || wLower.includes("minh hung")) {
        return settings.ward_minhhung || DEFAULT_CONTACT_SETTINGS.ward_minhhung;
    }
    if (wLower.includes("nha bích") || wLower.includes("nha bich")) {
        return settings.ward_nhabich || DEFAULT_CONTACT_SETTINGS.ward_nhabich;
    }
    if (wLower.includes("chơn thành") || wLower.includes("chon thanh")) {
        return settings.ward_chonthanh || DEFAULT_CONTACT_SETTINGS.ward_chonthanh;
    }
    
    return "";
};

