-- ==========================================
-- 1. BẢNG NGƯỜI DÙNG & NHÂN VIÊN (Tab Nhân sự)
-- ==========================================

-- Bảng Nhân viên (Thông tin chi tiết nhân sự)
CREATE TABLE employees (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    position VARCHAR(100),
    managed_wards JSON -- Lưu mảng các phường/xã quản lý: '["Phường 1", "Phường 2"]'
);

-- Bảng Người dùng (Tài khoản đăng nhập)
CREATE TABLE users (
    username VARCHAR(50) PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL, -- ADMIN, SUBADMIN, TEAM_LEADER, EMPLOYEE, ONEDOOR
    employee_id VARCHAR(50),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

-- ==========================================
-- 2. BẢNG HỒ SƠ & HỢP ĐỒNG (Tab Hồ sơ / Đơn từ)
-- ==========================================

-- Bảng Hồ sơ (RecordFile)
CREATE TABLE records (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    "customerName" VARCHAR(255) NOT NULL,
    "phoneNumber" VARCHAR(20),
    cccd VARCHAR(20),
    
    ward VARCHAR(100),
    "landPlot" VARCHAR(50),
    "mapSheet" VARCHAR(50),
    area DECIMAL(10, 2),
    address TEXT,
    "group" VARCHAR(100),
    
    content TEXT,
    "recordType" VARCHAR(100),
    
    "receivedDate" DATE,
    deadline DATE,
    "assignedDate" DATE,
    "submissionDate" DATE,
    "approvalDate" DATE,
    "completedDate" DATE,
    
    status VARCHAR(50) NOT NULL, -- RECEIVED, ASSIGNED, IN_PROGRESS,...
    "assignedTo" VARCHAR(50),
    
    notes TEXT,
    "privateNotes" TEXT,
    "personalNotes" TEXT,
    
    "authorizedBy" VARCHAR(100),
    "authDocType" VARCHAR(100),
    "otherDocs" TEXT,
    
    "exportBatch" INT,
    "exportDate" DATE,
    
    "measurementNumber" VARCHAR(50),
    "excerptNumber" VARCHAR(50),
    
    "reminderDate" TIMESTAMP,
    "lastRemindedAt" TIMESTAMP,
    
    "receiptNumber" VARCHAR(50),
    "receiverName" VARCHAR(100),
    "resultReturnedDate" DATE,
    "needsMapCorrection" BOOLEAN DEFAULT FALSE
);

-- Bảng Hợp đồng (Contract)
CREATE TABLE contracts (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    customer_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    ward VARCHAR(100),
    address TEXT,
    land_plot VARCHAR(50),
    map_sheet VARCHAR(50),
    area DECIMAL(10, 2),
    
    contract_type VARCHAR(50) NOT NULL, -- Đo đạc, Tách thửa, Cắm mốc, Trích lục
    service_type VARCHAR(100) NOT NULL,
    area_type VARCHAR(50) NOT NULL,
    
    plot_count INT,
    marker_count INT,
    split_items JSON, -- Lưu mảng JSON chi tiết tách thửa
    
    quantity INT NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    vat_rate DECIMAL(5, 2) NOT NULL,
    vat_amount DECIMAL(15, 2) NOT NULL,
    total_amount DECIMAL(15, 2) NOT NULL,
    deposit DECIMAL(15, 2) NOT NULL,
    content TEXT,
    
    created_date TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL, -- PENDING, COMPLETED
    
    liquidation_area DECIMAL(10, 2),
    liquidation_amount DECIMAL(15, 2)
);

-- ==========================================
-- 3. BẢNG CẤU HÌNH & TIỆN ÍCH
-- ==========================================

-- Bảng Đơn giá (PriceItem)
CREATE TABLE price_list (
    id VARCHAR(50) PRIMARY KEY,
    service_group VARCHAR(100),
    area_type VARCHAR(50),
    service_name VARCHAR(255) NOT NULL,
    min_area DECIMAL(10, 2) NOT NULL,
    max_area DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    price DECIMAL(15, 2) NOT NULL,
    vat_rate DECIMAL(5, 2) NOT NULL,
    vat_is_percent BOOLEAN NOT NULL
);

-- Bảng Ngày nghỉ lễ (Holiday)
CREATE TABLE holidays (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    day INT NOT NULL,
    month INT NOT NULL,
    "isLunar" BOOLEAN NOT NULL DEFAULT FALSE
);

-- Bảng Cấu hình hệ thống chung
CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT
);

