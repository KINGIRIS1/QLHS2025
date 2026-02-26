import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ArchiveRecord, fetchArchiveRecords, saveArchiveRecord, deleteArchiveRecord, importArchiveRecords, updateArchiveRecordsBatch } from '../../services/apiArchive';
import { User } from '../../types';
import { Loader2, Plus, Search, Trash2, Upload, FileSpreadsheet, Send, CheckCircle2, X, History, Calendar, FileOutput, Settings, Hash, Edit } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { confirmAction } from '../../utils/appHelpers';

// Định nghĩa các cột
const COLUMNS = [
    // Nhóm thông tin hồ sơ (Read-only by default)
    { key: 'ma_ho_so', label: 'Mã hồ sơ giao dịch', width: '150px', readOnly: true },
    { key: 'ten_chuyen_quyen', label: 'TÊN CHỦ SỬ DỤNG CHUYỂN QUYỀN', width: '250px', readOnly: true },
    { key: 'ten_chu_su_dung', label: 'TÊN CHỦ SỬ DỤNG', width: '250px', readOnly: true },
    { key: 'loai_bien_dong', label: 'Loại biến động', width: '200px', readOnly: true },
    { key: 'ngay_nhan', label: 'Ngày nhận hồ sơ', width: '140px', type: 'date', readOnly: true },
    { key: 'so_to', label: 'Số tờ', width: '80px', readOnly: true },
    { key: 'so_thua', label: 'Số thửa', width: '80px', readOnly: true },
    { key: 'tong_dien_tich', label: 'Tổng diện tích', width: '120px', readOnly: true },
    { key: 'dien_tich_tho_cu', label: 'Diện tích thổ cư', width: '120px', readOnly: true },
    { key: 'dia_danh', label: 'Địa danh', width: '150px', readOnly: true },
    
    // Nhóm kết quả (Always editable or specific logic)
    { key: 'loai_gcn', label: 'Loại GCN', width: '150px' },
    { key: 'so_vao_so', label: 'Số vào sổ', width: '160px' },
    { key: 'so_phat_hanh', label: 'Số phát hành', width: '150px' },
    { key: 'ngay_ky_gcn', label: 'Ngày ký GCN', width: '140px', type: 'date' },
    { key: 'ngay_ky_phieu_tk', label: 'Ngày ký phiếu TK/Chuyển Scan', width: '140px', type: 'date' },
    { key: 'ghi_chu', label: 'GHI CHÚ', width: '250px' }
];

interface VaoSoViewProps {
    currentUser: User;
    wards: string[];
}

