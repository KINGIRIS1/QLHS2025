-- Tạo bảng archive_blocking_records để quản lý ngăn chặn trong phần Lưu trữ
CREATE TABLE IF NOT EXISTS archive_blocking_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    "owners" JSONB,
    "issueNumber" TEXT,
    "certNumber" TEXT,
    "issueDate" TEXT,
    "hamlet" TEXT,
    "oldCommune" TEXT,
    "newCommune" TEXT,
    "plots" JSONB,
    "blockingDocuments" JSONB,
    "notes" TEXT,
    "attached_files" JSONB,
    "isUnblocked" BOOLEAN DEFAULT false,
    "unblockDoc" TEXT,
    "unblock_attached_files" JSONB,
    "createdBy" TEXT
);

-- Cấp quyền (RLS) cho archive_blocking_records (Nếu bạn đã bật RLS, cho phép mọi thao tác)
ALTER TABLE archive_blocking_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cho phép tất cả thao tác archive_blocking_records" ON archive_blocking_records FOR ALL USING (true);