-- ==========================================
-- 4. BẢNG LỊCH CÔNG TÁC (Tab Lịch công tác)
-- ==========================================

CREATE TABLE work_schedules (
    id VARCHAR(50) PRIMARY KEY,
    date DATE NOT NULL,
    executors TEXT NOT NULL, -- Lưu chuỗi tên người thực hiện
    content TEXT NOT NULL,
    partner VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) NOT NULL
);

-- ==========================================
-- 5. BẢNG TIN NHẮN & NHÓM CHAT (Tab Trao đổi)
-- ==========================================

-- Bảng Nhóm Chat
CREATE TABLE chat_groups (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL, -- CUSTOM, SYSTEM
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    members JSON -- Lưu mảng username các thành viên
);

-- Bảng Tin nhắn
CREATE TABLE messages (
    id VARCHAR(50) PRIMARY KEY,
    group_id VARCHAR(50),
    sender_username VARCHAR(50) NOT NULL,
    sender_name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    
    file_url TEXT,
    file_name VARCHAR(255),
    file_type VARCHAR(50),
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    reply_to_id VARCHAR(50),
    reply_to_content TEXT,
    reply_to_sender VARCHAR(100),
    reactions JSON -- Lưu object JSON: {"username": "reaction"}
);

-- ==========================================
-- 6. BẢNG LƯU TRỮ (Tab Lưu trữ)
-- ==========================================

CREATE TABLE archive_records (
    id VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL, -- saoluc, vaoso, congvan
    status VARCHAR(20) NOT NULL, -- draft, assigned, executed, pending_sign, signed, completed
    so_hieu VARCHAR(100),
    trich_yeu TEXT,
    ngay_thang DATE,
    noi_nhan_gui VARCHAR(255),
    data JSON -- Lưu các trường mở rộng khác
);

-- ==========================================
-- 7. BẢNG TIỆN ÍCH (Tab Tiện ích)
-- ==========================================

-- Bảng Vi phạm hành chính
CREATE TABLE vphc_records (
    id VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    record_type VARCHAR(20), -- mau01, mau02
    data JSON
);

-- Bảng Biên bản
CREATE TABLE bienban_records (
    id VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    data JSON
);

-- Bảng Thông tin
CREATE TABLE thongtin_records (
    id VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    data JSON
);

-- Bảng Chỉnh lý
CREATE TABLE chinhly_records (
    id VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    data JSON
);

-- Bảng Tách thửa
CREATE TABLE tachthua_records (
    id VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50) NOT NULL,
    customer_name VARCHAR(255),
    data JSON
);

-- Bảng Chuyển đổi tờ bản đồ
CREATE TABLE map_sheet_conversions (
    id VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    xa_phuong_cu VARCHAR(100),
    so_to_cu VARCHAR(50),
    xa_phuong_moi VARCHAR(100),
    so_to_moi VARCHAR(50)
);

-- ==========================================
-- 8. BẢNG QUẢN LÝ TRÍCH LỤC / TRÍCH ĐO (Tab Quản lý Trích lục)
-- ==========================================

-- Lịch sử Trích lục
CREATE TABLE excerpt_history (
    id VARCHAR(50) PRIMARY KEY,
    ward VARCHAR(100),
    "mapSheet" VARCHAR(50),
    "landPlot" VARCHAR(50),
    "excerptNumber" INT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(50) NOT NULL,
    "linkedRecordCode" VARCHAR(50)
);

-- Bộ đếm Trích lục
CREATE TABLE excerpt_counters (
    ward VARCHAR(100) PRIMARY KEY,
    count INT NOT NULL DEFAULT 0
);

-- Lịch sử Trích đo
CREATE TABLE trichdo_history (
    id VARCHAR(50) PRIMARY KEY,
    ward VARCHAR(100),
    "mapSheet" VARCHAR(50),
    "landPlot" VARCHAR(50),
    "excerptNumber" INT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" VARCHAR(50) NOT NULL,
    "linkedRecordCode" VARCHAR(50)
);

-- Bộ đếm Trích đo
CREATE TABLE trichdo_counters (
    ward VARCHAR(100) PRIMARY KEY,
    count INT NOT NULL DEFAULT 0
);
