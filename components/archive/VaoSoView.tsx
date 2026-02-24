


import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { User } from '../../types';
import { ArchiveRecord, fetchArchiveRecords, saveArchiveRecord, deleteArchiveRecord, importArchiveRecords, updateArchiveRecordsBatch } from '../../services/apiArchive';
import { Search, Plus, Trash2, Save, BookOpen, Loader2, Upload, FileSpreadsheet, Send, CheckCircle2 } from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';
import * as XLSX from 'xlsx-js-style';

interface VaoSoViewProps {
    currentUser: User;
}

// Định nghĩa các cột
const COLUMNS = [
    { key: 'ma_ho_so', label: 'Mã hồ sơ giao dịch', width: '150px' },
    { key: 'ten_chuyen_quyen', label: 'TÊN CHỦ SỬ DỤNG CHUYỂN QUYỀN', width: '250px' },
    { key: 'ten_chu_su_dung', label: 'TÊN CHỦ SỬ DỤNG', width: '250px' },
    { key: 'loai_bien_dong', label: 'Loại biến động', width: '200px' },
    { key: 'ngay_nhan', label: 'Ngày nhận hồ sơ', width: '140px', type: 'date' },
    { key: 'ngay_tra_kq_1', label: 'Ngày trả kết quả (lần 1)', width: '140px', type: 'date' },
    { key: 'so_to', label: 'Số tờ', width: '80px' },
    { key: 'so_thua', label: 'Số thửa', width: '80px' },
    { key: 'tong_dien_tich', label: 'Tổng diện tích', width: '120px' },
    { key: 'dien_tich_tho_cu', label: 'Diện tích thổ cư', width: '120px' },
    { key: 'dia_danh_so_phat_hanh', label: 'Địa danh Số phát hành', width: '200px' },
    { key: 'chuyen_thue', label: 'Chuyển thuế', width: '150px' },
    { key: 'ghi_chu_sau_thue', label: 'Ghi chú sau chuyển thuế', width: '250px' },
    { key: 'ngay_ky_gcn', label: 'Ngày ký GCN', width: '140px', type: 'date' },
    { key: 'ngay_ky_phieu_tk', label: 'Ngày ký phiếu TK/Chuyển Scan', width: '140px', type: 'date' },
    { key: 'ghi_chu', label: 'GHI CHÚ', width: '250px' }
];

