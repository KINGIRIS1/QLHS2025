
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
        
        const mapped: Holiday[] = (data || []).map((h: any) => ({
            id: String(h.id),
            name: h.name || '',
            day: Number(h.day) || 1,
            month: Number(h.month) || 1,
            isLunar: Boolean(h.isLunar !== undefined ? h.isLunar : (h.is_lunar !== undefined ? h.is_lunar : false))
        }));
        saveToCache(CACHE_KEYS.HOLIDAYS, mapped);
        return mapped;
    } catch (error) {
        logError("fetchHolidays", error);
        return getFromCache(CACHE_KEYS.HOLIDAYS, []);
    }
};

export const saveHolidays = async (holidays: Holiday[]): Promise<boolean> => {
    // Luôn lưu ngay vào cache và localStorage để thiết bị hiện tại & chế độ offline nhận dữ liệu mới tức thì
    saveToCache(CACHE_KEYS.HOLIDAYS, holidays);

    if (!isConfigured) {
        window.dispatchEvent(new CustomEvent('holidays_realtime_update', { detail: holidays }));
        return true;
    }

    try {
        // Xóa hết dữ liệu cũ trước khi insert mới để sync chính xác
        await supabase.from('holidays').delete().neq('id', 'dummy_id_never_match_xyz'); 
        
        if (holidays.length > 0) {
            // Chuẩn bị dữ liệu insert hỗ trợ cả schema 'isLunar' và 'is_lunar'
            const holidaysData = holidays.map(h => ({
                id: String(h.id || (Date.now() + '_' + Math.random().toString(36).substring(2, 7))),
                name: h.name || '',
                day: Number(h.day) || 1,
                month: Number(h.month) || 1,
                isLunar: Boolean(h.isLunar)
            }));
            
            let { error: insertError } = await supabase.from('holidays').insert(holidaysData);
            
            // Fallback nếu schema trong DB dùng snake_case 'is_lunar'
            if (insertError) {
                console.warn("Thử lại insert holidays với is_lunar (snake_case):", insertError);
                const snakeHolidaysData = holidays.map(h => ({
                    id: String(h.id || (Date.now() + '_' + Math.random().toString(36).substring(2, 7))),
                    name: h.name || '',
                    day: Number(h.day) || 1,
                    month: Number(h.month) || 1,
                    is_lunar: Boolean(h.isLunar)
                }));
                const retryRes = await supabase.from('holidays').insert(snakeHolidaysData);
                if (retryRes.error) throw retryRes.error;
            }
        }

        // Phát tín hiệu Broadcast cho toàn bộ bản EXE và Web đang chạy của các cán bộ khác
        try {
            const channel = supabase.channel('system_broadcast');
            await channel.send({
                type: 'broadcast',
                event: 'holidays_updated',
                payload: { holidays, timestamp: Date.now() }
            });
        } catch (bErr) {
            console.warn("Không thể gửi realtime broadcast ngày nghỉ lễ:", bErr);
        }

        // Phát event cập nhật cục bộ cho máy này
        window.dispatchEvent(new CustomEvent('holidays_realtime_update', { detail: holidays }));
        return true;
    } catch (error) {
        logError("saveHolidays", error);
        return false;
    }
};

export const initRealtimeHolidays = () => {
    if (!isConfigured) return;

    // 1. Lắng nghe thay đổi trực tiếp từ bảng holidays (postgres_changes)
    supabase.channel('public:holidays')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'holidays' }, async () => {
            console.log("[REALTIME] Phát hiện thay đổi ngày nghỉ lễ từ Cloud, đang đồng bộ...");
            const freshHolidays = await fetchHolidays();
            window.dispatchEvent(new CustomEvent('holidays_realtime_update', { detail: freshHolidays }));
        })
        .subscribe();

    // 2. Lắng nghe qua kênh broadcast (dành cho client EXE / Web tức thì)
    supabase.channel('system_broadcast')
        .on('broadcast', { event: 'holidays_updated' }, async (event: any) => {
            console.log("[BROADCAST] Nhận thông báo cập nhật ngày nghỉ lễ, đang nạp lại...", event);
            if (event?.payload?.holidays && Array.isArray(event.payload.holidays)) {
                saveToCache(CACHE_KEYS.HOLIDAYS, event.payload.holidays);
                window.dispatchEvent(new CustomEvent('holidays_realtime_update', { detail: event.payload.holidays }));
            } else {
                const freshHolidays = await fetchHolidays();
                window.dispatchEvent(new CustomEvent('holidays_realtime_update', { detail: freshHolidays }));
            }
        })
        .subscribe();
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
  type_hiendat?: string;
  type_thamdinh?: string;
}

