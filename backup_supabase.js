/**
 * File script độc lập: backup_supabase.js
 * Cách dùng: node backup_supabase.js
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Điền cấu hình của bạn ở đây (hoặc lấy từ biến môi trường)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://api.qlhsct.info.vn';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

const TABLES = [
    'archive_records',
    'audit_logs',
    'bienban_records',
    'blocking_records',
    'chat_groups',
    'chinhly_records',
    'contracts',
    'device_schedules',
    'employees',
    'excerpt_counters',
    'excerpt_history',
    'giaymoi_records',
    'holidays',
    'igate_records',
    'map_sheet_conversions',
    'messages',
    'planning_colors',
    'price_list',
    'records',
    'system_settings',
    'tachthua_records',
    'trichdo_counters',
    'trichdo_history',
    'users',
    'vphc_records',
    'warehouse_records',
    'work_schedules'
];

async function fetchAllRows(tableName) {
    let allData = [];
    const PAGE_SIZE = 1000;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .range(from, to);

        if (error) {
            console.error(`❌ Lỗi tải bảng "${tableName}":`, error.message);
            break;
        }

        if (!data || data.length === 0) {
            hasMore = false;
        } else {
            allData = allData.concat(data);
            if (data.length < PAGE_SIZE) {
                hasMore = false;
            } else {
                from += PAGE_SIZE;
            }
        }
    }

    return allData;
}

async function runBackup() {
    console.log('🚀 Bắt đầu quá trình Backup dữ liệu từ Supabase...');
    console.log(`🔗 Server: ${SUPABASE_URL}\n`);

    const outputDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    let successCount = 0;
    let failCount = 0;

    for (const table of TABLES) {
        process.stdout.write(`⏳ Đang tải bảng [${table}]... `);
        try {
            const rows = await fetchAllRows(table);
            const filePath = path.join(outputDir, `${table}.json`);
            
            fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf-8');
            const stats = fs.statSync(filePath);
            const sizeKB = (stats.size / 1024).toFixed(1);
            
            console.log(`✅ Xong: ${rows.length} dòng (${sizeKB} KB) -> ${table}.json`);
            successCount++;
        } catch (err) {
            console.log(`❌ Thất bại: ${err?.message}`);
            failCount++;
        }
    }

    console.log('\n=============================================');
    console.log(`🎉 HOÀN THÀNH BACKUP: ${successCount} thành công, ${failCount} thất bại`);
    console.log(`📁 Thư mục lưu trữ: ${outputDir}`);
    console.log('=============================================\n');
}

runBackup();
