-- 1. Tạo bảng lưu trữ hồ sơ iGate riêng biệt không liên quan đến dữ liệu đăng ký
CREATE TABLE IF NOT EXISTS igate_records (
    id TEXT PRIMARY KEY,
    so_hieu TEXT NOT NULL,
    ten_thu_tuc TEXT,
    ten_linh_vuc TEXT,
    ngay_tiep_nhan DATE,
    ngay_hen_tra DATE,
    ngay_ket_thuc DATE,
    don_vi TEXT,
    chu_ho_so TEXT NOT NULL,
    so_dien_thoai TEXT,
    can_bo_xu_ly TEXT,
    trang_thai TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

-- 2. Bật bảo mật Row Level Security (RLS)
ALTER TABLE igate_records ENABLE ROW LEVEL SECURITY;

-- 3. Tạo chính sách bảo mật cho phép mọi thao tác truy vấn và chỉnh sửa (hoặc theo quyền của dự án)
DROP POLICY IF EXISTS "Cho phép tất cả thao tác trên igate_records" ON igate_records;
CREATE POLICY "Cho phép tất cả thao tác trên igate_records" 
ON igate_records FOR ALL 
USING (true) 
WITH CHECK (true);

-- 4. Chèn dữ liệu mẫu ban đầu để hiển thị ngay khi hệ thống mới khởi chạy
INSERT INTO igate_records (id, so_hieu, ten_thu_tuc, ten_linh_vuc, ngay_tiep_nhan, ngay_hen_tra, ngay_ket_thuc, don_vi, chu_ho_so, so_dien_thoai, can_bo_xu_ly, trang_thai)
VALUES 
('ig-1', 'HSPT-2026-00342', 'Đăng ký biến động quyền sử dụng đất, quyền sở hữu tài sản gắn liền với đất do thay đổi thông tin về chủ sở hữu', 'Đất đai', '2026-05-15', '2026-05-25', NULL, 'Chi nhánh Văn phòng Đăng ký Đất đai', 'Nguyễn Văn Hùng', '0912345678', 'Lê Thị Thu', 'Mới tiếp nhận'),
('ig-2', 'HSPT-2026-00215', 'Chuyển nhượng quyền sử dụng đất và tài sản gắn liền với đất', 'Đất đai', '2026-04-10', '2026-04-24', NULL, 'Chi nhánh Văn phòng Đăng ký Đất đai', 'Trần Thị Lan', '0987654321', 'Nguyễn Văn Nam', 'Đã phát hành thông báo thuế'),
('ig-3', 'HSPT-2026-00104', 'Cấp đổi Giấy chứng nhận quyền sử dụng đất, quyền sở hữu nhà ở và tài sản khác gắn liền với đất', 'Đất đai', '2026-02-05', '2026-02-20', NULL, 'Chi nhánh Văn phòng Đăng ký Đất đai', 'Phạm Minh Đức', '0905112233', 'Lê Tiến Anh', 'Chờ thực hiện nghĩa vụ tài chính'),
('ig-4', 'HSPT-2026-00561', 'Tặng cho quyền sử dụng đất và tài sản gắn liền với đất', 'Đất đai', '2026-05-22', '2026-06-05', NULL, 'Chi nhánh Văn phòng Đăng ký Đất đai', 'Hoàng Minh Tuấn', '0977889900', 'Võ Văn Kiệt', 'Đã chuyển thông tin thuế'),
('ig-5', 'HSPT-2026-00412', 'Thế chấp quyền sử dụng đất hoặc tài sản gắn liền với đất', 'Giao dịch bảo đảm', '2026-05-18', '2026-05-20', '2026-05-20', 'Chi nhánh Văn phòng Đăng ký Đất đai', 'Vũ Quỳnh Chi', '0345678901', 'Nguyễn Hoàng Minh', 'Đã trả kết quả'),
('ig-6', 'HSPT-2026-00120', 'Cấp Giấy chứng nhận quyền sử dụng đất lần đầu', 'Đất đai', '2026-01-10', '2026-02-05', NULL, 'Chi nhánh Văn phòng Đăng ký Đất đai', 'Đoàn Văn Hậu', '0963221144', 'Trần Quốc Toản', 'Đã ký Giấy chứng nhận'),
('ig-7', 'HSPT-2026-00620', 'Xóa đăng ký thế chấp quyền sử dụng đất', 'Giao dịch bảo đảm', '2026-06-01', '2026-06-03', NULL, 'Chi nhánh Văn phòng Đăng ký Đất đai', 'Bùi Tiến Dũng', '0981234789', 'Lê Thị Thu', 'Chưa trả kết quả')
ON CONFLICT (id) DO NOTHING;
