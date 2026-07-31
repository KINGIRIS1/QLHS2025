import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Download, Upload, HardDrive, RotateCcw, Clock, CheckCircle2, 
    FileJson, History, RefreshCw, Trash2, Loader2, ShieldCheck, 
    AlertCircle, Database, Check, Settings, FolderDown, FolderPlus, FolderCheck, Folder,
    CheckSquare, Square, AlertTriangle, Layers, X, ShieldAlert
} from 'lucide-react';
import { 
    BackupData, BackupPointInfo, AutoBackupConfig, 
    fetchFullSystemBackupData, downloadBackupAsJson, saveBackupWithPicker,
    saveLocalBackupPoint, getAutoBackupConfig, 
    saveAutoBackupConfig, getAutoBackupPoints, 
    getBackupPointData, deleteBackupPoint, restoreSystemBackup,
    pickAutoBackupDirectory, clearAutoBackupDirectory,
    RESTORE_CATEGORIES, getCategoryRecordCount, RestoreCategory
} from '../services/backupService';
import { getSystemSetting } from '../services/apiSystem';
import { confirmAction, showToast } from '../utils/appHelpers';

interface SystemBackupViewProps {
    currentUsername?: string;
}

export const SystemBackupView: React.FC<SystemBackupViewProps> = ({ currentUsername }) => {
    // Export state
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState('');

    // Restore state
    const [importedBackup, setImportedBackup] = useState<BackupData | null>(null);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(RESTORE_CATEGORIES.map(c => c.id));
    const [restoreMode, setRestoreMode] = useState<'upsert' | 'replace'>('upsert');
    const [isRestoring, setIsRestoring] = useState(false);
    const [restoreProgress, setRestoreProgress] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const restoreCardRef = useRef<HTMLDivElement>(null);

    // Auto backup settings state
    const [autoConfig, setAutoConfig] = useState<AutoBackupConfig>(getAutoBackupConfig());
    const [backupPoints, setBackupPoints] = useState<BackupPointInfo[]>(getAutoBackupPoints());

    useEffect(() => {
        const syncConfig = async () => {
            const local = getAutoBackupConfig();
            setAutoConfig(local);
            setBackupPoints(getAutoBackupPoints());

            try {
                const remote = await getSystemSetting('auto_backup_config_v2');
                if (remote) {
                    const parsed = JSON.parse(remote);
                    const merged = { ...local, ...parsed };
                    setAutoConfig(merged);
                    localStorage.setItem('qlhs_auto_backup_config_v1', JSON.stringify(merged));
                }
            } catch (_) {}
        };
        syncConfig();
    }, []);

    // Load backup for restoration with category initialization & smooth scroll
    const loadBackupToRestore = (backup: BackupData) => {
        setImportedBackup(backup);
        // Default select all categories that have records in this backup
        const activeCats = RESTORE_CATEGORIES.filter(c => getCategoryRecordCount(backup, c) > 0).map(c => c.id);
        setSelectedCategoryIds(activeCats.length > 0 ? activeCats : RESTORE_CATEGORIES.map(c => c.id));
        setTimeout(() => {
            restoreCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    // Total records count for currently selected categories
    const totalSelectedRecords = useMemo(() => {
        if (!importedBackup) return 0;
        return RESTORE_CATEGORIES
            .filter(c => selectedCategoryIds.includes(c.id))
            .reduce((sum, c) => sum + getCategoryRecordCount(importedBackup, c), 0);
    }, [importedBackup, selectedCategoryIds]);

    // 1. Export Full System Backup with folder picker
    const handleFullExport = async () => {
        setIsExporting(true);
        setExportProgress('Bắt đầu tải dữ liệu từ CSDL...');
        try {
            const data = await fetchFullSystemBackupData(currentUsername || 'Admin', (msg) => {
                setExportProgress(msg);
            });

            // Save local restore point
            await saveLocalBackupPoint(data, 'manual');
            setBackupPoints(getAutoBackupPoints());

            // Save file - prompts user to select target folder
            setExportProgress('Mở cửa sổ chọn thư mục lưu tệp sao lưu...');
            const result = await saveBackupWithPicker(data);

            if (result.method === 'cancelled') {
                showToast('Đã hủy thao tác chọn thư mục lưu tệp sao lưu.', 'error');
            } else if (result.method === 'picker') {
                showToast(`Đã lưu tệp sao lưu vào thư mục đã chọn (${data.summary.recordsCount + data.summary.contractsCount} hồ sơ)!`, 'success');
            } else {
                showToast(`Đã xuất và tải về bản sao lưu thành công (${data.summary.recordsCount + data.summary.contractsCount} hồ sơ)!`, 'success');
            }
        } catch (e: any) {
            console.error("Export error:", e);
            showToast(`Lỗi khi sao lưu dữ liệu: ${e.message}`, 'error');
        } finally {
            setIsExporting(false);
            setExportProgress('');
        }
    };

    // 2. Handle File Upload for Restore
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target?.result as string) as BackupData;
                if (!parsed.data || typeof parsed.data !== 'object') {
                    showToast("Tệp JSON không đúng định dạng sao lưu hệ thống!", "error");
                    return;
                }
                loadBackupToRestore(parsed);
                showToast("Đã đọc tệp sao lưu thành công. Vui lòng chọn các mục cần khôi phục bên dưới.", "success");
            } catch (err) {
                showToast("Không thể đọc tệp JSON. Vui lòng chọn đúng tệp sao lưu chuẩn.", "error");
            }
        };
        reader.readAsText(file);
    };

    // Category check toggles
    const toggleCategory = (catId: string) => {
        setSelectedCategoryIds(prev => 
            prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
        );
    };

    const handleSelectAllCategories = () => {
        setSelectedCategoryIds(RESTORE_CATEGORIES.map(c => c.id));
    };

    const handleDeselectAllCategories = () => {
        setSelectedCategoryIds([]);
    };

    // Open Confirmation Dialog
    const handlePrepareRestore = () => {
        if (!importedBackup) return;
        if (selectedCategoryIds.length === 0) {
            showToast("Vui lòng chọn ít nhất 1 mục dữ liệu để khôi phục!", "error");
            return;
        }
        setShowConfirmModal(true);
    };

    // Execute Restore after confirmation
    const handleExecuteRestoreConfirm = async () => {
        if (!importedBackup) return;
        setShowConfirmModal(false);

        setIsRestoring(true);
        setRestoreProgress('Bắt đầu quá trình khôi phục...');

        try {
            const res = await restoreSystemBackup(
                importedBackup, 
                restoreMode, 
                (msg) => setRestoreProgress(msg),
                selectedCategoryIds
            );

            if (res.success) {
                showToast("Khôi phục dữ liệu các mục đã chọn thành công! Hãy tải lại trang nếu cần.", "success");
                setImportedBackup(null);
            } else {
                showToast(`Khôi phục thất bại: ${res.details}`, "error");
            }
        } catch (e: any) {
            console.error("Restore error:", e);
            showToast(`Khôi phục thất bại: ${e.message}`, "error");
        } finally {
            setIsRestoring(false);
            setRestoreProgress('');
        }
    };

    // Restore from a saved local point
    const handleRestoreFromLocalPoint = async (pointId: string) => {
        const pointData = await getBackupPointData(pointId);
        if (!pointData) {
            showToast("Không tìm thấy dữ liệu điểm sao lưu này trong bộ nhớ trình duyệt.", "error");
            return;
        }

        loadBackupToRestore(pointData);
        showToast("Đã nạp điểm sao lưu tự động. Kiểm tra các mục dữ liệu và nhấn nút Khôi phục.", "success");
    };

    // Save Auto Config
    const handleSaveConfig = (newConfig: AutoBackupConfig) => {
        setAutoConfig(newConfig);
        saveAutoBackupConfig(newConfig);
        showToast("Đã lưu cấu hình sao lưu tự động!", "success");
    };

    // Pick Folder for Auto-Backup
    const handlePickFolder = async () => {
        const res = await pickAutoBackupDirectory();
        if (res.success && res.folderName) {
            setAutoConfig(getAutoBackupConfig());
            showToast(`Đã chọn thư mục tự động lưu: "${res.folderName}"`, "success");
        } else if (res.error) {
            showToast(res.error, "error");
        }
    };

    const handleClearFolder = async () => {
        if (await confirmAction("Bỏ liên kết thư mục tự động lưu hiện tại?")) {
            await clearAutoBackupDirectory();
            setAutoConfig(getAutoBackupConfig());
            showToast("Đã bỏ liên kết thư mục tự động lưu.", "success");
        }
    };

    // Delete Local Point
    const handleDeletePoint = async (pointId: string) => {
        if (await confirmAction("Xóa điểm sao lưu tự động này khỏi bộ nhớ?")) {
            await deleteBackupPoint(pointId);
            setBackupPoints(getAutoBackupPoints());
            showToast("Đã xóa điểm sao lưu.", "success");
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header / Intro */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-bold uppercase tracking-widest mb-3 border border-blue-400/30">
                        <ShieldCheck size={14} /> An toàn Dữ liệu Tuyệt đối
                    </div>
                    <h3 className="text-xl md:text-2xl font-black tracking-tight text-white mb-2">
                        Công cụ Sao lưu & Khôi phục Dữ liệu
                    </h3>
                    <p className="text-xs md:text-sm text-slate-300 font-medium leading-relaxed max-w-2xl">
                        Tải bản sao lưu định kỳ dạng file JSON hoặc tự động lưu các điểm khôi phục nhanh (Restore Points) để bảo vệ toàn bộ dữ liệu Hồ sơ, Hợp đồng và Cấu hình hệ thống.
                    </p>
                </div>
                <button
                    onClick={handleFullExport}
                    disabled={isExporting}
                    className="px-6 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2.5 active:scale-95 disabled:opacity-50 shrink-0 self-stretch md:self-auto justify-center"
                >
                    {isExporting ? <Loader2 className="animate-spin" size={18} /> : <FolderDown size={18} />}
                    {isExporting ? 'Đang tạo bản sao lưu...' : 'Chọn thư mục & Xuất Sao Lưu (.JSON)'}
                </button>
            </div>

            {/* Export Progress overlay */}
            {isExporting && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3 animate-pulse text-blue-800 text-xs font-bold">
                    <Loader2 className="animate-spin text-blue-600" size={18} />
                    <span>{exportProgress}</span>
                </div>
            )}

            {/* Grid 2 Columns: Auto Backup Settings + Restore from File */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* CARD 1: Cấu hình Sao lưu Tự động */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-5">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                                <Clock size={20} />
                            </div>
                            <div>
                                <h4 className="font-black text-slate-800 text-base tracking-tight">Cấu hình Sao lưu Tự động</h4>
                                <p className="text-xs text-slate-500">Tự động chụp bản sao CSDL khi khởi động hệ thống</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {/* Toggle switch */}
                            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                                <div>
                                    <span className="text-xs font-bold text-slate-700 block">Kích hoạt Sao lưu Tự động</span>
                                    <span className="text-[10px] text-slate-400">Tự động sao lưu ở nền khi Admin đăng nhập</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={autoConfig.enabled}
                                        onChange={(e) => handleSaveConfig({ ...autoConfig, enabled: e.target.checked })}
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>

                            {/* Frequency selection */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tần suất sao lưu tự động</label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleSaveConfig({ ...autoConfig, frequency: 'daily' })}
                                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                                            autoConfig.frequency === 'daily'
                                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        Hàng ngày
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSaveConfig({ ...autoConfig, frequency: 'weekly' })}
                                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                                            autoConfig.frequency === 'weekly'
                                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        Hàng tuần
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSaveConfig({ ...autoConfig, frequency: 'custom' })}
                                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                                            autoConfig.frequency === 'custom'
                                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        Tùy chọn số ngày
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSaveConfig({ ...autoConfig, frequency: 'off' })}
                                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                                            autoConfig.frequency === 'off'
                                                ? 'bg-slate-100 border-slate-400 text-slate-700'
                                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        Tắt
                                    </button>
                                </div>

                                {/* Custom interval days input */}
                                {autoConfig.frequency === 'custom' && (
                                    <div className="mt-2.5 p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                                        <span className="font-bold text-indigo-950 shrink-0">Nhập số ngày theo chu kỳ:</span>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number"
                                                min={1}
                                                max={365}
                                                value={autoConfig.intervalDays || 3}
                                                onChange={(e) => {
                                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                                    handleSaveConfig({ ...autoConfig, frequency: 'custom', intervalDays: val });
                                                }}
                                                className="w-20 px-2.5 py-1 bg-white border border-indigo-300 rounded-lg text-center font-black text-indigo-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            />
                                            <span className="font-bold text-indigo-700">ngày / lần</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Save Mode Choice (Lưu đè vs Tạo bản ghi mới) */}
                            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-bold text-slate-700 block">Tùy chọn sao lưu điểm khôi phục</span>
                                        <span className="text-[10px] text-slate-400">Ghi đè bản ghi cũ hoặc tạo thêm điểm lưu mới</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => handleSaveConfig({ ...autoConfig, saveMode: 'new' })}
                                        className={`p-2.5 rounded-xl border text-left transition-all ${
                                            (autoConfig.saveMode || 'new') === 'new'
                                                ? 'bg-white border-indigo-500 text-indigo-900 ring-1 ring-indigo-500 shadow-2xs'
                                                : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                                        }`}
                                    >
                                        <div className="font-black text-xs block mb-0.5 text-slate-800">Tạo bản lưu mới</div>
                                        <div className="text-[10px] text-slate-500 font-normal leading-tight">Thêm điểm mới vào lịch sử (giữ tối đa {autoConfig.maxPoints} điểm)</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSaveConfig({ ...autoConfig, saveMode: 'overwrite' })}
                                        className={`p-2.5 rounded-xl border text-left transition-all ${
                                            autoConfig.saveMode === 'overwrite'
                                                ? 'bg-white border-indigo-500 text-indigo-900 ring-1 ring-indigo-500 shadow-2xs'
                                                : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                                        }`}
                                    >
                                        <div className="font-black text-xs block mb-0.5 text-slate-800">Lưu đè điểm gần nhất</div>
                                        <div className="text-[10px] text-slate-500 font-normal leading-tight">Ghi đè trực tiếp lên điểm sao lưu cũ nhất gần nhất</div>
                                    </button>
                                </div>
                            </div>

                            {/* Target folder choice */}
                            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-bold text-slate-700 block">Thư mục tự động lưu trên máy</span>
                                        <span className="text-[10px] text-slate-400">Chọn thư mục để hệ thống tự động lưu file khi sao lưu</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handlePickFolder}
                                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                                    >
                                        <FolderPlus size={14} />
                                        {autoConfig.targetFolderName ? 'Đổi thư mục' : 'Chọn thư mục'}
                                    </button>
                                </div>

                                {autoConfig.targetFolderName ? (
                                    <div className="flex items-center justify-between p-2 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs">
                                        <span className="font-bold text-indigo-900 flex items-center gap-1.5 min-w-0 truncate">
                                            <FolderCheck size={14} className="text-indigo-600 shrink-0" />
                                            <span className="truncate">Thư mục: <strong className="text-indigo-950">{autoConfig.targetFolderName}</strong></span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleClearFolder}
                                            className="text-[10px] text-slate-400 hover:text-red-600 font-bold px-2 py-0.5 shrink-0"
                                        >
                                            Bỏ chọn
                                        </button>
                                    </div>
                                ) : (
                                    <div className="text-[11px] text-slate-400 italic">
                                        Chưa chọn thư mục. Hệ thống sẽ sao lưu an toàn vào bộ nhớ nội bộ trình duyệt.
                                    </div>
                                )}
                            </div>

                            {/* Status info */}
                            <div className="p-3.5 bg-indigo-50/50 border border-indigo-100/80 rounded-2xl text-xs text-indigo-900 space-y-1">
                                <div className="flex justify-between font-bold">
                                    <span className="text-slate-500">Lần sao lưu gần nhất:</span>
                                    <span>{autoConfig.lastBackupAt ? new Date(autoConfig.lastBackupAt).toLocaleString('vi-VN') : 'Chưa có'}</span>
                                </div>
                                <div className="flex justify-between font-bold">
                                    <span className="text-slate-500">Số điểm khôi phục lưu tối đa:</span>
                                    <span>{autoConfig.maxPoints} bản ghi</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleFullExport}
                        disabled={isExporting}
                        className="mt-6 w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={isExporting ? 'animate-spin' : ''} />
                        Tạo điểm sao lưu ngay bây giờ
                    </button>
                </div>

                {/* CARD 2: Nạp & Tải tệp Sao lưu */}
                <div ref={restoreCardRef} className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-5">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                                <RotateCcw size={20} />
                            </div>
                            <div>
                                <h4 className="font-black text-slate-800 text-base tracking-tight">Khôi phục Dữ liệu từ File</h4>
                                <p className="text-xs text-slate-500">Tải lên tệp sao lưu JSON để phục hồi hệ thống</p>
                            </div>
                        </div>

                        {/* File upload drag-drop zone */}
                        <label className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all bg-slate-50/50 hover:bg-emerald-50/20 group">
                            <FileJson size={32} className="text-slate-400 group-hover:text-emerald-600 transition-colors mb-2" />
                            <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-700">
                                {importedBackup ? 'Đã nạp tệp sao lưu thành công' : 'Bấm để chọn tệp sao lưu JSON'}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5">Hỗ trợ các file định dạng .JSON xuất từ hệ thống</span>
                            <input 
                                type="file" 
                                accept=".json"
                                onChange={handleFileUpload}
                                className="hidden" 
                            />
                        </label>

                        {!importedBackup && (
                            <div className="mt-4 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-500 space-y-1">
                                <span className="font-bold text-slate-700 block">💡 Khôi phục theo từng mục:</span>
                                <p>Bạn có thể chủ động chọn mục dữ liệu cụ thể (Hồ sơ, Hợp đồng, GCN, Xử phạt, Cấu hình...) để khôi phục thay vì toàn bộ hệ thống.</p>
                            </div>
                        )}
                    </div>

                    {importedBackup && (
                        <button
                            onClick={() => setImportedBackup(null)}
                            className="mt-6 w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                        >
                            <X size={14} /> Bỏ chọn tệp đang nạp
                        </button>
                    )}
                </div>

            </div>

            {/* Granular Category Selection Panel for Restore */}
            {importedBackup && (
                <div className="bg-white border-2 border-emerald-500/80 rounded-3xl p-6 shadow-xl space-y-5 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black shrink-0">
                                <Layers size={20} />
                            </div>
                            <div>
                                <h4 className="font-black text-slate-800 text-lg tracking-tight flex items-center gap-2">
                                    Lựa chọn Các mục Dữ liệu cần Khôi phục
                                </h4>
                                <p className="text-xs text-slate-500 font-medium">
                                    Tệp xuất ngày <strong>{new Date(importedBackup.exportedAt).toLocaleString('vi-VN')}</strong> bởi <strong>{importedBackup.exportedBy || 'Admin'}</strong>
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={handleSelectAllCategories}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1"
                            >
                                <CheckSquare size={14} /> Chọn tất cả
                            </button>
                            <button
                                type="button"
                                onClick={handleDeselectAllCategories}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1"
                            >
                                <Square size={14} /> Bỏ chọn tất cả
                            </button>
                        </div>
                    </div>

                    {/* Checkbox Category Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {RESTORE_CATEGORIES.map(cat => {
                            const cnt = getCategoryRecordCount(importedBackup, cat);
                            const isChecked = selectedCategoryIds.includes(cat.id);

                            return (
                                <div
                                    key={cat.id}
                                    onClick={() => toggleCategory(cat.id)}
                                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 select-none ${
                                        isChecked
                                            ? 'bg-emerald-50/70 border-emerald-500 shadow-xs'
                                            : 'bg-slate-50/50 border-slate-200/80 hover:border-slate-300 opacity-70'
                                    }`}
                                >
                                    <input 
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}} // handled by parent div onClick
                                        className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 shrink-0 cursor-pointer"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-1 mb-0.5">
                                            <span className="font-black text-slate-800 text-xs truncate">{cat.label}</span>
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 border ${
                                                cnt > 0 
                                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                                                    : 'bg-slate-100 text-slate-400 border-slate-200'
                                            }`}>
                                                {cnt.toLocaleString('vi-VN')} bản ghi
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 font-medium leading-tight line-clamp-2">
                                            {cat.description}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Restore Mode Choice & Execution bar */}
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                        <div className="space-y-1 flex-1">
                            <label className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                                Chế độ Khôi phục Dữ liệu
                            </label>
                            <div className="flex flex-col sm:flex-row gap-3 pt-1">
                                <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all flex-1 ${
                                    restoreMode === 'upsert'
                                        ? 'bg-white border-emerald-500 text-emerald-900 shadow-xs ring-1 ring-emerald-500'
                                        : 'bg-white/60 border-slate-200 text-slate-600'
                                }`}>
                                    <input 
                                        type="radio" 
                                        name="restoreMode" 
                                        value="upsert"
                                        checked={restoreMode === 'upsert'}
                                        onChange={() => setRestoreMode('upsert')}
                                        className="text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <div>
                                        <span className="block font-black text-slate-800">Cập nhật & Bổ sung (Nên dùng)</span>
                                        <span className="text-[10px] text-slate-500 font-normal">Giữ dữ liệu hiện có, ghi đè nếu khớp khóa chính</span>
                                    </div>
                                </label>

                                <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all flex-1 ${
                                    restoreMode === 'replace'
                                        ? 'bg-white border-rose-500 text-rose-900 shadow-xs ring-1 ring-rose-500'
                                        : 'bg-white/60 border-slate-200 text-slate-600'
                                }`}>
                                    <input 
                                        type="radio" 
                                        name="restoreMode" 
                                        value="replace"
                                        checked={restoreMode === 'replace'}
                                        onChange={() => setRestoreMode('replace')}
                                        className="text-rose-600 focus:ring-rose-500"
                                    />
                                    <div>
                                        <span className="block font-black text-rose-800">Thay thế hoàn toàn (Ghi đè)</span>
                                        <span className="text-[10px] text-slate-500 font-normal">Xóa sạch các mục chọn trước khi nạp dữ liệu mới</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handlePrepareRestore}
                            disabled={isRestoring || selectedCategoryIds.length === 0}
                            className="px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2.5 disabled:opacity-40 shrink-0"
                        >
                            {isRestoring ? <Loader2 className="animate-spin" size={18} /> : <RotateCcw size={18} />}
                            {isRestoring 
                                ? (restoreProgress || 'Đang khôi phục...') 
                                : `Tiến hành Khôi phục (${totalSelectedRecords.toLocaleString('vi-VN')} bản ghi)`
                            }
                        </button>
                    </div>
                </div>
            )}

            {/* SECTION 3: Danh sách các Điểm Khôi phục Tự động (Saved Restore Points) */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-4 border-b border-slate-100">
                    <div>
                        <h4 className="font-black text-slate-800 text-base tracking-tight flex items-center gap-2">
                            <History size={18} className="text-blue-600" />
                            Danh sách các Điểm Sao lưu / Khôi phục gần đây ({backupPoints.length})
                        </h4>
                        <p className="text-xs text-slate-500">Các bản sao dự phòng được lưu trữ trực tiếp trên thiết bị trình duyệt này</p>
                    </div>
                </div>

                {backupPoints.length > 0 ? (
                    <div className="space-y-3">
                        {backupPoints.map((pt) => (
                            <div 
                                key={pt.id} 
                                className="bg-slate-50 border border-slate-150 hover:border-blue-300 rounded-2xl p-4 transition-all space-y-3"
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-bold text-xs border ${
                                            pt.type === 'manual' 
                                                ? 'bg-blue-100 text-blue-700 border-blue-200' 
                                                : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                                        }`}>
                                            <HardDrive size={18} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-black text-slate-800 text-sm">
                                                    {new Date(pt.timestamp).toLocaleString('vi-VN')}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                                                    pt.type === 'manual' 
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200' 
                                                        : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                }`}>
                                                    {pt.type === 'manual' ? 'Thủ công' : 'Tự động'}
                                                </span>
                                                {pt.savedToFolder && (
                                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[9px] font-bold flex items-center gap-1">
                                                        <Folder size={11} className="text-emerald-600" />
                                                        {pt.savedToFolder}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-3">
                                                <span>Tổng số bản ghi: <strong className="text-slate-800 font-black">{pt.recordsCount}</strong></span>
                                                <span>Dung lượng: <strong className="text-slate-700">{pt.sizeKb} KB</strong></span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                                        <button
                                            onClick={() => handleRestoreFromLocalPoint(pt.id)}
                                            className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"
                                        >
                                            <RotateCcw size={14} /> Nạp Khôi phục
                                        </button>
                                        <button
                                            onClick={() => handleDeletePoint(pt.id)}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-rose-50 rounded-xl transition-colors"
                                            title="Xóa điểm này"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* Detailed Itemized Record Breakdown */}
                                {pt.summaryDetails && (
                                    <div className="pt-2.5 border-t border-slate-200/60 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-[11px]">
                                        <div className="bg-white p-2 rounded-xl border border-slate-100 flex justify-between items-center shadow-2xs">
                                            <span className="text-slate-500 font-medium">Đo đạc / Tiếp nhận:</span>
                                            <span className="font-black text-blue-700">{pt.summaryDetails.recordsCount || 0} bản ghi</span>
                                        </div>
                                        <div className="bg-white p-2 rounded-xl border border-slate-100 flex justify-between items-center shadow-2xs">
                                            <span className="text-slate-500 font-medium">Hợp đồng dịch vụ:</span>
                                            <span className="font-black text-indigo-700">{pt.summaryDetails.contractsCount || 0} bản ghi</span>
                                        </div>
                                        <div className="bg-white p-2 rounded-xl border border-slate-100 flex justify-between items-center shadow-2xs">
                                            <span className="text-slate-500 font-medium">Hồ sơ Lưu trữ GCN:</span>
                                            <span className="font-black text-emerald-700">{pt.summaryDetails.archiveRecordsCount || 0} bản ghi</span>
                                        </div>
                                        {((pt.summaryDetails.warehouseRecordsCount ?? 0) > 0 || pt.summaryDetails.archiveRecordsCount !== undefined) && (
                                            <div className="bg-white p-2 rounded-xl border border-slate-100 flex justify-between items-center shadow-2xs">
                                                <span className="text-slate-500 font-medium">Kho hồ sơ GCN:</span>
                                                <span className="font-black text-emerald-800">{pt.summaryDetails.warehouseRecordsCount || 0} bản ghi</span>
                                            </div>
                                        )}
                                        {((pt.summaryDetails.blockingRecordsCount ?? 0) > 0 || (pt.summaryDetails.archiveBlockingCount ?? 0) > 0) && (
                                            <div className="bg-white p-2 rounded-xl border border-slate-100 flex justify-between items-center shadow-2xs">
                                                <span className="text-slate-500 font-medium">Dữ liệu Ngăn chặn:</span>
                                                <span className="font-black text-rose-700 font-black">
                                                    {(pt.summaryDetails.blockingRecordsCount || 0) + (pt.summaryDetails.archiveBlockingCount || 0)} bản ghi
                                                </span>
                                            </div>
                                        )}
                                        {((pt.summaryDetails.igateRecordsCount ?? 0) > 0 || (pt.summaryDetails.onlineRecordsCount ?? 0) > 0 || pt.summaryDetails.archiveRecordsCount !== undefined) && (
                                            <div className="bg-white p-2 rounded-xl border border-slate-100 flex justify-between items-center shadow-2xs">
                                                <span className="text-slate-500 font-medium">Hồ sơ Đăng ký (iGate):</span>
                                                <span className="font-black text-indigo-800">
                                                    {(pt.summaryDetails.igateRecordsCount || 0) + (pt.summaryDetails.onlineRecordsCount || 0)} bản ghi
                                                </span>
                                            </div>
                                        )}
                                        <div className="bg-white p-2 rounded-xl border border-slate-100 flex justify-between items-center shadow-2xs">
                                            <span className="text-slate-500 font-medium">Nhân viên & User:</span>
                                            <span className="font-black text-slate-800">{(pt.summaryDetails.employeesCount || 0) + (pt.summaryDetails.usersCount || 0)} bản ghi</span>
                                        </div>
                                        {(pt.summaryDetails.vphcCount ?? 0) > 0 && (
                                            <div className="bg-white p-2 rounded-xl border border-slate-100 flex justify-between items-center shadow-2xs">
                                                <span className="text-slate-500 font-medium">Xử phạt VPHC:</span>
                                                <span className="font-black text-amber-700">{pt.summaryDetails.vphcCount} bản ghi</span>
                                            </div>
                                        )}
                                        {(pt.summaryDetails.bienbanCount ?? 0) > 0 && (
                                            <div className="bg-white p-2 rounded-xl border border-slate-100 flex justify-between items-center shadow-2xs">
                                                <span className="text-slate-500 font-medium">Biên bản bàn giao:</span>
                                                <span className="font-black text-purple-700">{pt.summaryDetails.bienbanCount} bản ghi</span>
                                            </div>
                                        )}
                                        {(pt.summaryDetails.thongtinCount ?? 0) > 0 && (
                                            <div className="bg-white p-2 rounded-xl border border-slate-100 flex justify-between items-center shadow-2xs">
                                                <span className="text-slate-500 font-medium">Trích lục thông tin:</span>
                                                <span className="font-black text-teal-700">{pt.summaryDetails.thongtinCount} bản ghi</span>
                                            </div>
                                        )}
                                        {(pt.summaryDetails.chinhlyCount ?? 0) > 0 && (
                                            <div className="bg-white p-2 rounded-xl border border-slate-100 flex justify-between items-center shadow-2xs">
                                                <span className="text-slate-500 font-medium">Chỉnh lý bản đồ:</span>
                                                <span className="font-black text-rose-700">{pt.summaryDetails.chinhlyCount} bản ghi</span>
                                            </div>
                                        )}
                                        {(pt.summaryDetails.tachthuaCount ?? 0) > 0 && (
                                            <div className="bg-white p-2 rounded-xl border border-slate-100 flex justify-between items-center shadow-2xs">
                                                <span className="text-slate-500 font-medium">Tách thửa / Hợp thửa:</span>
                                                <span className="font-black text-orange-700">{pt.summaryDetails.tachthuaCount} bản ghi</span>
                                            </div>
                                        )}
                                        {(pt.summaryDetails.workSchedulesCount ?? 0) > 0 && (
                                            <div className="bg-white p-2 rounded-xl border border-slate-100 flex justify-between items-center shadow-2xs">
                                                <span className="text-slate-500 font-medium">Lịch đo đạc:</span>
                                                <span className="font-black text-cyan-700">{pt.summaryDetails.workSchedulesCount} bản ghi</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center text-slate-400 italic font-medium bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                        Chưa có điểm sao lưu nào trong bộ nhớ. Bấm "Xuất Bản Sao Lưu Ngay" để tạo điểm đầu tiên.
                    </div>
                )}
            </div>

            {/* CONFIRMATION MODAL */}
            {showConfirmModal && importedBackup && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
                                    <AlertTriangle size={22} />
                                </div>
                                <div>
                                    <h4 className="font-black text-slate-800 text-lg tracking-tight">Xác nhận Khôi phục Dữ liệu</h4>
                                    <p className="text-xs text-slate-500 font-medium">Rà soát danh sách các mục dữ liệu sẽ được phục hồi</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowConfirmModal(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Selected Categories List */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-600 px-1">
                                <span>Các mục đã chọn ({selectedCategoryIds.length}/{RESTORE_CATEGORIES.length})</span>
                                <span className="text-emerald-700 font-black">{totalSelectedRecords.toLocaleString('vi-VN')} bản ghi</span>
                            </div>
                            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/80 space-y-1.5 max-h-48 overflow-y-auto">
                                {RESTORE_CATEGORIES.filter(c => selectedCategoryIds.includes(c.id)).map(c => {
                                    const cnt = getCategoryRecordCount(importedBackup, c);
                                    return (
                                        <div key={c.id} className="flex justify-between items-center text-xs py-1 border-b border-slate-100 last:border-0">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                                                <span className="font-bold text-slate-700">{c.label}</span>
                                            </div>
                                            <span className="font-black text-emerald-800 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg text-[11px]">
                                                {cnt.toLocaleString('vi-VN')} bản ghi
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Mode Warning */}
                        {restoreMode === 'replace' ? (
                            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl text-xs space-y-1">
                                <div className="font-black flex items-center gap-1.5 text-rose-700">
                                    <ShieldAlert size={15} /> CHẾ ĐỘ THAY THẾ TOÀN BỘ
                                </div>
                                <p className="text-[11px] leading-relaxed font-medium text-rose-800">
                                    Hệ thống sẽ <strong>xóa toàn bộ bản ghi hiện có</strong> thuộc các mục đã chọn trong CSDL trước khi nạp dữ liệu từ tệp sao lưu này.
                                </p>
                            </div>
                        ) : (
                            <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl text-xs space-y-1">
                                <div className="font-black flex items-center gap-1.5 text-blue-700">
                                    <ShieldCheck size={15} /> CHẾ ĐỘ CẬP NHẬT & BỔ SUNG (UPSERT)
                                </div>
                                <p className="text-[11px] leading-relaxed font-medium text-blue-800">
                                    Hệ thống sẽ cập nhật bản ghi trùng khớp và bổ sung bản ghi mới. Dữ liệu thuộc các mục không chọn sẽ giữ nguyên hoàn toàn.
                                </p>
                            </div>
                        )}

                        {/* Modal Actions */}
                        <div className="flex items-center gap-3 pt-2">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                onClick={handleExecuteRestoreConfirm}
                                disabled={isRestoring}
                                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                            >
                                {isRestoring ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />}
                                Đồng ý Khôi phục
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemBackupView;
