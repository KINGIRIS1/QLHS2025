
import { createClient } from '@supabase/supabase-js';

// =========================================================================
// CẤU HÌNH MÁY CHỦ RIÊNG (SELF-HOSTED / CLOUDFLARE TUNNEL):
// Mặc định kết nối tới máy chủ cá nhân: https://api.qlhsct.info.vn
// =========================================================================

// Cho phép nạp cấu hình tùy chỉnh từ localStorage (nếu có) hoặc dùng mặc định
const getSavedUrl = () => {
    if (typeof window !== 'undefined') {
        const customUrl = localStorage.getItem('CUSTOM_SUPABASE_URL');
        if (customUrl && customUrl.trim()) return customUrl.trim();
    }
    return 'https://api.qlhsct.info.vn';
};

const getSavedKey = () => {
    if (typeof window !== 'undefined') {
        const customKey = localStorage.getItem('CUSTOM_SUPABASE_KEY');
        if (customKey && customKey.trim()) return customKey.trim();
    }
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';
};

// --- CẤU HÌNH KẾT NỐI SERVER ---
export const SUPABASE_URL: string = getSavedUrl(); 
export const SUPABASE_ANON_KEY: string = getSavedKey();

// Kiểm tra kỹ điều kiện cấu hình
const isEmpty = !SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.trim() === '' || SUPABASE_ANON_KEY.trim() === '';
// Kiểm tra nếu là placeholder (chỉ cảnh báo nếu thực sự chưa thay đổi)
const isUrlPlaceholder = SUPABASE_URL.includes('YOUR_PROJECT_ID');
const isKeyPlaceholder = SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY');

export const isConfigured = !isEmpty && !isUrlPlaceholder && !isKeyPlaceholder;

if (!isConfigured) {
    console.warn("⚠️ CHƯA CẤU HÌNH SUPABASE: Ứng dụng sẽ chạy ở chế độ Demo (Offline) với dữ liệu mẫu.");
} else {
    console.log(`✅ Đã phát hiện cấu hình Cloud. Đang kết nối tới: ${SUPABASE_URL}`);
}

// Sử dụng thông tin placeholder hợp lệ để tránh lỗi crash khi khởi tạo createClient nếu người dùng lỡ xóa trắng biến
const urlToUse = isConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co';
const keyToUse = isConfigured ? SUPABASE_ANON_KEY : 'placeholder';

export const supabase = createClient(urlToUse, keyToUse, {
    auth: {
        persistSession: true, // Giữ đăng nhập khi F5
        autoRefreshToken: true,
    },
    db: {
        schema: 'public',
    }
});

// Single shared channel for online presence
export const presenceChannel = supabase.channel('online_users', {
    config: {
        broadcast: {
            self: true
        }
    }
});

let isPresenceSubscribed = false;
let globalPresenceStatus = 'CLOSED';
export let globalPresenceState: any = {};

// Register global broadcast listener here
presenceChannel.on('broadcast', { event: 'force_update' }, (payload) => {
    window.dispatchEvent(new CustomEvent('system_update_available_broadcast', { detail: payload }));
});

// Register presence listener BEFORE subscribing
presenceChannel.on('presence', { event: 'sync' }, () => {
    globalPresenceState = presenceChannel.presenceState();
    console.log("[DEBUG] Presence sync", globalPresenceState);
    window.dispatchEvent(new CustomEvent('presence_state_changed'));
});

if (typeof window !== 'undefined' && isConfigured) {
    presenceChannel.subscribe((status) => {
        globalPresenceStatus = status;
        console.log("[DEBUG] global presenceChannel status:", status);
    });
    isPresenceSubscribed = true;

    // Lắng nghe sự thay đổi của bảng system_settings để ép hiện popup ngay lập tức
    supabase.channel('system_settings_changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'system_settings' },
            (payload: any) => {
                const row = payload.new;
                if (row) {
                    if (row.key === 'app_version') {
                        console.log("[DEBUG] app_version changed in DB", row);
                        // Bắn event để hook useAppData gọi fetchUpdateInfo() và hiện popup ngay
                        window.dispatchEvent(new CustomEvent('system_update_available'));
                    } else if (row.key === 'contact_settings_v2') {
                        console.log("[DEBUG] contact_settings_v2 changed in DB", row);
                        window.dispatchEvent(new CustomEvent('contact_settings_changed', { detail: row.value }));
                    } else if (row.key === 'contract_signer_settings_v1') {
                        console.log("[DEBUG] contract_signer_settings_v1 changed in DB", row);
                        window.dispatchEvent(new CustomEvent('contract_signer_settings_changed', { detail: row.value }));
                    } else if (row.key === 'weather_location') {
                        console.log("[DEBUG] weather_location changed in DB", row);
                        try {
                            window.dispatchEvent(new CustomEvent('weather_location_changed', { detail: JSON.parse(row.value) }));
                        } catch (e) {
                            console.error("Lỗi parse weather_location realtime:", e);
                        }
                    }
                }
            }
        )
        .subscribe();
}

export const trackPresence = async (user: any, version: string) => {
    if (!user) return;
    
    // Function to actually track
    const doTrack = async () => {
        try {
            await presenceChannel.track({
                username: user.username,
                name: user.name,
                version: version,
                onlineAt: new Date().toISOString()
            });
            console.log("[DEBUG] tracked presence success");
        } catch (e) {
            console.error('Error tracking presence', e);
        }
    };

    if (globalPresenceStatus === 'SUBSCRIBED') {
        await doTrack();
    } else {
        // Poll for subscription status
        const checkInterval = setInterval(async () => {
            if (globalPresenceStatus === 'SUBSCRIBED') {
                clearInterval(checkInterval);
                await doTrack();
            }
        }, 500);
        
        // Safety timeout
        setTimeout(() => {
            clearInterval(checkInterval);
            if (globalPresenceStatus !== 'SUBSCRIBED') {
                 console.log("[DEBUG] Force tracking presence after timeout");
                 doTrack();
            }
        }, 8000);
    }
};
