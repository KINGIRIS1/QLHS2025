-- CREATE TABLE FOR DETACHED HIGH-PERFORMANCE WAREHOUSE RECORDS
-- This schema supports up to 300,000+ rows with blazing fast search indexing
CREATE TABLE IF NOT EXISTS warehouse_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT,
    type TEXT DEFAULT 'kho',
    status TEXT DEFAULT 'completed',
    so_hieu TEXT UNIQUE, -- Mã biên nhận / matd chính
    trich_yeu TEXT,
    ngay_thang DATE, -- Ngày nhập / ngày lưu hồ sơ
    noi_nhan_gui TEXT, -- Chủ sử dụng 1
    attached_files JSONB DEFAULT '[]'::jsonb,
    
    -- Specific structured columns for high-volume excel imports & direct indexed filters
    loaihoso TEXT,
    hoten1 TEXT,
    namsinh1 INTEGER,
    loaicccd1 TEXT,
    socccd TEXT,
    diachitt1 TEXT,
    hoten2 TEXT,
    namsinh2 INTEGER,
    loaicccd2 TEXT,
    socccd2 TEXT,
    diachitt2 TEXT,
    matd TEXT,
    tobando TEXT,
    sothua TEXT,
    dientich NUMERIC,
    hinhthucsd TEXT,
    loaidato TEXT,
    dientichdato NUMERIC,
    mavach TEXT,
    maxa TEXT,
    manam TEXT,
    sophathanhgcnmoi TEXT,
    sovaosomoi TEXT,
    ngaycapgcnmoi DATE,
    diachiap TEXT,
    soke_tang TEXT,
    so_o TEXT,
    So_tep TEXT,
    sott_tep TEXT,
    nguoinhap TEXT,
    ngaynhap DATE,
    ghichu TEXT,
    
    -- Backup JSON column for custom dynamic metadata
    data JSONB DEFAULT '{}'::jsonb
);

-- Enable Row Level Security (RLS)
ALTER TABLE warehouse_records ENABLE ROW LEVEL SECURITY;

-- Security rules: Allow read, insert, update, delete for everyone matching the current app pattern
CREATE POLICY "Allow read for all users" ON warehouse_records FOR SELECT USING (true);
CREATE POLICY "Allow insert for all users" ON warehouse_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for all users" ON warehouse_records FOR UPDATE USING (true);
CREATE POLICY "Allow delete for all users" ON warehouse_records FOR DELETE USING (true);

-- High-performance indexes to speed up searches on 300,000+ records
CREATE INDEX IF NOT EXISTS idx_warehouse_so_hieu ON warehouse_records (so_hieu);
CREATE INDEX IF NOT EXISTS idx_warehouse_hoten1 ON warehouse_records (hoten1);
CREATE INDEX IF NOT EXISTS idx_warehouse_socccd ON warehouse_records (socccd);
CREATE INDEX IF NOT EXISTS idx_warehouse_tobando_sothua ON warehouse_records (tobando, sothua);
CREATE INDEX IF NOT EXISTS idx_warehouse_soke_tang ON warehouse_records (soke_tang);
CREATE INDEX IF NOT EXISTS idx_warehouse_so_o ON warehouse_records (so_o);
CREATE INDEX IF NOT EXISTS idx_warehouse_loaihoso ON warehouse_records (loaihoso);
CREATE INDEX IF NOT EXISTS idx_warehouse_sophathanhgcnmoi ON warehouse_records (sophathanhgcnmoi);
