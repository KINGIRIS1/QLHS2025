import { supabase, isConfigured } from './supabaseClient';
import { logError } from './apiCore';
import { offlineDb } from '../utils/offlineDb';
import { saveSystemSetting, getSystemSetting } from './apiSystem';

export interface BackupData {
    version: string;
    exportedAt: string;
    exportedBy?: string;
    systemName: string;
    summary: {
        recordsCount: number;
        contractsCount: number;
        employeesCount: number;
        usersCount: number;
        archiveRecordsCount: number;
        warehouseRecordsCount?: number;
        blockingRecordsCount?: number;
        archiveBlockingCount?: number;
        onlineRecordsCount?: number;
        igateRecordsCount?: number;
        vphcCount: number;
        bienbanCount: number;
        thongtinCount: number;
        chinhlyCount: number;
        tachthuaCount: number;
        workSchedulesCount: number;
        holidaysCount: number;
        systemSettingsCount: number;
        priceListCount: number;
    };
    data: {
        records?: any[];
        contracts?: any[];
        employees?: any[];
        users?: any[];
        holidays?: any[];
        archive_records?: any[];
        warehouse_records?: any[];
        blocking_records?: any[];
        archive_blocking_records?: any[];
        online_records?: any[];
        igate_records?: any[];
        system_settings?: any[];
        price_list?: any[];
        vphc_records?: any[];
        bienban_records?: any[];
        thongtin_records?: any[];
        chinhly_records?: any[];
        tachthua_records?: any[];
        work_schedules?: any[];
    };
}

export interface AutoBackupConfig {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'custom' | 'off';
    intervalDays?: number;
    lastBackupAt: string | null;
    maxPoints: number;
    saveMode?: 'new' | 'overwrite';
    targetFolderName?: string | null;
}

export interface BackupPointInfo {
    id: string;
    timestamp: string;
    type: 'auto' | 'manual';
    recordsCount: number;
    sizeKb: number;
    savedToFolder?: string | null;
    summaryDetails?: {
        recordsCount: number;
        contractsCount: number;
        employeesCount: number;
        usersCount: number;
        archiveRecordsCount: number;
        warehouseRecordsCount?: number;
        blockingRecordsCount?: number;
        archiveBlockingCount?: number;
        onlineRecordsCount?: number;
        igateRecordsCount?: number;
        vphcCount?: number;
        bienbanCount?: number;
        thongtinCount?: number;
        chinhlyCount?: number;
        tachthuaCount?: number;
        workSchedulesCount?: number;
        holidaysCount?: number;
        systemSettingsCount?: number;
        priceListCount?: number;
    };
}

const AUTO_BACKUP_CONFIG_KEY = 'qlhs_auto_backup_config_v1';
const AUTO_BACKUP_INDEX_KEY = 'qlhs_auto_backup_points_v1';

export const getAutoBackupConfig = (): AutoBackupConfig => {
    try {
        const raw = localStorage.getItem(AUTO_BACKUP_CONFIG_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            return {
                enabled: parsed.enabled ?? true,
                frequency: parsed.frequency || 'daily',
                intervalDays: typeof parsed.intervalDays === 'number' ? parsed.intervalDays : 3,
                lastBackupAt: parsed.lastBackupAt || null,
                maxPoints: parsed.maxPoints || 5,
                saveMode: parsed.saveMode || 'new',
                targetFolderName: parsed.targetFolderName || null
            };
        }
    } catch (_) {}
    return {
        enabled: true,
        frequency: 'daily',
        intervalDays: 3,
        lastBackupAt: null,
        maxPoints: 5,
        saveMode: 'new'
    };
};

export const saveAutoBackupConfig = async (config: AutoBackupConfig): Promise<void> => {
    try {
        localStorage.setItem(AUTO_BACKUP_CONFIG_KEY, JSON.stringify(config));
        await saveSystemSetting('auto_backup_config_v2', JSON.stringify(config));
    } catch (e) {
        console.error("Error saving auto backup config:", e);
    }
};