export const DEFAULT_CONTACT_SETTINGS: ContactSettings = {
  ward_minhhung: "Nhân viên phụ trách Nguyễn Thìn Trung: 0886 385 757",
  ward_nhabich: "Nhân viên phụ trách Lê Văn Hạnh: 0919 334 344",
  ward_chonthanh: "Nhân viên phụ trách Phạm Hoài Sơn: 0972 219 691",
  type_saoluc: "Nhân viên phụ trách Hoàng Anh Thanh: 0961 239 393",
  type_thue: "Nhân viên phụ trách [Tên phụ trách]: [Số điện thoại]",
  type_hiendat: "Nhân viên phụ trách [Tên phụ trách]: [Số điện thoại]",
  type_thamdinh: "Nhân viên phụ trách [Tên phụ trách]: [Số điện thoại]"
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
    if (tLower.includes("thẩm định") || tLower.includes("tham dinh")) {
        return settings.type_thamdinh || DEFAULT_CONTACT_SETTINGS.type_thamdinh || "";
    }
    if (tLower.includes("hiến đất") || tLower.includes("hien dat")) {
        return settings.type_hiendat || DEFAULT_CONTACT_SETTINGS.type_hiendat || "";
    }
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

// ==========================================
// CẤU HÌNH NGƯỜI KÝ HỢP ĐỒNG BÊN B THEO XÃ/PHƯỜNG
// ==========================================

export interface WardSignerConfig {
  id: string;
  wardName: string;      // Tên hoặc từ khóa xã/phường (VD: "Phường Minh Hưng", "Xã Nha Bích", "Phường Chơn Thành")
  signerName: string;    // Họ và tên người ký (VD: "TRỊNH QUANG HƯNG")
  signerPosition: string;// Chức vụ người ký (VD: "PHÓ GIÁM ĐỐC")
}

export interface ContractSignerSettings {
  defaultSignerName: string;     // VD: "PHẠM VĂN NAM"
  defaultSignerPosition: string; // VD: "PHÓ GIÁM ĐỐC"
  wardSigners: WardSignerConfig[];
}

export const DEFAULT_CONTRACT_SIGNER_SETTINGS: ContractSignerSettings = {
  defaultSignerName: "PHẠM VĂN NAM",
  defaultSignerPosition: "PHÓ GIÁM ĐỐC",
  wardSigners: [
    {
      id: "1",
      wardName: "Phường Minh Hưng",
      signerName: "TRỊNH QUANG HƯNG",
      signerPosition: "PHÓ GIÁM ĐỐC"
    },
    {
      id: "2",
      wardName: "Xã Nha Bích",
      signerName: "LƯƠNG NGỌC DINH",
      signerPosition: "GIÁM ĐỐC"
    },
    {
      id: "3",
      wardName: "Phường Chơn Thành",
      signerName: "PHẠM VĂN NAM",
      signerPosition: "PHÓ GIÁM ĐỐC"
    }
  ]
};

let cachedContractSignerSettings: ContractSignerSettings | null = null;

function normalizeString(s: string): string {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

if (typeof window !== 'undefined') {
    window.addEventListener('contract_signer_settings_changed', (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail) {
            try {
                const parsed = typeof detail === 'string' ? JSON.parse(detail) : detail;
                cachedContractSignerSettings = {
                    ...DEFAULT_CONTRACT_SIGNER_SETTINGS,
                    ...parsed
                };
                localStorage.setItem('contract_signer_settings_v1', typeof detail === 'string' ? detail : JSON.stringify(detail));
                window.dispatchEvent(new CustomEvent('contract_signer_settings_cache_updated'));
                console.log("[DEBUG] Realtime updated contract signer settings cache", cachedContractSignerSettings);
            } catch (err) {
                console.error("Error updating contract signer settings cache via realtime", err);
            }
        }
    });
}

export const fetchContractSignerSettingsCached = async (): Promise<ContractSignerSettings> => {
    if (cachedContractSignerSettings) return cachedContractSignerSettings;
    const settings = await fetchContractSignerSettings();
    cachedContractSignerSettings = settings;
    return settings;
};

export const fetchContractSignerSettings = async (): Promise<ContractSignerSettings> => {
    try {
        const value = await getSystemSetting('contract_signer_settings_v1');
        if (value) {
            const parsed = JSON.parse(value);
            return {
                ...DEFAULT_CONTRACT_SIGNER_SETTINGS,
                ...parsed
            };
        }
    } catch (e) {
        logError("fetchContractSignerSettings", e);
    }
    // Fallback to local storage
    try {
        const local = localStorage.getItem('contract_signer_settings_v1');
        if (local) {
            return {
                ...DEFAULT_CONTRACT_SIGNER_SETTINGS,
                ...JSON.parse(local)
            };
        }
    } catch (_) {}
    return DEFAULT_CONTRACT_SIGNER_SETTINGS;
};

export const saveContractSignerSettings = async (settings: ContractSignerSettings): Promise<boolean> => {
    cachedContractSignerSettings = settings;
    const value = JSON.stringify(settings);
    try {
        localStorage.setItem('contract_signer_settings_v1', value);
    } catch (_) {}
    
    if (!isConfigured) return true;
    return await saveSystemSetting('contract_signer_settings_v1', value);
};

export const getContractSignerInfo = (
  settings: ContractSignerSettings,
  ward: string
): { name: string; position: string } => {
    const defaultName = settings.defaultSignerName || DEFAULT_CONTRACT_SIGNER_SETTINGS.defaultSignerName;
    const defaultPosition = settings.defaultSignerPosition || DEFAULT_CONTRACT_SIGNER_SETTINGS.defaultSignerPosition;

    if (!ward) {
        return { name: defaultName, position: defaultPosition };
    }

    const normWard = normalizeString(ward);
    if (!normWard) return { name: defaultName, position: defaultPosition };

    const wardList = settings.wardSigners || DEFAULT_CONTRACT_SIGNER_SETTINGS.wardSigners;
    
    for (const item of wardList) {
        if (!item.wardName) continue;
        const normItemWard = normalizeString(item.wardName);
        if (normItemWard && (normWard.includes(normItemWard) || normItemWard.includes(normWard))) {
            return {
                name: item.signerName || defaultName,
                position: item.signerPosition || defaultPosition
            };
        }
    }

    return { name: defaultName, position: defaultPosition };
};