const VaoSoView: React.FC<VaoSoViewProps> = ({ currentUser }) => {
    const [records, setRecords] = useState<ArchiveRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'pending' | 'scanned'>('pending');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        const data = await fetchArchiveRecords('vaoso');
        // Đảm bảo data field luôn tồn tại
        const processed = data.map(r => ({
            ...r,
            data: r.data || {}
        }));
        setRecords(processed);
        setLoading(false);
    };

    const filteredRecords = useMemo(() => {
        let filtered = records;
        
        // Filter by Tab
        if (activeTab === 'pending') {
            filtered = records.filter(r => !r.data?.is_scanned);
        } else {
            filtered = records.filter(r => r.data?.is_scanned);
        }

        if (!searchTerm) return filtered;
        
        const lower = searchTerm.toLowerCase();
        return filtered.filter(r => {
            const d = r.data || {};
            return (
                (d.ma_ho_so || '').toLowerCase().includes(lower) ||
                (d.ten_chu_su_dung || '').toLowerCase().includes(lower) ||
                (d.ten_chuyen_quyen || '').toLowerCase().includes(lower)
            );
        });
    }, [records, searchTerm, activeTab]);

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
                ma_ho_so: '',
                ten_chuyen_quyen: '',
                ten_chu_su_dung: '',
                loai_bien_dong: '',
                ngay_nhan: new Date().toISOString().split('T')[0],
                ngay_tra_kq_1: '',
                so_to: '',
                so_thua: '',
                tong_dien_tich: '',
                dien_tich_tho_cu: '',
                dia_danh_so_phat_hanh: '',
                chuyen_thue: '',
                ghi_chu_sau_thue: '',
                ngay_ky_gcn: '',
                ngay_ky_phieu_tk: '',
                ghi_chu: ''
            }
        };

        await saveArchiveRecord(newRecord);
        await loadData();
    };

    const handleDelete = async (id: string) => {
        if (await confirmAction('Xóa dòng này?')) {
            await deleteArchiveRecord(id);
            setRecords(prev => prev.filter(r => r.id !== id));
            setSelectedIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
        }
    };

    const handleCellChange = (id: string, key: string, value: string) => {
        setRecords(prev => prev.map(r => {
            if (r.id === id) {
                const newData = { ...r.data, [key]: value };
                const updates: any = { data: newData };
                if (key === 'ma_ho_so') updates.so_hieu = value;
                if (key === 'ghi_chu') updates.trich_yeu = value;
                if (key === 'ngay_nhan') updates.ngay_thang = value;
                if (key === 'ten_chu_su_dung') updates.noi_nhan_gui = value;
                
                return { ...r, ...updates };
            }
            return r;
        }));
    };

    const handleBlur = async (record: ArchiveRecord) => {
        setSavingId(record.id);
        await saveArchiveRecord(record);
        setSavingId(null);
    };

    // --- IMPORT EXCEL ---
    const handleImportClick = () => {
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                // Tìm dòng header
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

                const headers = data[headerRowIdx].map((h: any) => String(h).trim().toLowerCase());
                const rows = data.slice(headerRowIdx + 1);
                
                const newRecords: Partial<ArchiveRecord>[] = [];

                // Helper tìm index cột
                const findCol = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));

                const colMap = {
                    ma_ho_so: findCol(['mã hồ sơ', 'mã hs']),
                    ten_chuyen_quyen: findCol(['chuyển quyền', 'bên a']),
                    ten_chu_su_dung: findCol(['tên chủ', 'bên b', 'người sử dụng']),
                    loai_bien_dong: findCol(['biến động', 'loại hồ sơ']),
                    ngay_nhan: findCol(['ngày nhận']),
                    ngay_tra_kq_1: findCol(['trả kết quả', 'hẹn trả']),
                    so_to: findCol(['tờ', 'số tờ']),
                    so_thua: findCol(['thửa', 'số thửa']),
                    tong_dien_tich: findCol(['tổng diện tích', 'dt']),
                    dien_tich_tho_cu: findCol(['thổ cư', 'ont', 'odt']),
                    dia_danh_so_phat_hanh: findCol(['địa danh', 'số phát hành']),
                    chuyen_thue: findCol(['chuyển thuế']),
                    ghi_chu_sau_thue: findCol(['ghi chú sau thuế']),
                    ngay_ky_gcn: findCol(['ký gcn', 'ngày ký giấy']),
                    ngay_ky_phieu_tk: findCol(['phiếu tk', 'chuyển scan']),
                    ghi_chu: findCol(['ghi chú'])
                };

                rows.forEach(row => {
                    if (!row || row.length === 0) return;
                    // Bỏ qua dòng trống
                    if (!row[colMap.ma_ho_so] && !row[colMap.ten_chu_su_dung]) return;

                    const getValue = (idx: number) => {
                        if (idx === -1) return '';
                        let val = row[idx];
                        if (val === undefined || val === null) return '';
                        
                        // Xử lý ngày tháng Excel (số serial -> date string)
                        if (typeof val === 'number' && val > 20000 && val < 60000) { // Check if likely excel date
                             try {
                                 const date = XLSX.SSF.parse_date_code(val);
                                 return `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`;
                             } catch { return String(val); }
                        }
                        return String(val).trim();
                    };

                    const recordData = {
                        ma_ho_so: getValue(colMap.ma_ho_so),
                        ten_chuyen_quyen: getValue(colMap.ten_chuyen_quyen),
                        ten_chu_su_dung: getValue(colMap.ten_chu_su_dung),
                        loai_bien_dong: getValue(colMap.loai_bien_dong),
                        ngay_nhan: getValue(colMap.ngay_nhan),
                        ngay_tra_kq_1: getValue(colMap.ngay_tra_kq_1),
                        so_to: getValue(colMap.so_to),
                        so_thua: getValue(colMap.so_thua),
                        tong_dien_tich: getValue(colMap.tong_dien_tich),
                        dien_tich_tho_cu: getValue(colMap.dien_tich_tho_cu),
                        dia_danh_so_phat_hanh: getValue(colMap.dia_danh_so_phat_hanh),
                        chuyen_thue: getValue(colMap.chuyen_thue),
                        ghi_chu_sau_thue: getValue(colMap.ghi_chu_sau_thue),
                        ngay_ky_gcn: getValue(colMap.ngay_ky_gcn),
                        ngay_ky_phieu_tk: getValue(colMap.ngay_ky_phieu_tk),
                        ghi_chu: getValue(colMap.ghi_chu)
                    };

                    newRecords.push({
                        type: 'vaoso',
                        status: 'completed',
                        so_hieu: recordData.ma_ho_so,
                        trich_yeu: recordData.ghi_chu,
                        ngay_thang: recordData.ngay_nhan || '',
                        noi_nhan_gui: recordData.ten_chu_su_dung,
                        created_by: currentUser.username,
                        data: recordData
                    });
                });

                if (newRecords.length > 0) {
                    setLoading(true);
                    await importArchiveRecords(newRecords);
                    await loadData();
                    alert(`Đã nhập thành công ${newRecords.length} dòng.`);
                } else {
                    alert("Không tìm thấy dữ liệu hợp lệ để nhập.");
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

    // --- CHUYỂN SCAN ---
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allIds = new Set(filteredRecords.map(r => r.id));
            setSelectedIds(allIds);
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectRow = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleTransferScan = async () => {
        if (selectedIds.size === 0) {
            alert("Vui lòng chọn ít nhất một hồ sơ để chuyển Scan.");
            return;
        }

        if (await confirmAction(`Bạn có chắc muốn chuyển ${selectedIds.size} hồ sơ sang danh sách Scan?`)) {
            setLoading(true);
            const batchId = `SCAN_${new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14)}`;
            const scanDate = new Date().toISOString();

            const updates: Partial<ArchiveRecord> = {
                data: {
                    is_scanned: true,
                    scan_batch_id: batchId,
                    scan_date: scanDate
                }
            };

            const success = await updateArchiveRecordsBatch(Array.from(selectedIds), updates);
            if (success) {
                await loadData();
                setSelectedIds(new Set());
                alert("Đã chuyển danh sách Scan thành công!");
            } else {
                alert("Có lỗi xảy ra khi chuyển Scan.");
            }
            setLoading(false);
        }
    };

    // --- XUẤT EXCEL ---
    const handleExportExcel = () => {
        if (filteredRecords.length === 0) {
            alert("Không có dữ liệu để xuất.");
            return;
        }

        const wb = XLSX.utils.book_new();
        
        // Header
        const headers = ["STT", ...COLUMNS.map(c => c.label)];
        if (activeTab === 'scanned') headers.push("Ngày chuyển Scan", "Đợt Scan");

        const data = filteredRecords.map((r, idx) => {
            const row: (string | number)[] = [idx + 1];
            COLUMNS.forEach(col => {
                row.push(r.data?.[col.key] || '');
            });
            if (activeTab === 'scanned') {
                row.push(r.data?.scan_date ? new Date(r.data.scan_date).toLocaleString('vi-VN') : '');
                row.push(r.data?.scan_batch_id || '');
            }
            return row;
        });

        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        
        // Style header
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const address = XLSX.utils.encode_cell({ r: 0, c: C });
            if (!ws[address]) continue;
            ws[address].s = {
                font: { bold: true },
                fill: { fgColor: { rgb: "E0E0E0" } },
                border: { bottom: { style: "thin" } }
            };
        }

        // Auto width (simple approximation)
        ws['!cols'] = headers.map(() => ({ wch: 20 }));

        XLSX.utils.book_append_sheet(wb, ws, "DanhSach");
        const fileName = `DanhSach_${activeTab === 'pending' ? 'ChoScan' : 'DaScan'}_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 items-center bg-gray-50 justify-between">
                <div className="flex items-center gap-4">
                    <div className="font-bold text-gray-700 flex items-center gap-2 text-lg">
                        <BookOpen size={20} className="text-teal-600" /> Sổ Đăng Ký Biến Động
                    </div>
                    
                    {/* Tabs */}
                    <div className="flex bg-gray-200 rounded-lg p-1 gap-1">
                        <button 
                            onClick={() => setActiveTab('pending')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'pending' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
                        >
                            Chờ chuyển Scan
                        </button>
                        <button 
                            onClick={() => setActiveTab('scanned')}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'scanned' ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
                        >
                            Đã chuyển Scan
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" 
                            placeholder="Tìm kiếm..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                        />
                    </div>
                    
                    {activeTab === 'pending' && (
                        <>
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
                            <button onClick={handleImportClick} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 shadow-sm">
                                <Upload size={16}/> Import Excel
                            </button>
                            <button onClick={handleAddNew} className="flex items-center gap-2 bg-teal-600 text-white px-3 py-2 rounded-lg font-bold text-sm hover:bg-teal-700 shadow-sm">
                                <Plus size={16}/> Thêm mới
                            </button>
                            {selectedIds.size > 0 && (
                                <button onClick={handleTransferScan} className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 shadow-sm animate-pulse">
                                    <Send size={16}/> Chuyển Scan ({selectedIds.size})
                                </button>
                            )}
                        </>
                    )}

                    <button onClick={handleExportExcel} className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg font-bold text-sm hover:bg-green-700 shadow-sm">
                        <FileSpreadsheet size={16}/> Xuất Excel
                    </button>
                </div>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto relative">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-gray-500 gap-2">
                        <Loader2 className="animate-spin" /> Đang xử lý...
                    </div>
                ) : (
                    <div className="inline-block min-w-full align-middle">
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
                                    <th className="p-2 border-b border-gray-200 w-16 text-center bg-gray-100 sticky right-0 z-20">Xóa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredRecords.length > 0 ? filteredRecords.map((r, idx) => (
                                    <tr key={r.id} className={`hover:bg-teal-50/30 group ${selectedIds.has(r.id) ? 'bg-blue-50' : ''}`}>
                                        <td className="p-2 border-r border-gray-200 text-center bg-white sticky left-0 z-10 group-hover:bg-teal-50/30">
                                            <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => handleSelectRow(r.id)} />
                                        </td>
                                        <td className="p-2 border-r border-gray-200 text-center text-gray-500 text-xs bg-white sticky left-10 z-10 group-hover:bg-teal-50/30">
                                            {idx + 1}
                                            {savingId === r.id && <span className="block text-[9px] text-teal-600 animate-pulse">Lưu...</span>}
                                        </td>
                                        {COLUMNS.map(col => (
                                            <td key={`${r.id}-${col.key}`} className="p-0 border-r border-gray-200 relative">
                                                <input 
                                                    type={col.type || 'text'}
                                                    className="w-full h-full px-2 py-2 text-sm bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-teal-500 outline-none"
                                                    value={r.data?.[col.key] || ''}
                                                    onChange={(e) => handleCellChange(r.id, col.key, e.target.value)}
                                                    onBlur={() => handleBlur(r)}
                                                    readOnly={activeTab === 'scanned'} // Đã scan thì không sửa trực tiếp (hoặc tùy nhu cầu)
                                                />
                                            </td>
                                        ))}
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
                                        <td className="p-2 text-center bg-white sticky right-0 group-hover:bg-teal-50/30 z-10 border-l border-gray-200">
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
                                            {activeTab === 'pending' ? 'Chưa có dữ liệu. Nhấn "Import Excel" hoặc "Thêm mới".' : 'Chưa có hồ sơ nào được chuyển Scan.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VaoSoView;

