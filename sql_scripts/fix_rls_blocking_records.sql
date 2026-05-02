-- Vui lòng chạy lệnh SQL này trong Supabase Dashboard -> SQL Editor để cấp quyền truy cập bảng blocking_records

ALTER TABLE blocking_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cho phép tất cả" ON blocking_records FOR ALL USING (true);
