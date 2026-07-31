-- ============================================================================
-- BẢNG LƯU TRỮ HỒ SƠ / VĂN BẢN GIẤY MỜI (giaymoi_records)
-- Hỗ trợ lưu trữ thông tin Giấy mời đo đạc, xác minh hiện trạng sử dụng đất
-- ============================================================================

-- 1. Tạo bảng giaymoi_records nếu chưa tồn tại
CREATE TABLE IF NOT EXISTS public.giaymoi_records (
    id VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_by VARCHAR(100) DEFAULT '' NOT NULL,
    customer_name VARCHAR(255) DEFAULT '' NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 2. Tạo các chỉ mục (Indexes) để tối ưu hóa truy vấn và tìm kiếm
CREATE INDEX IF NOT EXISTS idx_giaymoi_records_created_at ON public.giaymoi_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_giaymoi_records_customer_name ON public.giaymoi_records(customer_name);
CREATE INDEX IF NOT EXISTS idx_giaymoi_records_created_by ON public.giaymoi_records(created_by);

-- 3. Cấu hình Row Level Security (RLS)
ALTER TABLE public.giaymoi_records ENABLE ROW LEVEL SECURITY;

-- Tạo Policy cho phép người dùng truy vấn, thêm, sửa, xóa
DROP POLICY IF EXISTS "Cho phép tất cả thao tác trên giaymoi_records" ON public.giaymoi_records;
CREATE POLICY "Cho phép tất cả thao tác trên giaymoi_records" 
ON public.giaymoi_records 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 4. Chú thích cho bảng và các cột (Table & Column Comments)
COMMENT ON TABLE public.giaymoi_records IS 'Bảng lưu trữ thông tin các Giấy mời đã được tạo và lưu trong hệ thống';
COMMENT ON COLUMN public.giaymoi_records.id IS 'Khóa chính, mã định danh duy nhất của bản ghi giấy mời (VD: gm_1722230400000_abc12)';
COMMENT ON COLUMN public.giaymoi_records.created_at IS 'Thời điểm tạo bản ghi giấy mời';
COMMENT ON COLUMN public.giaymoi_records.created_by IS 'Tên cán bộ thực hiện tạo/lưu giấy mời';
COMMENT ON COLUMN public.giaymoi_records.customer_name IS 'Tên chủ sử dụng đất hoặc đại diện đối tượng kính mời chính';
COMMENT ON COLUMN public.giaymoi_records.data IS 'Chứa toàn bộ dữ liệu mẫu giấy mời dưới dạng JSONB (số giấy mời, ngày tháng, danh sách kính mời, nội dung, thời gian, địa điểm, v.v.)';