const VaoSoView: React.FC<VaoSoViewProps> = ({ currentUser, wards }) => {
    const [records, setRecords] = useState<ArchiveRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'scanned'>('all');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [savingId, setSavingId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

    // Batch Modal State
    const [showBatchModal, setShowBatchModal] = useState(false);

    // Export Handover Modal State
    const [showExportHandoverModal, setShowExportHandoverModal] = useState(false);

    // Settings Modal State
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [currentBookNumber, setCurrentBookNumber] = useState<number>(0);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const data = await fetchArchiveRecords('vaoso');
        setRecords(data);
        
        // Calculate max book number from existing records
        let maxNum = 0;
        data.forEach(r => {
            const val = r.data?.so_vao_so || '';
            if (val.startsWith('CN ')) {
                const numPart = val.replace('CN ', '');
                const num = parseInt(numPart);
                if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            } else {
                 // Fallback for old format if just number
                 const num = parseInt(val);
                 if (!isNaN(num) && num > maxNum) {
                    maxNum = num;
                }
            }
        });
        
        // If local storage has a higher number, use it
        const stored = localStorage.getItem('vaoso_current_book_number');
        if (stored) {
            const storedNum = parseInt(stored);
            if (!isNaN(storedNum) && storedNum > maxNum) {
                maxNum = storedNum;
            }
        }
        setCurrentBookNumber(maxNum);
        
        setLoading(false);
    };

    const filteredRecords = useMemo(() => {
        let filtered = records;

        // Filter by Tab
        if (activeTab === 'all') {
            // Danh sách tổng: Hiển thị tối đa 1000 dòng mới nhất
            filtered = records.slice(0, 1000);
        } else if (activeTab === 'pending') {
            // Chờ chuyển Scan: Đã được đánh dấu chuyển scan NHƯNG chưa có đợt scan (chưa scan xong)
            filtered = records.filter(r => r.data?.is_pending_scan && !r.data?.is_scanned);
        } else if (activeTab === 'scanned') {
            // Đã chuyển Scan: Đã có đợt scan
            filtered = records.filter(r => r.data?.is_scanned);
        }

        // Filter by Search
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(r => 
                r.so_hieu?.toLowerCase().includes(lower) ||
                r.trich_yeu?.toLowerCase().includes(lower) ||
                JSON.stringify(r.data).toLowerCase().includes(lower)
            );
        }

        return filtered;
    }, [records, searchTerm, activeTab]);

    // Pagination
    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    const paginatedRecords = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredRecords.slice(start, start + itemsPerPage);
    }, [filteredRecords, currentPage]);

    // Reset page when tab or search changes
    useEffect(() => {
        setCurrentPage(1);
        setSelectedIds(new Set()); // Clear selection on tab change
    }, [activeTab, searchTerm]);

    const handleAddNew = async () => {
        const newRecord: Partial<ArchiveRecord> = {
            type: 'vaoso',
            status: 'completed',
            so_hieu: '',
            trich_yeu: '',
            ngay_thang: new Date().toISOString().split('T')[0],
            noi_nhan_gui: '',
            created_by: currentUser.username,
            data: {
                so_vao_so: '',
                ma_ho_so: '',
                ten_chuyen_quyen: '',
                ten_chu_su_dung: '',
                loai_bien_dong: '',
                loai_gcn: 'GCN mới',
                ngay_nhan: new Date().toISOString().split('T')[0],
                so_to: '',
                so_thua: '',
                tong_dien_tich: '',
                dien_tich_tho_cu: '',
                dia_danh: '',
                so_phat_hanh: '',
                ngay_ky_gcn: '',
                ngay_ky_phieu_tk: '',
                ghi_chu: ''
            }
        };
        
        const saved = await saveArchiveRecord(newRecord);
        if (saved) {
            setEditingId(saved.id);
            loadData();
        }
    };

    const handleDelete = async (id: string) => {
        if (await confirmAction("Bạn có chắc chắn muốn xóa hồ sơ này?")) {
            await deleteArchiveRecord(id);
            loadData();
        }
    };

    const handleCellChange = (id: string, key: string, value: string) => {
        setRecords(prev => prev.map(r => {
            if (r.id === id) {
                return { ...r, data: { ...r.data, [key]: value } };
            }
            return r;
        }));
    };

    const handleBlur = async (record: ArchiveRecord) => {
        setSavingId(record.id);
        await saveArchiveRecord(record);
        setSavingId(null);
    };

    const toggleEdit = (id: string) => {
        if (editingId === id) {
            setEditingId(null);
        } else {
            setEditingId(id);
        }
    };

    const handleGetBookNumber = async (record: ArchiveRecord) => {
        const nextNum = currentBookNumber + 1;
        const formattedNum = `CN ${nextNum.toString().padStart(6, '0')}`;
        
        const updatedRecord = {
            ...record,
            data: { ...record.data, so_vao_so: formattedNum }
        };
        
        // Optimistic update
        setRecords(prev => prev.map(r => r.id === record.id ? updatedRecord : r));
        setCurrentBookNumber(nextNum);
        localStorage.setItem('vaoso_current_book_number', nextNum.toString());

        setSavingId(record.id);
        await saveArchiveRecord(updatedRecord);
        setSavingId(null);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

                // Tìm dòng tiêu đề
                let headerRowIdx = -1;
                for (let i = 0; i < Math.min(data.length, 10); i++) {
                    const rowStr = JSON.stringify(data[i]).toLowerCase();
                    if (rowStr.includes('mã hồ sơ') || rowStr.includes('chủ sử dụng')) {
                        headerRowIdx = i;
                        break;
                    }
                }

                if (headerRowIdx === -1) {
                    alert("Không tìm thấy dòng tiêu đề hợp lệ trong file Excel.");
                    return;
                }

                const rawHeaderRow = data[headerRowIdx] || [];
                const headers = Array.from(rawHeaderRow).map((h: any) => String(h || '').trim().toLowerCase());
                
                const rows = data.slice(headerRowIdx + 1);
                
                const newRecords: Partial<ArchiveRecord>[] = [];

                // Helper tìm index cột với loại trừ
                const findCol = (keywords: string[], excludes: string[] = []) => 
                    headers.findIndex(h => h && keywords.some(k => h.includes(k)) && !excludes.some(e => h.includes(e)));

                // Logic tìm cột Tên chủ sử dụng (Ưu tiên các từ khóa rõ ràng trước)
                let tenChuSuDungIdx = findCol(['bên nhận', 'người nhận', 'bên b', 'người được cấp', 'chủ mới']);
                if (tenChuSuDungIdx === -1) {
                    // Nếu không thấy, tìm các từ khóa chung nhưng loại trừ từ khóa chuyển nhượng
                    tenChuSuDungIdx = findCol(
                        ['tên chủ', 'người sử dụng', 'chủ sử dụng', 'họ tên', 'tên nsd', 'chủ hộ', 'được cấp', 'tên người'], 
                        ['chuyển quyền', 'chuyển nhượng', 'bên a', 'bên chuyển', 'người chuyển', 'chủ cũ']
                    );
                }

                const colMap = {
                    so_vao_so: findCol(['số vào sổ', 'svs', 'số vào']),
                    ma_ho_so: findCol(['mã hồ sơ', 'mã hs', 'số hồ sơ']),
                    ten_chuyen_quyen: findCol(['chuyển quyền', 'chuyển nhượng', 'bên a', 'bên chuyển', 'người chuyển', 'chủ cũ']),
                    ten_chu_su_dung: tenChuSuDungIdx,
                    loai_bien_dong: findCol(['biến động', 'loại hồ sơ', 'nội dung']),
                    loai_gcn: findCol(['loại gcn', 'gcn']),
                    ngay_nhan: findCol(['ngày nhận', 'ngày nộp']),
                    so_to: findCol(['tờ', 'số tờ']),
                    so_thua: findCol(['thửa', 'số thửa']),
                    tong_dien_tich: findCol(['tổng diện tích', 'dt', 'diện tích']),
                    dien_tich_tho_cu: findCol(['thổ cư', 'ont', 'odt']),
                    dia_danh: findCol(['địa danh', 'địa chỉ', 'vị trí']),
                    so_phat_hanh: findCol(['số phát hành', 'số seri', 'seri']),
                    ngay_ky_gcn: findCol(['ký gcn', 'ngày ký giấy', 'ngày cấp']),
                    ngay_ky_phieu_tk: findCol(['phiếu tk', 'chuyển scan']),
                    ghi_chu: findCol(['ghi chú'])
                };

                rows.forEach(row => {
                    if (!row || row.length === 0) return;
                    if (!row[colMap.ma_ho_so] && !row[colMap.ten_chu_su_dung]) return;

                    const getValue = (idx: number) => {
                        if (idx === -1) return '';
                        let val = row[idx];
                        if (val === undefined || val === null) return '';
                        
                        // Xử lý ngày tháng Excel (serial number)
                        if (typeof val === 'number' && val > 20000 && val < 60000) {
                             const date = new Date(Math.round((val - 25569) * 86400 * 1000));
                             return date.toISOString().split('T')[0];
                        }
                        return String(val).trim();
                    };

                    const recordData = {
                        so_vao_so: getValue(colMap.so_vao_so),
                        ma_ho_so: getValue(colMap.ma_ho_so),
                        ten_chuyen_quyen: getValue(colMap.ten_chuyen_quyen),
                        ten_chu_su_dung: getValue(colMap.ten_chu_su_dung),
                        loai_bien_dong: getValue(colMap.loai_bien_dong),
                        loai_gcn: getValue(colMap.loai_gcn) || 'GCN mới',
                        ngay_nhan: getValue(colMap.ngay_nhan),
                        so_to: getValue(colMap.so_to),
                        so_thua: getValue(colMap.so_thua),
                        tong_dien_tich: getValue(colMap.tong_dien_tich),
                        dien_tich_tho_cu: getValue(colMap.dien_tich_tho_cu),
                        dia_danh: getValue(colMap.dia_danh),
                        so_phat_hanh: getValue(colMap.so_phat_hanh),
                        ngay_ky_gcn: getValue(colMap.ngay_ky_gcn),
                        ngay_ky_phieu_tk: getValue(colMap.ngay_ky_phieu_tk),
                        ghi_chu: getValue(colMap.ghi_chu),
                        is_pending_scan: false, // Mặc định chưa chuyển scan
                        is_scanned: false
                    };

                    newRecords.push({
                        type: 'vaoso',
                        status: 'completed',
                        so_hieu: recordData.ma_ho_so,
                        trich_yeu: `${recordData.loai_bien_dong} - ${recordData.ten_chu_su_dung}`,
                        ngay_thang: recordData.ngay_nhan || new Date().toISOString().split('T')[0],
                        created_by: currentUser.username,
                        data: recordData
                    });
                });

                if (newRecords.length > 0) {
                    await importArchiveRecords(newRecords);
                    alert(`Đã import thành công ${newRecords.length} hồ sơ.`);
                    loadData();
                } else {
                    alert("Không đọc được dữ liệu nào từ file.");
                }

            } catch (error) {
                console.error(error);
                alert("Lỗi khi đọc file Excel.");
            } finally {
                setLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(new Set(filteredRecords.map(r => r.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectRow = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    // Chuyển sang tab "Chờ chuyển Scan"
    const handleMoveToPending = async () => {
        if (selectedIds.size === 0) return;
        if (!await confirmAction(`Bạn có chắc muốn chuyển ${selectedIds.size} hồ sơ sang danh sách Chờ Scan?`)) return;

        setLoading(true);
        const updates = {
            data: { is_pending_scan: true }
        };
        await updateArchiveRecordsBatch(Array.from(selectedIds), updates);
        setLoading(false);
        setSelectedIds(new Set());
        loadData();
    };

    const handleMoveToPendingSingle = async (id: string) => {
        setLoading(true);
        const updates = {
            data: { is_pending_scan: true }
        };
        await updateArchiveRecordsBatch([id], updates);
        setLoading(false);
        loadData();
    };

    // Mở modal tạo đợt (từ tab Pending)
    const handleOpenBatchModal = () => {
        if (selectedIds.size === 0) return;
        setShowBatchModal(true);
    };

    // Xác nhận tạo đợt scan
    const handleConfirmBatch = async (batch: number, date: string) => {
        setLoading(true);
        const updates = {
            data: { 
                is_scanned: true,
                scan_batch_id: batch.toString(),
                scan_date: date,
                is_pending_scan: false // Đã scan xong thì bỏ cờ pending (hoặc giữ tùy logic, ở đây bỏ để biến mất khỏi tab pending)
            }
        };
        await updateArchiveRecordsBatch(Array.from(selectedIds), updates);
        setLoading(false);
        setSelectedIds(new Set());
        loadData();
    };

    const handleExportExcel = () => {
        const dataToExport = filteredRecords.map((r, idx) => {
            const row: any = {
                'STT': idx + 1,
                'Số vào sổ': r.data?.so_vao_so,
                'Mã hồ sơ': r.data?.ma_ho_so,
                'Tên chuyển quyền': r.data?.ten_chuyen_quyen,
                'Tên chủ sử dụng': r.data?.ten_chu_su_dung,
                'Loại biến động': r.data?.loai_bien_dong,
                'Loại GCN': r.data?.loai_gcn,
                'Ngày nhận': r.data?.ngay_nhan,
                'Số tờ': r.data?.so_to,
                'Số thửa': r.data?.so_thua,
                'Tổng diện tích': r.data?.tong_dien_tich,
                'Diện tích thổ cư': r.data?.dien_tich_tho_cu,
                'Địa danh': r.data?.dia_danh,
                'Số phát hành': r.data?.so_phat_hanh,
                'Ngày ký GCN': r.data?.ngay_ky_gcn,
                'Ngày ký phiếu TK': r.data?.ngay_ky_phieu_tk,
                'Ghi chú': r.data?.ghi_chu
            };
            if (activeTab === 'scanned') {
                row['Ngày Scan'] = r.data?.scan_date;
                row['Đợt Scan'] = r.data?.scan_batch_id;
            }
            return row;
        });

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "DanhSach");
        XLSX.writeFile(wb, `VaoSo_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        SỔ VÀO SỐ
                    </h2>
                    <div className="relative flex-1 sm:w-64 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" 
                            placeholder="Tìm kiếm..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-2 rounded-lg relative">
                    <div className="flex bg-white rounded-md border border-gray-200 p-1 mr-2 shadow-sm">
                        <button 
                            onClick={() => setActiveTab('all')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            Danh sách
                        </button>
                        <button 
                            onClick={() => setActiveTab('pending')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'pending' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            Chờ chuyển Scan/1 Cửa
                        </button>
                        <button 
                            onClick={() => setActiveTab('scanned')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'scanned' ? 'bg-green-100 text-green-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            Đã chuyển Scan/1 Cửa
                        </button>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                        {activeTab === 'all' && (
                            <>
                                <button 
                                    onClick={() => setShowSettingsModal(true)} 
                                    className="flex items-center gap-2 bg-gray-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-gray-700 shadow-sm"
                                    title="Cài đặt số vào sổ"
                                >
                                    <Settings size={16}/>
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
                                <button onClick={handleImportClick} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-blue-700 shadow-sm">
                                    <Upload size={16}/> Import Excel
                                </button>
                                <button onClick={handleAddNew} className="flex items-center gap-2 bg-teal-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-teal-700 shadow-sm">
                                    <Plus size={16}/> Thêm mới
                                </button>
                                {selectedIds.size > 0 && (
                                    <button onClick={handleMoveToPending} className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-indigo-700 shadow-sm animate-pulse">
                                        <Send size={16}/> Chuyển Scan ({selectedIds.size})
                                    </button>
                                )}
                            </>
                        )}

                        {activeTab === 'pending' && selectedIds.size > 0 && (
                            <button onClick={handleOpenBatchModal} className="flex items-center gap-2 bg-orange-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-orange-700 shadow-sm animate-pulse">
                                <CheckCircle2 size={16}/> Tạo đợt ({selectedIds.size})
                            </button>
                        )}

                        {activeTab === 'scanned' && (
                            <button onClick={() => setShowExportHandoverModal(true)} className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-purple-700 shadow-sm">
                                <FileOutput size={16}/> Xuất danh sách
                            </button>
                        )}

                        <button onClick={handleExportExcel} className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-green-700 shadow-sm">
                            <FileSpreadsheet size={16}/> Xuất Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto relative flex flex-col">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-gray-500 gap-2">
                        <Loader2 className="animate-spin" /> Đang xử lý...
                    </div>
                ) : (
                    <>
                    <div className="inline-block min-w-full align-middle flex-1 overflow-auto">
                        <table className="min-w-full border-collapse">
                            <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-2 border-b border-r border-gray-200 w-10 text-center bg-gray-100 sticky left-0 z-20">
                                        <input type="checkbox" onChange={handleSelectAll} checked={filteredRecords.length > 0 && selectedIds.size === filteredRecords.length} />
                                    </th>
                                    <th className="p-2 border-b border-r border-gray-200 w-12 text-center bg-gray-100 sticky left-10 z-20">#</th>
                                    {COLUMNS.map(col => (
                                        <th key={col.key} className="p-2 border-b border-r border-gray-200 text-xs font-bold text-gray-600 uppercase text-left whitespace-nowrap" style={{ minWidth: col.width }}>
                                            {col.label}
                                        </th>
                                    ))}
                                    {activeTab === 'scanned' && (
                                        <>
                                            <th className="p-2 border-b border-r border-gray-200 w-32 text-xs font-bold text-gray-600 uppercase">Ngày Scan</th>
                                            <th className="p-2 border-b border-r border-gray-200 w-32 text-xs font-bold text-gray-600 uppercase">Đợt Scan</th>
                                        </>
                                    )}
                                    <th className="p-2 border-b border-gray-200 w-24 text-center bg-gray-100 sticky right-0 z-20">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedRecords.length > 0 ? paginatedRecords.map((r, idx) => (
                                    <tr key={r.id} className={`hover:bg-teal-50/30 group ${selectedIds.has(r.id) ? 'bg-blue-50' : ''}`}>
                                        <td className="p-2 border-r border-gray-200 text-center bg-white sticky left-0 z-10 group-hover:bg-teal-50/30">
                                            <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => handleSelectRow(r.id)} />
                                        </td>
                                        <td className="p-2 border-r border-gray-200 text-center text-gray-500 text-xs bg-white sticky left-10 z-10 group-hover:bg-teal-50/30">
                                            {(currentPage - 1) * itemsPerPage + idx + 1}
                                            {savingId === r.id && <span className="block text-[9px] text-teal-600 animate-pulse">Lưu...</span>}
                                        </td>
                                        {COLUMNS.map(col => {
                                            const isEditing = editingId === r.id;
                                            const isReadOnly = col.readOnly && !isEditing;

                                            return (
                                                <td key={`${r.id}-${col.key}`} className="p-0 border-r border-gray-200 relative">
                                                    {isReadOnly ? (
                                                        <div className="w-full h-full px-2 py-2 text-sm text-gray-700 whitespace-pre-wrap min-h-[40px] flex items-center">
                                                            {r.data?.[col.key] || ''}
                                                        </div>
                                                    ) : col.key === 'so_vao_so' ? (
                                                        <div className="flex h-full">
                                                            <input 
                                                                type="text"
                                                                className="flex-1 px-2 py-2 text-sm bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-teal-500 outline-none"
                                                                value={r.data?.[col.key] || ''}
                                                                onChange={(e) => handleCellChange(r.id, col.key, e.target.value)}
                                                                onBlur={() => handleBlur(r)}
                                                                readOnly={activeTab === 'scanned'} 
                                                            />
                                                            {activeTab === 'all' && (
                                                                <button 
                                                                    onClick={() => handleGetBookNumber(r)}
                                                                    className="px-2 bg-gray-100 hover:bg-blue-100 text-blue-600 border-l border-gray-200 transition-colors"
                                                                    title="Lấy số vào sổ tiếp theo"
                                                                >
                                                                    <Hash size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (col.key === 'ten_chuyen_quyen' || col.key === 'ten_chu_su_dung') ? (
                                                        <textarea
                                                            className="w-full h-full px-2 py-2 text-sm bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-teal-500 outline-none resize-none whitespace-pre-wrap"
                                                            value={r.data?.[col.key] || ''}
                                                            onChange={(e) => handleCellChange(r.id, col.key, e.target.value)}
                                                            onBlur={() => handleBlur(r)}
                                                            readOnly={activeTab === 'scanned'}
                                                            rows={2}
                                                            style={{ minHeight: '40px' }}
                                                        />
                                                    ) : col.key === 'loai_gcn' ? (
                                                        <select
                                                            className="w-full h-full px-2 py-2 text-sm bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-teal-500 outline-none"
                                                            value={r.data?.[col.key] || 'GCN mới'}
                                                            onChange={(e) => {
                                                                handleCellChange(r.id, col.key, e.target.value);
                                                                handleBlur({ ...r, data: { ...r.data, [col.key]: e.target.value } });
                                                            }}
                                                            disabled={activeTab === 'scanned'}
                                                        >
                                                            <option value="GCN mới">GCN mới</option>
                                                            <option value="GCN trang 4">GCN trang 4</option>
                                                        </select>
                                                    ) : (
                                                        <input 
                                                            type={col.type || 'text'}
                                                            className="w-full h-full px-2 py-2 text-sm bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-teal-500 outline-none"
                                                            value={r.data?.[col.key] || ''}
                                                            onChange={(e) => handleCellChange(r.id, col.key, e.target.value)}
                                                            onBlur={() => handleBlur(r)}
                                                            readOnly={activeTab === 'scanned'} 
                                                        />
                                                    )}
                                                </td>
                                            );
                                        })}
                                        {activeTab === 'scanned' && (
                                            <>
                                                <td className="p-2 border-r border-gray-200 text-xs text-gray-600">
                                                    {r.data?.scan_date ? new Date(r.data.scan_date).toLocaleDateString('vi-VN') : ''}
                                                </td>
                                                <td className="p-2 border-r border-gray-200 text-xs text-gray-600">
                                                    {r.data?.scan_batch_id}
                                                </td>
                                            </>
                                        )}
                                        <td className="p-2 text-center bg-white sticky right-0 group-hover:bg-teal-50/30 z-10 border-l border-gray-200 flex gap-1 justify-center">
                                            {activeTab === 'all' && (
                                                <>
                                                    <button 
                                                        onClick={() => toggleEdit(r.id)} 
                                                        className={`p-1.5 rounded transition-colors ${editingId === r.id ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'}`}
                                                        title={editingId === r.id ? "Xong" : "Sửa"}
                                                    >
                                                        {editingId === r.id ? <CheckCircle2 size={14}/> : <Edit size={14}/>}
                                                    </button>
                                                    <button 
                                                        onClick={() => handleMoveToPendingSingle(r.id)} 
                                                        className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded transition-colors" 
                                                        title="Chuyển Scan"
                                                    >
                                                        <Send size={14}/>
                                                    </button>
                                                </>
                                            )}
                                            <button 
                                                onClick={() => handleDelete(r.id)} 
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" 
                                                title="Xóa dòng này"
                                            >
                                                <Trash2 size={14}/>
                                            </button>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={COLUMNS.length + 5} className="p-8 text-center text-gray-400 italic">
                                            {activeTab === 'all' ? 'Chưa có dữ liệu. Nhấn "Import Excel" hoặc "Thêm mới".' : 
                                             activeTab === 'pending' ? 'Chưa có hồ sơ chờ chuyển scan.' :
                                             'Chưa có hồ sơ nào được chuyển Scan.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                        <div className="p-2 border-t border-gray-200 bg-gray-50 flex justify-between items-center sticky bottom-0 z-20">
                            <div className="text-xs text-gray-500">
                                Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredRecords.length)} trong tổng số {filteredRecords.length} dòng
                            </div>
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded text-xs disabled:opacity-50 hover:bg-gray-100"
                                >
                                    Trước
                                </button>
                                <span className="px-2 py-1 text-xs font-medium">Trang {currentPage} / {totalPages}</span>
                                <button 
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-2 py-1 bg-white border border-gray-300 rounded text-xs disabled:opacity-50 hover:bg-gray-100"
                                >
                                    Sau
                                </button>
                            </div>
                        </div>
                    )}
                    </>
                )}
            </div>

            {/* Batch Modal */}
            <BatchModal 
                isOpen={showBatchModal}
                onClose={() => setShowBatchModal(false)}
                onConfirm={handleConfirmBatch}
                records={records}
                selectedCount={selectedIds.size}
            />

            {/* Export Handover Modal */}
            <ExportHandoverModal
                isOpen={showExportHandoverModal}
                onClose={() => setShowExportHandoverModal(false)}
                records={records}
                wards={wards}
            />

            {/* Settings Modal */}
            {showSettingsModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-sm animate-fade-in-up">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 text-lg">Cài đặt số vào sổ</h3>
                            <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Số vào sổ hiện tại (phần số)</label>
                            <input 
                                type="number" 
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                value={currentBookNumber}
                                onChange={(e) => setCurrentBookNumber(parseInt(e.target.value) || 0)}
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                Hệ thống sẽ tự động tăng số này và thêm tiền tố "CN".<br/>
                                Ví dụ: Nếu nhập <strong>{currentBookNumber}</strong>, số tiếp theo sẽ là <strong>CN {(currentBookNumber + 1).toString().padStart(6, '0')}</strong>.
                            </p>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                            <button 
                                onClick={() => {
                                    localStorage.setItem('vaoso_current_book_number', currentBookNumber.toString());
                                    setShowSettingsModal(false);
                                }} 
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold text-sm shadow-sm"
                            >
                                Lưu cài đặt
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Batch Modal Component
interface BatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (batch: number, date: string) => void;
    records: ArchiveRecord[];
    selectedCount: number;
}

