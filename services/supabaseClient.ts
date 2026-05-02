
import { createClient } from '@supabase/supabase-js';

// =========================================================================
// HƯỚNG DẪN CẤU HÌNH GÓI PRO (QUAN TRỌNG):
// 1. Vào trang https://supabase.com/dashboard/project/_/settings/api
// 2. Copy "Project URL" và dán vào biến SUPABASE_URL bên dưới.
// 3. Copy "anon public" Key và dán vào biến SUPABASE_ANON_KEY bên dưới.
// LƯU Ý: Nếu bạn vừa tạo Project mới cho gói Pro, BẮT BUỘC phải thay đổi 2 dòng này.
// =========================================================================

// --- CẤU HÌNH KẾT NỐI CLOUD ---
const SUPABASE_URL: string = 'https://dajjhubrhybodggbqapt.supabase.co'; 
const SUPABASE_ANON_KEY: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhampodWJyaHlib2RnZ2JxYXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NzM3MDUsImV4cCI6MjA4MDM0OTcwNX0.Te4JGaR7DnSiejugyZHV0_uQSWsG_TS_xTmRgxgM5-4';

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
    console.log("[DEBUG] Global broadcast received", payload);
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
                if (row && row.key === 'app_version') {
                    console.log("[DEBUG] app_version changed in DB", row);
                    // Bắn event để hook useAppData gọi fetchUpdateInfo() và hiện popup ngay
                    window.dispatchEvent(new CustomEvent('system_update_available'));
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
