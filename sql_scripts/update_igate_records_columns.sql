-- Script SQL bổ sung các cột mới vào bảng igate_records trên Supabase
-- Giúp khắc phục lỗi PGRST204 (Cột không tồn tại) khi đồng bộ hoặc lưu hàng loạt dữ liệu Excel mới.
-- Bạn có thể copy toàn bộ nội dung này và chạy trong mục "SQL Editor" trên giao diện Supabase Dashboard.

-- 1. Bổ sung cột chuyen_quyen (Chuyển quyền)
ALTER TABLE public.igate_records 
ADD COLUMN IF NOT EXISTS chuyen_quyen TEXT DEFAULT '';

-- 2. Bổ sung cột so_to (Số tờ)
ALTER TABLE public.igate_records 
ADD COLUMN IF NOT EXISTS so_to TEXT DEFAULT '';

-- 3. Bổ sung cột so_thua (Số thửa)
ALTER TABLE public.igate_records 
ADD COLUMN IF NOT EXISTS so_thua TEXT DEFAULT '';

-- 4. Bổ sung cột tong_dien_tich (Tổng diện tích) dạng số
ALTER TABLE public.igate_records 
ADD COLUMN IF NOT EXISTS tong_dien_tich NUMERIC DEFAULT NULL;

-- 5. Bổ sung cột dien_tich_dat_o (Đất ở) dạng số
ALTER TABLE public.igate_records 
ADD COLUMN IF NOT EXISTS dien_tich_dat_o NUMERIC DEFAULT NULL;

-- 6. Bổ sung cột dien_tich_dat_nong_nghiep (Đất nông nghiệp) dạng số
ALTER TABLE public.igate_records 
ADD COLUMN IF NOT EXISTS dien_tich_dat_nong_nghiep NUMERIC DEFAULT NULL;

-- 7. Bổ sung cột dia_danh (Địa danh thửa đất, địa chỉ)
ALTER TABLE public.igate_records 
ADD COLUMN IF NOT EXISTS dia_danh TEXT DEFAULT '';

-- 8. Bổ sung cột so_phat_hanh (Số phát hành GCN)
ALTER TABLE public.igate_records 
ADD COLUMN IF NOT EXISTS so_phat_hanh TEXT DEFAULT '';

-- 9. Bổ sung cột thoi_han_su_dung (Thời hạn sử dụng đất)
ALTER TABLE public.igate_records 
ADD COLUMN IF NOT EXISTS thoi_han_su_dung TEXT DEFAULT '';

-- 10. Bổ sung cột cccd (Số CCCD/CMND)
ALTER TABLE public.igate_records 
ADD COLUMN IF NOT EXISTS cccd TEXT DEFAULT '';

-- 11. Bổ sung cột ghi_chu (Ghi chú hồ sơ)
ALTER TABLE public.igate_records 
ADD COLUMN IF NOT EXISTS ghi_chu TEXT DEFAULT '';

-- Tạo chỉ mục (Index) hỗ trợ tìm kiếm nhanh hơn cho các trường hay tra cứu
CREATE INDEX IF NOT EXISTS idx_igate_records_so_to ON public.igate_records(so_to);
CREATE INDEX IF NOT EXISTS idx_igate_records_so_thua ON public.igate_records(so_thua);
CREATE INDEX IF NOT EXISTS idx_igate_records_cccd ON public.igate_records(cccd);
