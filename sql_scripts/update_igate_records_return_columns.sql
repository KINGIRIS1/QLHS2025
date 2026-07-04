-- Script SQL bổ sung các cột mới phục vụ chức năng "Hồ sơ trả" và "Ngày trả hồ sơ"
-- áp dụng cho bảng `igate_records` trên cơ sở dữ liệu Supabase.
-- Bạn có thể copy toàn bộ nội dung script này và chạy trực tiếp trong phần "SQL Editor" trên trang quản trị của Supabase Dashboard.

-- 1. Bổ sung cột ngay_tra (Ngày trả hồ sơ) kiểu dữ liệu DATE
ALTER TABLE public.igate_records 
ADD COLUMN IF NOT EXISTS ngay_tra DATE DEFAULT NULL;

-- 2. Bổ sung cột ly_do_tra (Lý do trả hồ sơ) kiểu dữ liệu TEXT
ALTER TABLE public.igate_records 
ADD COLUMN IF NOT EXISTS ly_do_tra TEXT DEFAULT '';

-- 3. Tạo chỉ mục hỗ trợ truy vấn, sắp xếp và lọc nhanh hơn theo ngày trả hồ sơ
CREATE INDEX IF NOT EXISTS idx_igate_records_ngay_tra ON public.igate_records(ngay_tra);

-- Thông báo chạy thành công
COMMENT ON COLUMN public.igate_records.ngay_tra IS 'Ngày trả hồ sơ iGate thực tế';
COMMENT ON COLUMN public.igate_records.ly_do_tra IS 'Lý do trả hồ sơ iGate';
