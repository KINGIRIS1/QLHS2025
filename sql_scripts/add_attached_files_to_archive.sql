-- Bổ sung cột attached_files (JSONB) vào bảng archive_records
-- Chạy script này trong phần SQL Editor của Supabase

ALTER TABLE archive_records
ADD COLUMN IF NOT EXISTS attached_files JSONB;
