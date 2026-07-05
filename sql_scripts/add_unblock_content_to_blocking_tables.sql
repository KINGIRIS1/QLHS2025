-- Script SQL bổ sung cột Nội dung giải ngăn chặn vào bảng blocking_records và archive_blocking_records trên Supabase
-- Giúp lưu trữ nội dung giải ngăn chặn đồng bộ trên Cloud database.
-- Bạn có thể chạy đoạn Script này trong mục "SQL Editor" trên Supabase Dashboard.

-- 1. Bổ sung cột "unblockContent" dạng TEXT cho bảng blocking_records (Ngăn chặn chính)
ALTER TABLE public.blocking_records 
ADD COLUMN IF NOT EXISTS "unblockContent" TEXT DEFAULT NULL;

-- 2. Bổ sung cột "unblockContent" dạng TEXT cho bảng archive_blocking_records (Ngăn chặn trong lưu trữ)
ALTER TABLE public.archive_blocking_records 
ADD COLUMN IF NOT EXISTS "unblockContent" TEXT DEFAULT NULL;

-- 3. Thêm chú thích giải thích cho các trường mới
COMMENT ON COLUMN public.blocking_records."unblockContent" IS 'Nội dung giải ngăn chặn';
COMMENT ON COLUMN public.archive_blocking_records."unblockContent" IS 'Nội dung giải ngăn chặn';
