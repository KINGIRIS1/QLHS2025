-- Script SQL bổ sung cột Đã thực hiện nghĩa vụ tài chính và Ngày thực hiện nghĩa vụ tài chính vào bảng igate_records trên Supabase
-- Giúp lưu trữ đồng bộ trạng thái nghĩa vụ tài chính và ngày thực tế hoàn thành trực tiếp trên Cloud database.
-- Bạn có thể sao chép nội dung này và chạy trong mục "SQL Editor" trên giao diện Supabase Dashboard.

-- 1. Bổ sung cột da_thuc_hien_nvtc (Đã thực hiện nghĩa vụ tài chính) dạng BOOLEAN, mặc định là FALSE
ALTER TABLE public.igate_records 
ADD COLUMN IF NOT EXISTS da_thuc_hien_nvtc BOOLEAN DEFAULT FALSE;

-- 2. Bổ sung cột ngay_thuc_hien_nvtc (Ngày thực hiện nghĩa vụ tài chính) dạng DATE
ALTER TABLE public.igate_records 
ADD COLUMN IF NOT EXISTS ngay_thuc_hien_nvtc DATE DEFAULT NULL;

-- 3. Tạo chỉ mục (Index) hỗ trợ truy vấn và thống kê nhanh hơn
CREATE INDEX IF NOT EXISTS idx_igate_records_da_thuc_hien_nvtc ON public.igate_records(da_thuc_hien_nvtc);
CREATE INDEX IF NOT EXISTS idx_igate_records_ngay_thuc_hien_nvtc ON public.igate_records(ngay_thuc_hien_nvtc);

-- 4. Thêm chú thích cho các trường mới
COMMENT ON COLUMN public.igate_records.da_thuc_hien_nvtc IS 'Đã thực hiện nghĩa vụ tài chính (TRUE/FALSE)';
COMMENT ON COLUMN public.igate_records.ngay_thuc_hien_nvtc IS 'Ngày thực tế người dân thực hiện nghĩa vụ tài chính';
