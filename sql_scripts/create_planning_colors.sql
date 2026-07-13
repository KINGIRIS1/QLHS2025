-- ============================================================================
-- BẢNG MÃ MÀU QUY HOẠCH SỬ DỤNG ĐẤT
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.planning_colors (
    id VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    loai_dat VARCHAR(255) NOT NULL,
    ky_hieu VARCHAR(50) NOT NULL UNIQUE,
    mau_sac VARCHAR(255),
    so_mau_sac VARCHAR(50),
    r INT NOT NULL DEFAULT 128,
    g INT NOT NULL DEFAULT 128,
    b INT NOT NULL DEFAULT 128
);

-- Kích hoạt RLS (Row Level Security) cho bảng planning_colors
ALTER TABLE IF EXISTS public.planning_colors ENABLE ROW LEVEL SECURITY;

-- Tạo chính sách cho phép tất cả các thao tác (để sử dụng trên toàn hệ thống)
DROP POLICY IF EXISTS "Cho phép tất cả thao tác trên planning_colors" ON public.planning_colors;
CREATE POLICY "Cho phép tất cả thao tác trên planning_colors" 
ON public.planning_colors 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Chèn dữ liệu mặc định ban đầu nếu bảng trống
INSERT INTO public.planning_colors (id, loai_dat, ky_hieu, mau_sac, so_mau_sac, r, g, b)
VALUES 
    ('1', 'Đất ở tại đô thị', 'ODT', 'Hồng sẫm', '85', 242, 63, 153),
    ('2', 'Đất ở tại nông thôn', 'ONT', 'Hồng nhạt', '15', 254, 181, 181),
    ('3', 'Đất trồng lúa', 'LUA', 'Vàng chanh', '3', 255, 255, 0),
    ('4', 'Đất trồng cây hàng năm khác', 'BHK', 'Vàng nhạt', '4', 255, 255, 173),
    ('5', 'Đất trồng cây lâu năm', 'CLN', 'Vàng cam', '5', 248, 181, 110),
    ('6', 'Đất rừng sản xuất', 'RSX', 'Xanh lá cây nhạt', '120', 196, 236, 196),
    ('7', 'Đất rừng phòng hộ', 'RPH', 'Xanh lá cây đậm', '123', 34, 139, 34),
    ('8', 'Đất rừng đặc dụng', 'RDD', 'Xanh lá mạ', '125', 124, 252, 0),
    ('9', 'Đất nuôi trồng thủy sản', 'NTS', 'Xanh biển lơ', '8', 135, 206, 250),
    ('10', 'Đất làm muối', 'LMU', 'Xám nhạt', '10', 220, 220, 220),
    ('11', 'Đất thương mại, dịch vụ', 'TMD', 'Đỏ cam', '11', 255, 127, 80),
    ('12', 'Đất cơ sở sản xuất phi nông nghiệp', 'SKC', 'Xám đậm', '12', 169, 169, 169),
    ('13', 'Đất quốc phòng', 'CQP', 'Đỏ tươi', '1', 255, 0, 0),
    ('14', 'Đất an ninh', 'CAN', 'Đỏ nhạt', '14', 255, 102, 102),
    ('15', 'Đất khu vui chơi, giải trí công cộng', 'DKV', 'Hồng cam', '24', 255, 192, 203),
    ('16', 'Đất giao thông', 'DGT', 'Xám', '16', 192, 192, 192),
    ('17', 'Đất thủy lợi', 'DTL', 'Xanh lam đậm', '17', 0, 0, 255),
    ('18', 'Đất xây dựng trụ sở cơ quan', 'TSC', 'Tím nhạt', '18', 216, 191, 216),
    ('19', 'Đất nghĩa trang, nghĩa địa', 'NTD', 'Xám xịt', '19', 128, 128, 128),
    ('20', 'Đất sinh hoạt cộng đồng', 'DSH', 'Xanh ngọc', '20', 64, 224, 208)
ON CONFLICT (id) DO NOTHING;
