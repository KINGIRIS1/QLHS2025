
import { createClient } from '@supabase/supabase-js';

// =========================================================================
// HƯỚNG DẪN CẤU HÌNH (QUAN TRỌNG):
// 1. Vào trang https://supabase.com/dashboard/project/_/settings/api
// 2. Copy "Project URL" và dán vào biến SUPABASE_URL bên dưới.
// 3. Copy "anon public" Key và dán vào biến SUPABASE_ANON_KEY bên dưới.
// =========================================================================

// THAY THẾ 2 DÒNG DƯỚI ĐÂY BẰNG THÔNG TIN CỦA BẠN:
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co'; 
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// Kiểm tra xem người dùng đã cấu hình chưa
export const isConfigured = !SUPABASE_URL.includes('YOUR_PROJECT_ID') && !SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY');

if (!isConfigured) {
    console.warn("⚠️ CHƯA CẤU HÌNH SUPABASE: Ứng dụng sẽ chạy ở chế độ Demo (Offline) với dữ liệu mẫu.");
}

// Khởi tạo client (vẫn tạo object nhưng sẽ không gọi lệnh mạng nếu ta chặn ở api.ts)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
