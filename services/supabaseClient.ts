
import { createClient } from '@supabase/supabase-js';

// =========================================================================
// HƯỚNG DẪN CẤU HÌNH (QUAN TRỌNG):
// 1. Vào trang https://supabase.com/dashboard/project/_/settings/api
// 2. Copy "Project URL" và dán vào biến SUPABASE_URL bên dưới.
// 3. Copy "anon public" Key và dán vào biến SUPABASE_ANON_KEY bên dưới.
// =========================================================================

// THAY THẾ 2 DÒNG DƯỚI ĐÂY BẰNG THÔNG TIN CỦA BẠN:
const SUPABASE_URL: string = 'https://dajjhubrhybodggbqapt.supabase.co'; 
const SUPABASE_ANON_KEY: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhampodWJyaHlib2RnZ2JxYXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NzM3MDUsImV4cCI6MjA4MDM0OTcwNX0.Te4JGaR7DnSiejugyZHV0_uQSWsG_TS_xTmRgxgM5-4';

// Kiểm tra kỹ điều kiện cấu hình
const isUrlDefault = SUPABASE_URL.includes('YOUR_PROJECT_ID');
const isKeyDefault = SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY');
const isEmpty = !SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL === '' || SUPABASE_ANON_KEY === '';

export const isConfigured = !isUrlDefault && !isKeyDefault && !isEmpty;

if (!isConfigured) {
    console.warn("⚠️ CHƯA CẤU HÌNH SUPABASE: Ứng dụng sẽ chạy ở chế độ Demo (Offline) với dữ liệu mẫu.");
}

// Sử dụng thông tin placeholder hợp lệ để tránh lỗi crash khi khởi tạo createClient nếu người dùng lỡ xóa trắng biến
const urlToUse = isConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co';
const keyToUse = isConfigured ? SUPABASE_ANON_KEY : 'placeholder';

export const supabase = createClient(urlToUse, keyToUse);