const BatchModal: React.FC<BatchModalProps> = ({ isOpen, onClose, onConfirm, records, selectedCount }) => {
    const [mode, setMode] = useState<'new' | 'existing'>('new');
    const [selectedExistingBatch, setSelectedExistingBatch] = useState<string>('');
    const todayStr = new Date().toISOString().split('T')[0];

    const nextBatchInfo = useMemo(() => {
        let maxBatch = 0;
        records.forEach(r => {
            if (r.data?.scan_batch_id && r.data?.scan_date?.startsWith(todayStr)) {
                const b = parseInt(r.data.scan_batch_id);
                if (!isNaN(b) && b > maxBatch) maxBatch = b;
            }
        });
        return { batch: maxBatch + 1, date: todayStr };
    }, [records, todayStr]);

    const historyBatches = useMemo(() => {
        const batches: Record<string, any> = {};
        records.forEach(r => {
            if (r.data?.is_scanned && r.data?.scan_batch_id && r.data?.scan_date) {
                const datePart = r.data.scan_date.split('T')[0];
                const key = `${datePart}_${r.data.scan_batch_id}`;
                if (!batches[key]) {
                    batches[key] = { date: datePart, batch: parseInt(r.data.scan_batch_id), count: 0, fullDate: r.data.scan_date };
                }
                batches[key].count++;
            }
        });
        return Object.values(batches).sort((a: any, b: any) => b.date.localeCompare(a.date) || b.batch - a.batch);
    }, [records]);

    useEffect(() => {
        if (mode === 'existing' && historyBatches.length > 0 && !selectedExistingBatch) {
            const first = historyBatches[0];
            setSelectedExistingBatch(`${first.date}_${first.batch}`);
        }
    }, [mode, historyBatches]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (mode === 'new') {
            onConfirm(nextBatchInfo.batch, nextBatchInfo.date);
        } else {
            if (!selectedExistingBatch) {
                alert('Vui lòng chọn một đợt cũ.');
                return;
            }
            const [datePart, batchNumStr] = selectedExistingBatch.split('_');
            const batchNum = parseInt(batchNumStr);
            const found = historyBatches.find((h: any) => h.date === datePart && h.batch === batchNum);
            
            if (found) {
                onConfirm(found.batch, found.fullDate);
            }
        }
        onClose();
    };

    const formatDate = (d: string) => {
        const parts = d.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in-up flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 text-lg">Tạo Đợt Chuyển Scan</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
                </div>

                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-600 mb-2">
                        Bạn đang tạo đợt cho <strong>{selectedCount}</strong> hồ sơ.
                    </p>

                    {/* Option 1: New Batch */}
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${mode === 'new' ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                        <input 
                            type="radio" 
                            name="batchMode" 
                            checked={mode === 'new'} 
                            onChange={() => setMode('new')}
                            className="mt-1 w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1">
                            <div className="flex items-center gap-2 font-bold text-gray-800">
                                <Plus size={16} className="text-blue-600" /> Tạo đợt mới (Hôm nay)
                            </div>
                            <div className="text-sm text-gray-600 mt-1 pl-6">
                                Đợt tiếp theo: <span className="font-bold text-blue-700">Đợt {nextBatchInfo.batch}</span>
                                <br/>
                                <span className="text-xs text-gray-500">Ngày: {formatDate(todayStr)}</span>
                            </div>
                        </div>
                    </label>

                    {/* Option 2: Existing Batch */}
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${mode === 'existing' ? 'bg-green-50 border-green-500 shadow-sm' : 'bg-white border-gray-200 hover:border-green-300'}`}>
                        <input 
                            type="radio" 
                            name="batchMode" 
                            checked={mode === 'existing'} 
                            onChange={() => setMode('existing')}
                            className="mt-1 w-4 h-4 text-green-600 focus:ring-green-500"
                        />
                        <div className="flex-1">
                            <div className="flex items-center gap-2 font-bold text-gray-800">
                                <History size={16} className="text-green-600" /> Thêm vào đợt cũ
                            </div>
                            
                            <div className="mt-2 pl-6">
                                <select 
                                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-green-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                    disabled={mode !== 'existing'}
                                    value={selectedExistingBatch}
                                    onChange={(e) => setSelectedExistingBatch(e.target.value)}
                                >
                                    {historyBatches.length > 0 ? (
                                        historyBatches.map((h: any) => (
                                            <option key={`${h.date}_${h.batch}`} value={`${h.date}_${h.batch}`}>
                                                Đợt {h.batch} - Ngày {formatDate(h.date)} (Đã có {h.count} HS)
                                            </option>
                                        ))
                                    ) : (
                                        <option value="">Chưa có đợt nào</option>
                                    )}
                                </select>
                            </div>
                        </div>
                    </label>
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 font-medium text-sm">
                        Hủy bỏ
                    </button>
                    <button 
                        onClick={handleConfirm} 
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold text-sm shadow-sm transition-transform active:scale-95"
                    >
                        <CheckCircle2 size={16} /> Xác nhận
                    </button>
                </div>
            </div>
        </div>
    );
};

// Export Handover Modal Component
interface ExportHandoverModalProps {
    isOpen: boolean;
    onClose: () => void;
    records: ArchiveRecord[];
    wards: string[];
}

const ExportHandoverModal: React.FC<ExportHandoverModalProps> = ({ isOpen, onClose, records, wards }) => {
    const [selectedBatch, setSelectedBatch] = useState<string>('');
    const [selectedGcnType, setSelectedGcnType] = useState<string>('GCN mới');
    const [selectedWard, setSelectedWard] = useState<string>('all');

    const historyBatches = useMemo(() => {
        const batches: Record<string, any> = {};
        records.forEach(r => {
            if (r.data?.is_scanned && r.data?.scan_batch_id && r.data?.scan_date) {
                const datePart = r.data.scan_date.split('T')[0];
                const key = `${datePart}_${r.data.scan_batch_id}`;
                if (!batches[key]) {
                    batches[key] = { date: datePart, batch: parseInt(r.data.scan_batch_id), count: 0, fullDate: r.data.scan_date };
                }
                batches[key].count++;
            }
        });
        return Object.values(batches).sort((a: any, b: any) => b.date.localeCompare(a.date) || b.batch - a.batch);
    }, [records]);

    useEffect(() => {
        if (isOpen && historyBatches.length > 0 && !selectedBatch) {
            const first = historyBatches[0];
            setSelectedBatch(`${first.date}_${first.batch}`);
        }
    }, [isOpen, historyBatches]);

    if (!isOpen) return null;

    const formatDate = (d: string) => {
        const parts = d.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    const handleExport = () => {
        if (!selectedBatch) {
            alert('Vui lòng chọn đợt xuất.');
            return;
        }

        const [datePart, batchNumStr] = selectedBatch.split('_');
        const batchNum = parseInt(batchNumStr);
        const batchInfo = historyBatches.find((h: any) => h.date === datePart && h.batch === batchNum);
        
        if (!batchInfo) return;

        // Filter records
        const filtered = records.filter(r => {
            const rBatchId = String(r.data?.scan_batch_id || '');
            const isBatchMatch = r.data?.is_scanned && 
                                 rBatchId === batchNumStr && 
                                 r.data?.scan_date?.startsWith(datePart);
            
            // Default to 'GCN mới' if undefined
            const rType = r.data?.loai_gcn || 'GCN mới';
            const isTypeMatch = rType === selectedGcnType;
            
            const isWardMatch = selectedWard === 'all' || r.data?.dia_danh?.toLowerCase().includes(selectedWard.toLowerCase());
            
            return isBatchMatch && isTypeMatch && isWardMatch;
        });

        if (filtered.length === 0) {
            alert('Không có hồ sơ nào thỏa mãn điều kiện lọc.');
            return;
        }

        // Generate Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([]);

        // Styles
        const styleTitle = { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } };
        const styleItalicCenter = { font: { italic: true, sz: 11 }, alignment: { horizontal: 'center', vertical: 'center' } };
        const styleHeader = { font: { bold: true }, border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, fill: { fgColor: { rgb: "E0E0E0" } } };
        const styleCell = { border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }, alignment: { vertical: 'center', wrapText: true } };
        const styleCellCenter = { ...styleCell, alignment: { ...styleCell.alignment, horizontal: 'center' } };

        const exportDate = formatDate(datePart);

        // Define Headers and Data Mapping based on GCN Type
        let headers: string[] = [];
        let dataRows: any[][] = [];
        let colWidths: any[] = [];

        if (selectedGcnType === 'GCN trang 4') {
            headers = [
                "STT", "Tên Chủ sử dụng", "Địa danh", "Số phát hành", "Ngày ký GCN", 
                "Mã hồ sơ giao dịch", "Loại hồ sơ", "Ngày chủ SD nhận GCN", 
                "Người nhận GCN ký, ghi họ tên", "Ghi chú"
            ];
            colWidths = [
                { wch: 5 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, 
                { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 20 }
            ];
            dataRows = filtered.map((r, idx) => [
                idx + 1,
                r.data?.ten_chu_su_dung || '',
                r.data?.dia_danh || '',
                r.data?.so_phat_hanh || '',
                r.data?.ngay_ky_gcn ? new Date(r.data.ngay_ky_gcn).toLocaleDateString('vi-VN') : '',
                r.data?.ma_ho_so || '',
                r.data?.loai_bien_dong || '',
                '', // Ngày chủ SD nhận GCN
                '', // Người nhận GCN ký
                r.data?.ghi_chu || ''
            ]);
        } else {
            // GCN mới
            headers = [
                "STT", "Số vào sổ", "Tên chủ sử dụng đất", "Số phát hành", "Ngày ký GCN",
                "Mã hồ sơ giao dịch", "Địa danh", "Ngày nhận GCN", 
                "Người nhận GCN ký, ghi rõ họ tên", "Ghi chú"
            ];
            colWidths = [
                { wch: 5 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 12 },
                { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 20 }
            ];
            dataRows = filtered.map((r, idx) => [
                idx + 1,
                r.data?.so_vao_so || '',
                r.data?.ten_chu_su_dung || '',
                r.data?.so_phat_hanh || '',
                r.data?.ngay_ky_gcn ? new Date(r.data.ngay_ky_gcn).toLocaleDateString('vi-VN') : '',
                r.data?.ma_ho_so || '',
                r.data?.dia_danh || '',
                '', // Ngày nhận GCN
                '', // Người nhận GCN ký
                r.data?.ghi_chu || ''
            ]);
        }

        // Row 1: Title
        XLSX.utils.sheet_add_aoa(ws, [[
            "DANH SÁCH BÀN GIAO GCNQSD ĐẤT TỪ VPĐKĐĐ SANG\nBỘ PHẬN TIẾP NHẬN VÀ TRẢ KẾT QUẢ"
        ]], { origin: "A1" });
        
        // Merge Title
        if(!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } });
        ws['A1'].s = styleTitle;

        // Row 2: GCN Type
        const typeCellRef = XLSX.utils.encode_cell({ r: 1, c: headers.length - 1 });
        XLSX.utils.sheet_add_aoa(ws, [[selectedGcnType]], { origin: typeCellRef });
        ws[typeCellRef].s = { font: { bold: true, sz: 12 }, alignment: { horizontal: 'right' } };

        // Row 3: Date - Batch
        XLSX.utils.sheet_add_aoa(ws, [[`Ngày ${exportDate} - Danh sách số ${batchNum}`]], { origin: "A3" });
        ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } });
        ws['A3'].s = styleItalicCenter;

        // Table Header (Row 5)
        XLSX.utils.sheet_add_aoa(ws, [headers], { origin: "A5" });
        headers.forEach((_, i) => {
            const cellRef = XLSX.utils.encode_cell({ r: 4, c: i });
            ws[cellRef].s = styleHeader;
        });

        // Data Rows
        XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A6" });

        // Apply styles to data
        dataRows.forEach((row, rIdx) => {
            row.forEach((_, cIdx) => {
                const cellRef = XLSX.utils.encode_cell({ r: 5 + rIdx, c: cIdx });
                if (cIdx === 0) { // STT centered
                    ws[cellRef].s = styleCellCenter;
                } else {
                    ws[cellRef].s = styleCell;
                }
            });
        });

        // Signature Section
        const lastRowIdx = 5 + dataRows.length;
        const sigRowIdx = lastRowIdx + 2; // Leave 1 empty row

        // Người giao (Left)
        XLSX.utils.sheet_add_aoa(ws, [["Người giao"]], { origin: { r: sigRowIdx, c: 0 } });
        ws['!merges'].push({ s: { r: sigRowIdx, c: 0 }, e: { r: sigRowIdx, c: 2 } }); // Merge A-C
        const sigLeftRef = XLSX.utils.encode_cell({ r: sigRowIdx, c: 0 });
        ws[sigLeftRef].s = { font: { bold: true }, alignment: { horizontal: 'center' } };

        // Người nhận (Center)
        XLSX.utils.sheet_add_aoa(ws, [["Người nhận"]], { origin: { r: sigRowIdx, c: 3 } });
        ws['!merges'].push({ s: { r: sigRowIdx, c: 3 }, e: { r: sigRowIdx, c: 5 } }); // Merge D-F
        const sigCenterRef = XLSX.utils.encode_cell({ r: sigRowIdx, c: 3 });
        ws[sigCenterRef].s = { font: { bold: true }, alignment: { horizontal: 'center' } };

        // Giao nhận 1 cửa (Right)
        XLSX.utils.sheet_add_aoa(ws, [["Giao nhận 1 cửa"]], { origin: { r: sigRowIdx, c: 6 } });
        ws['!merges'].push({ s: { r: sigRowIdx, c: 6 }, e: { r: sigRowIdx, c: headers.length - 1 } }); // Merge G-End
        const sigRightRef = XLSX.utils.encode_cell({ r: sigRowIdx, c: 6 });
        ws[sigRightRef].s = { font: { bold: true }, alignment: { horizontal: 'center' } };

        // Column Widths
        ws['!cols'] = colWidths;

        // Row Heights
        ws['!rows'] = [
            { hpt: 40 }, // Title
            { hpt: 20 }, // Subtitle
            { hpt: 20 }, // Date
            { hpt: 10 }, // Spacer
            { hpt: 25 }  // Header
        ];

        XLSX.utils.book_append_sheet(wb, ws, "DanhSachBanGiao");
        XLSX.writeFile(wb, `DanhSachBanGiao_${selectedGcnType.replace(/ /g, '')}_${datePart}_Dot${batchNum}.xlsx`);
        
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md animate-fade-in-up flex flex-col overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 text-lg">Xuất Danh Sách Bàn Giao</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Batch Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Chọn Đợt Xuất</label>
                        <select 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                            value={selectedBatch}
                            onChange={(e) => setSelectedBatch(e.target.value)}
                        >
                            {historyBatches.map((h: any) => (
                                <option key={`${h.date}_${h.batch}`} value={`${h.date}_${h.batch}`}>
                                    Đợt {h.batch} - Ngày {formatDate(h.date)} ({h.count} HS)
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* GCN Type Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Loại GCN</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="gcnType" 
                                    value="GCN mới" 
                                    checked={selectedGcnType === 'GCN mới'} 
                                    onChange={(e) => setSelectedGcnType(e.target.value)}
                                    className="text-purple-600 focus:ring-purple-500"
                                />
                                <span>GCN mới</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="gcnType" 
                                    value="GCN trang 4" 
                                    checked={selectedGcnType === 'GCN trang 4'} 
                                    onChange={(e) => setSelectedGcnType(e.target.value)}
                                    className="text-purple-600 focus:ring-purple-500"
                                />
                                <span>GCN trang 4</span>
                            </label>
                        </div>
                    </div>

                    {/* Ward Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Xã/Phường</label>
                        <select 
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-purple-500"
                            value={selectedWard}
                            onChange={(e) => setSelectedWard(e.target.value)}
                        >
                            <option value="all">Tất cả</option>
                            {wards.map(w => (
                                <option key={w} value={w}>{w}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 font-medium text-sm">
                        Hủy bỏ
                    </button>
                    <button 
                        onClick={handleExport} 
                        className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-bold text-sm shadow-sm transition-transform active:scale-95"
                    >
                        <FileOutput size={16} /> Xuất Excel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VaoSoView;