export const getAutoBackupPoints = (): BackupPointInfo[] => {
    try {
        const raw = localStorage.getItem(AUTO_BACKUP_INDEX_KEY);
        if (raw) {
            return JSON.parse(raw);
        }
    } catch (_) {}
    return [];
};

const saveAutoBackupPointsIndex = (points: BackupPointInfo[]): void => {
    try {
        localStorage.setItem(AUTO_BACKUP_INDEX_KEY, JSON.stringify(points));
    } catch (e) {
        console.error("Error saving backup points index:", e);
    }
};

export const getBackupPointData = async (pointId: string): Promise<BackupData | null> => {
    try {
        const idbData = await offlineDb.getBackupPoint(pointId);
        if (idbData) return idbData;

        const raw = localStorage.getItem(`qlhs_backup_data_${pointId}`);
        if (raw) {
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error("Error getting backup point data:", e);
    }
    return null;
};

export const deleteBackupPoint = async (pointId: string): Promise<void> => {
    try {
        await offlineDb.deleteBackupPoint(pointId);
        localStorage.removeItem(`qlhs_backup_data_${pointId}`);
        const points = getAutoBackupPoints().filter(p => p.id !== pointId);
        saveAutoBackupPointsIndex(points);
    } catch (e) {
        console.error("Error deleting backup point:", e);
    }
};

// Helper fetch range/cursor to avoid max payload limit & missing rows in high-volume tables
async function fetchAllTableRows(tableName: string, onProgress?: (msg: string) => void): Promise<any[]> {
    if (!isConfigured) return [];
    const PAGE_SIZE = 1000; // Match Supabase PostgREST default max rows per query

    try {
        let allRows: any[] = [];
        let lastId: any = null;
        let hasMore = true;
        let useCursor = true;

        while (hasMore) {
            let query = supabase
                .from(tableName)
                .select('*')
                .order('id', { ascending: true })
                .limit(PAGE_SIZE);

            if (lastId !== null) {
                query = query.gt('id', lastId);
            }

            const { data, error } = await query;

            if (error) {
                console.warn(`Warning fetching ${tableName} via cursor (${error.message}), switching to range pagination fallback...`);
                useCursor = false;
                break;
            }

            if (!data || data.length === 0) {
                hasMore = false;
                break;
            }

            allRows.push(...data);
            const newLastId = data[data.length - 1]?.id;

            if (newLastId === undefined || newLastId === null || newLastId === lastId) {
                console.warn(`Table ${tableName} does not have a unique sortable 'id' field, switching to range fallback...`);
                useCursor = false;
                break;
            }
            lastId = newLastId;

            if (onProgress && allRows.length >= 2000 && allRows.length % 5000 < PAGE_SIZE) {
                onProgress(`Đang tải dữ liệu ${tableName}: ${allRows.length.toLocaleString('vi-VN')} bản ghi...`);
            }

            if (data.length < PAGE_SIZE) {
                hasMore = false;
            }
        }

        if (useCursor) {
            return allRows;
        }
    } catch (e) {
        console.warn(`Cursor fetch failed for ${tableName}, falling back to range pagination:`, e);
    }

    return await fetchAllTableRowsRangeFallback(tableName, onProgress);
}

async function fetchAllTableRowsRangeFallback(tableName: string, onProgress?: (msg: string) => void): Promise<any[]> {
    let allRows: any[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .range(from, from + PAGE_SIZE - 1);

        if (error || !data || data.length === 0) {
            hasMore = false;
            break;
        }

        allRows.push(...data);
        if (onProgress && allRows.length >= 2000 && allRows.length % 5000 < PAGE_SIZE) {
            onProgress(`Đang tải dữ liệu ${tableName}: ${allRows.length.toLocaleString('vi-VN')} bản ghi...`);
        }

        if (data.length < PAGE_SIZE) {
            hasMore = false;
        } else {
            from += data.length;
        }
    }
    return allRows;
}

// 1. Export Full Backup
export const fetchFullSystemBackupData = async (username?: string, onProgress?: (msg: string) => void): Promise<BackupData> => {
    if (onProgress) onProgress('Đang đọc danh sách Hồ sơ tiếp nhận...');
    const records = await fetchAllTableRows('records', onProgress);

    if (onProgress) onProgress('Đang đọc dữ liệu Hợp đồng dịch vụ...');
    const contracts = await fetchAllTableRows('contracts', onProgress);

    if (onProgress) onProgress('Đang đọc danh mục Nhân viên & Tài khoản...');
    const employees = await fetchAllTableRows('employees', onProgress);
    const users = await fetchAllTableRows('users', onProgress);

    if (onProgress) onProgress('Đang đọc Hồ sơ Lưu trữ, Kho Hồ sơ, Hồ sơ Đăng ký (iGate)...');
    const archive_records = await fetchAllTableRows('archive_records', onProgress);
    const warehouse_records = await fetchAllTableRows('warehouse_records', onProgress);
    const online_records = await fetchAllTableRows('online_records', onProgress);
    const igate_records = await fetchAllTableRows('igate_records', onProgress);

    if (onProgress) onProgress('Đang đọc Dữ liệu Ngăn chặn (Hiện hành & Lịch sử)...');
    const blocking_records = await fetchAllTableRows('blocking_records', onProgress);
    const archive_blocking_records = await fetchAllTableRows('archive_blocking_records', onProgress);

    if (onProgress) onProgress('Đang đọc dữ liệu Các mẫu tiện ích (VPHC, Biên bản, Trích lục)...');
    const vphc_records = await fetchAllTableRows('vphc_records', onProgress);
    const bienban_records = await fetchAllTableRows('bienban_records', onProgress);
    const thongtin_records = await fetchAllTableRows('thongtin_records', onProgress);
    const chinhly_records = await fetchAllTableRows('chinhly_records', onProgress);
    const tachthua_records = await fetchAllTableRows('tachthua_records', onProgress);

    if (onProgress) onProgress('Đang đọc Cấu hình Hệ thống, Ngày lễ & Lịch đo...');
    const system_settings = await fetchAllTableRows('system_settings', onProgress);
    const holidays = await fetchAllTableRows('holidays', onProgress);
    const price_list = await fetchAllTableRows('price_list', onProgress);
    const work_schedules = await fetchAllTableRows('work_schedules', onProgress);

    const backupData: BackupData = {
        version: "2.1.0",
        exportedAt: new Date().toISOString(),
        exportedBy: username || 'Admin',
        systemName: "Hệ thống Quản lý Hồ sơ",
        summary: {
            recordsCount: records.length,
            contractsCount: contracts.length,
            employeesCount: employees.length,
            usersCount: users.length,
            archiveRecordsCount: archive_records.length,
            warehouseRecordsCount: warehouse_records.length,
            blockingRecordsCount: blocking_records.length,
            archiveBlockingCount: archive_blocking_records.length,
            onlineRecordsCount: online_records.length,
            igateRecordsCount: igate_records.length,
            vphcCount: vphc_records.length,
            bienbanCount: bienban_records.length,
            thongtinCount: thongtin_records.length,
            chinhlyCount: chinhly_records.length,
            tachthuaCount: tachthua_records.length,
            workSchedulesCount: work_schedules.length,
            holidaysCount: holidays.length,
            systemSettingsCount: system_settings.length,
            priceListCount: price_list.length
        },
        data: {
            records,
            contracts,
            employees,
            users,
            holidays,
            archive_records,
            warehouse_records,
            blocking_records,
            archive_blocking_records,
            online_records,
            igate_records,
            system_settings,
            price_list,
            vphc_records,
            bienban_records,
            thongtin_records,
            chinhly_records,
            tachthua_records,
            work_schedules
        }
    };

    return backupData;
};

// Safely serialize BackupData into a Blob using chunking to avoid V8's RangeError: Invalid string length
export const backupDataToBlob = (backupData: BackupData): Blob => {
    const parts: (string | Blob)[] = [];

    const headerObj = {
        version: backupData.version,
        exportedAt: backupData.exportedAt,
        exportedBy: backupData.exportedBy,
        summary: backupData.summary,
    };

    const headerStr = JSON.stringify(headerObj);
    parts.push(headerStr.slice(0, -1) + ',"data":{');

    const dataObj = backupData.data || {};
    const dataKeys = Object.keys(dataObj);

    dataKeys.forEach((key, keyIdx) => {
        parts.push(`"${key}":[`);
        const arr = (dataObj as any)[key] || [];
        const CHUNK_SIZE = 1000;

        for (let i = 0; i < arr.length; i += CHUNK_SIZE) {
            const chunk = arr.slice(i, i + CHUNK_SIZE);
            const chunkStr = JSON.stringify(chunk);
            const innerStr = chunkStr.slice(1, -1);
            if (innerStr.length > 0) {
                if (i > 0) parts.push(',');
                parts.push(innerStr);
            }
        }

        parts.push(']');
        if (keyIdx < dataKeys.length - 1) {
            parts.push(',');
        }
    });

    parts.push('}}');

    return new Blob(parts, { type: 'application/json' });
};

// Trigger file download
export const downloadBackupAsJson = (backupData: BackupData): void => {
    const blob = backupDataToBlob(backupData);
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `QLHS_Full_Backup_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// Save file with folder choice via File System Access API if available, else download
export const saveBackupWithPicker = async (backupData: BackupData): Promise<{ success: boolean; method: 'picker' | 'download' | 'cancelled' }> => {
    const blob = backupDataToBlob(backupData);
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const defaultFileName = `QLHS_Full_Backup_${dateStr}.json`;

    if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        try {
            const handle = await (window as any).showSaveFilePicker({
                suggestedName: defaultFileName,
                types: [
                    {
                        description: 'Tệp sao lưu JSON (*.json)',
                        accept: { 'application/json': ['.json'] },
                    },
                ],
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return { success: true, method: 'picker' };
        } catch (err: any) {
            if (err.name === 'AbortError') {
                return { success: false, method: 'cancelled' };
            }
            console.warn('showSaveFilePicker error, falling back to standard download:', err);
        }
    }

    // Fallback to standard browser download prompt
    downloadBackupAsJson(backupData);
    return { success: true, method: 'download' };
};

// Select persistent auto backup folder
export const pickAutoBackupDirectory = async (): Promise<{ success: boolean; folderName?: string; error?: string }> => {
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
        return { 
            success: false, 
            error: 'Trình duyệt hiện tại không hỗ trợ API chọn thư mục trực tiếp (File System Access). Hệ thống vẫn sẽ tự động chụp điểm sao lưu an toàn vào bộ nhớ hệ thống.' 
        };
    }

    try {
        const dirHandle = await (window as any).showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'documents'
        });
        
        if (dirHandle) {
            await offlineDb.saveDirectoryHandle(dirHandle);
            const folderName = dirHandle.name;
            const config = getAutoBackupConfig();
            config.targetFolderName = folderName;
            saveAutoBackupConfig(config);
            return { success: true, folderName };
        }
        return { success: false, error: 'Chưa chọn thư mục nào.' };
    } catch (err: any) {
        if (err.name === 'AbortError') {
            return { success: false, error: 'Đã hủy thao tác chọn thư mục.' };
        }
        return { success: false, error: err.message || 'Không thể chọn thư mục.' };
    }
};

export const clearAutoBackupDirectory = async (): Promise<void> => {
    await offlineDb.clearDirectoryHandle();
    const config = getAutoBackupConfig();
    config.targetFolderName = null;
    saveAutoBackupConfig(config);
};

export const writeBackupToDirectoryHandle = async (backupData: BackupData): Promise<{ success: boolean; folderName?: string }> => {
    try {
        const dirHandle = await offlineDb.getDirectoryHandle();
        if (!dirHandle) return { success: false };

        // Check or request write permission
        let perm = await dirHandle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted') {
            perm = await dirHandle.requestPermission({ mode: 'readwrite' });
        }

        if (perm === 'granted') {
            const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
            const fileName = `QLHS_AutoBackup_${dateStr}.json`;
            const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            const blob = backupDataToBlob(backupData);
            await writable.write(blob);
            await writable.close();
            return { success: true, folderName: dirHandle.name };
        }
    } catch (e) {
        console.warn('Could not auto-write backup to saved directory handle:', e);
    }
    return { success: false };
};

// Save a local restore point
export const saveLocalBackupPoint = async (
    backupData: BackupData, 
    type: 'auto' | 'manual' = 'auto',
    savedFolderName?: string | null,
    overrideSaveMode?: 'new' | 'overwrite'
): Promise<BackupPointInfo | null> => {
    try {
        const config = getAutoBackupConfig();
        const mode = overrideSaveMode || config.saveMode || 'new';

        let points = getAutoBackupPoints();
        let pointId = `bk_${Date.now()}`;
        let targetFolder = savedFolderName || null;

        if (mode === 'overwrite' && points.length > 0) {
            pointId = points[0].id; // Overwrite the newest point
            if (!targetFolder) {
                targetFolder = points[0].savedToFolder || null;
            }
        }

        const blob = backupDataToBlob(backupData);
        const sizeKb = Math.round(blob.size / 1024);

        // Store data in IndexedDB (handles large sizes)
        try {
            await offlineDb.saveBackupPoint(pointId, backupData);
        } catch (idbErr) {
            console.warn("IndexedDB save failed:", idbErr);
        }

        const s = backupData.summary || {};
        const totalRecords = 
            (s.recordsCount || 0) + 
            (s.contractsCount || 0) + 
            (s.archiveRecordsCount || 0) + 
            (s.warehouseRecordsCount || 0) + 
            (s.blockingRecordsCount || 0) + 
            (s.archiveBlockingCount || 0) + 
            (s.onlineRecordsCount || 0) + 
            (s.igateRecordsCount || 0) + 
            (s.vphcCount || 0) + 
            (s.bienbanCount || 0) + 
            (s.thongtinCount || 0) + 
            (s.chinhlyCount || 0) + 
            (s.tachthuaCount || 0) + 
            (s.workSchedulesCount || 0);

        const newPoint: BackupPointInfo = {
            id: pointId,
            timestamp: backupData.exportedAt,
            type,
            recordsCount: totalRecords,
            sizeKb,
            savedToFolder: targetFolder,
            summaryDetails: backupData.summary ? { ...backupData.summary } : undefined
        };

        if (mode === 'overwrite' && points.length > 0) {
            points[0] = newPoint;
        } else {
            points.unshift(newPoint);
        }

        // Limit to maxPoints
        while (points.length > config.maxPoints) {
            const popped = points.pop();
            if (popped) {
                await deleteBackupPoint(popped.id);
            }
        }

        saveAutoBackupPointsIndex(points);
        config.lastBackupAt = newPoint.timestamp;
        await saveAutoBackupConfig(config);

        return newPoint;
    } catch (e) {
        console.error("Error saving local backup point:", e);
        return null;
    }
};

// Check and trigger auto backup if due
export const checkAndRunAutoBackup = async (username?: string): Promise<boolean> => {
    const config = getAutoBackupConfig();
    if (!config.enabled || config.frequency === 'off') return false;

    const now = new Date().getTime();
    if (config.lastBackupAt) {
        const lastTime = new Date(config.lastBackupAt).getTime();
        const diffHours = (now - lastTime) / (1000 * 60 * 60);

        let requiredHours = 24;
        if (config.frequency === 'daily') requiredHours = 24;
        else if (config.frequency === 'weekly') requiredHours = 168;
        else if (config.frequency === 'custom') requiredHours = (config.intervalDays || 3) * 24;

        if (diffHours < requiredHours) return false;
    }

    try {
        const data = await fetchFullSystemBackupData(username || 'AutoSystem');
        
        let savedFolder: string | null = null;
        const dirWriteRes = await writeBackupToDirectoryHandle(data);
        if (dirWriteRes.success && dirWriteRes.folderName) {
            savedFolder = dirWriteRes.folderName;
        }

        await saveLocalBackupPoint(data, 'auto', savedFolder);
        console.log("✅ Auto backup created successfully at", new Date().toLocaleString());
        return true;
    } catch (e) {
        console.error("Failed auto backup execution:", e);
        return false;
    }
};

// 2. Restore Backup from JSON
export interface RestoreCategory {
    id: string;
    label: string;
    description: string;
    tables: string[];
}

export const RESTORE_CATEGORIES: RestoreCategory[] = [
    {
        id: 'records',
        label: 'Hồ sơ Tiếp nhận / Đo đạc',
        description: 'Bản ghi đo đạc, tiếp nhận hồ sơ đất đai',
        tables: ['records']
    },
    {
        id: 'contracts',
        label: 'Hợp đồng dịch vụ',
        description: 'Thông tin hợp đồng dịch vụ đo đạc',
        tables: ['contracts']
    },
    {
        id: 'archive_records',
        label: 'Hồ sơ Lưu trữ GCN',
        description: 'Dữ liệu sổ lưu trữ Giấy chứng nhận',
        tables: ['archive_records']
    },
    {
        id: 'warehouse_records',
        label: 'Kho Hồ sơ GCN',
        description: 'Kho dữ liệu tập trung Giấy chứng nhận',
        tables: ['warehouse_records']
    },
    {
        id: 'registration_records',
        label: 'Hồ sơ Đăng ký (iGate)',
        description: 'Hồ sơ tiếp nhận iGate & Đăng ký online',
        tables: ['online_records', 'igate_records']
    },
    {
        id: 'blocking_records',
        label: 'Dữ liệu Ngăn chặn',
        description: 'Thông tin ngăn chặn hiện hành & Lịch sử',
        tables: ['blocking_records', 'archive_blocking_records']
    },
    {
        id: 'utilities',
        label: 'Mẫu tiện ích & Biểu mẫu',
        description: 'Xử phạt VPHC, Biên bản, Trích lục, Chỉnh lý, Tách thửa',
        tables: ['vphc_records', 'bienban_records', 'thongtin_records', 'chinhly_records', 'tachthua_records']
    },
    {
        id: 'people',
        label: 'Nhân viên & Tài khoản User',
        description: 'Danh sách Nhân viên và Tài khoản người dùng',
        tables: ['employees', 'users']
    },
    {
        id: 'system_config',
        label: 'Cấu hình & Lịch làm việc',
        description: 'Cấu hình hệ thống, Bảng giá, Ngày lễ, Lịch đo đạc',
        tables: ['system_settings', 'holidays', 'price_list', 'work_schedules']
    }
];

export const getCategoryRecordCount = (backupData: BackupData | null, category: RestoreCategory): number => {
    if (!backupData || !backupData.data) return 0;
    let total = 0;
    for (const tbl of category.tables) {
        const rows = (backupData.data as any)[tbl];
        if (Array.isArray(rows)) {
            total += rows.length;
        }
    }
    return total;
};

export const restoreSystemBackup = async (
    backupData: BackupData, 
    mode: 'upsert' | 'replace' = 'upsert',
    onProgress?: (msg: string) => void,
    selectedCategoryIds?: string[]
): Promise<{ success: boolean; details: string; restoredCounts: Record<string, number> }> => {
    if (!isConfigured) {
        return { success: false, details: "Không có kết nối CSDL Supabase.", restoredCounts: {} };
    }

    if (!backupData || !backupData.data) {
        return { success: false, details: "Cấu trúc tệp sao lưu không hợp lệ.", restoredCounts: {} };
    }

    const { data } = backupData;
    const restoredCounts: Record<string, number> = {};

    let allowedTables: Set<string> | null = null;
    if (selectedCategoryIds && selectedCategoryIds.length > 0) {
        allowedTables = new Set<string>();
        RESTORE_CATEGORIES.forEach(cat => {
            if (selectedCategoryIds.includes(cat.id)) {
                cat.tables.forEach(t => allowedTables!.add(t));
            }
        });
    }

    const upsertBatch = async (tableName: string, rows: any[] | undefined) => {
        if (allowedTables && !allowedTables.has(tableName)) return;
        if (!rows || rows.length === 0) return;

        const total = rows.length;
        if (onProgress) onProgress(`Bắt đầu khôi phục bảng [${tableName}] (${total.toLocaleString('vi-VN')} bản ghi)...`);

        if (mode === 'replace') {
            try {
                if (tableName === 'users') {
                    await supabase.from(tableName).delete().neq('username', 'non_existing_dummy');
                } else if (tableName === 'system_settings') {
                    await supabase.from(tableName).delete().neq('key', 'non_existing_dummy');
                } else {
                    await supabase.from(tableName).delete().neq('id', 'non_existing_dummy');
                }
            } catch (err) {
                console.warn(`Cảnh báo khi xóa bảng ${tableName} ở chế độ thay thế:`, err);
            }
        }

        const BATCH_SIZE = 500;
        let count = 0;

        for (let i = 0; i < total; i += BATCH_SIZE) {
            const chunk = rows.slice(i, i + BATCH_SIZE);
            const { error } = await supabase.from(tableName).upsert(chunk);

            if (error) {
                console.warn(`Lỗi upsert batch ${i}-${i + chunk.length} cho bảng ${tableName} (${error.message}). Đang chuyển sang sub-batch 100...`);
                for (let j = 0; j < chunk.length; j += 100) {
                    const subChunk = chunk.slice(j, j + 100);
                    const { error: subErr } = await supabase.from(tableName).upsert(subChunk);
                    if (!subErr) {
                        count += subChunk.length;
                    } else {
                        console.error(`Sub-chunk error on ${tableName}:`, subErr.message);
                    }
                }
            } else {
                count += chunk.length;
            }

            const current = Math.min(i + BATCH_SIZE, total);
            const percent = Math.round((current / total) * 100);

            if (onProgress) {
                onProgress(`Đang khôi phục [${tableName}]: ${current.toLocaleString('vi-VN')} / ${total.toLocaleString('vi-VN')} bản ghi (${percent}%)...`);
            }

            // Yield UI thread periodically for large datasets (e.g., 300k records)
            if (i > 0 && i % 2500 === 0) {
                await new Promise(r => setTimeout(r, 12));
            }
        }

        restoredCounts[tableName] = count;
    };

    try {
        await upsertBatch('users', data.users);
        await upsertBatch('employees', data.employees);
        await upsertBatch('holidays', data.holidays);
        await upsertBatch('system_settings', data.system_settings);
        await upsertBatch('price_list', data.price_list);
        await upsertBatch('records', data.records);
        await upsertBatch('contracts', data.contracts);
        await upsertBatch('archive_records', data.archive_records);
        await upsertBatch('warehouse_records', data.warehouse_records);
        await upsertBatch('blocking_records', data.blocking_records);
        await upsertBatch('archive_blocking_records', data.archive_blocking_records);
        await upsertBatch('online_records', data.online_records);
        await upsertBatch('igate_records', data.igate_records);
        await upsertBatch('vphc_records', data.vphc_records);
        await upsertBatch('bienban_records', data.bienban_records);
        await upsertBatch('thongtin_records', data.thongtin_records);
        await upsertBatch('chinhly_records', data.chinhly_records);
        await upsertBatch('tachthua_records', data.tachthua_records);
        await upsertBatch('work_schedules', data.work_schedules);

        if (onProgress) onProgress('Khôi phục hoàn tất!');

        return {
            success: true,
            details: "Đã khôi phục dữ liệu hệ thống thành công!",
            restoredCounts
        };
    } catch (e: any) {
        logError("restoreSystemBackup", e);
        return {
            success: false,
            details: `Lỗi khi khôi phục: ${e.message}`,
            restoredCounts
        };
    }
};
