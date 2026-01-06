
import React, { useState, useEffect, useMemo } from 'react';
import { User as UserType, RecordFile } from '../../types';
import { fetchRecords } from '../../services/apiRecords';
import { ChinhLyRecord, fetchChinhLyRecords, saveChinhLyRecord, deleteChinhLyRecord } from '../../services/apiUtilities';
import { NotifyFunction } from '../../components/UtilitiesView';
import { Search, Plus, Save, List, Edit, Trash2, FileSpreadsheet, PlusCircle, X, Layers, Copy, CheckSquare, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';
import * as XLSX from 'xlsx-js-style';

interface ChinhLyBienDongTabProps {
    currentUser: UserType;
    notify: NotifyFunction;
}

// Danh sách Xã/Phường giới hạn theo yêu cầu
const CHON_THANH_WARDS = [
    "phường Chơn Thành",
    "phường Minh Hưng",
    "xã Nha Bích"
];

// Dữ liệu dùng chung cho cả nhóm (Header)
interface CommonData {
    XA: string;
    // TEN_CSD: string; // Đã bỏ theo yêu cầu
    SO_HD: string; // Key để gom nhóm
    CAN_CU_PHAP_LY: string;
    GHI_CHU: string;
}

// Dữ liệu chi tiết từng dòng (Detail)
interface DetailData {
    // Trước BĐ
    TO_CU: string; THUA_CU: string; DT_CU: string; LOAI_DAT_CU: string;
    // Sau BĐ
    TO_MOI: string; THUA_TAM: string; THUA_CHINH_THUC: string; DT_MOI: string; LOAI_DAT_MOI: string;
    
    TONG_DT: string; // Tổng DT thường gắn với từng thửa hoặc tổng chung, ở đây để ở detail cho linh hoạt
}

const DEFAULT_COMMON: CommonData = {
    XA: '', SO_HD: '', 
    CAN_CU_PHAP_LY: 'Phiếu yêu cầu nộp hồ sơ GQ TTHC', GHI_CHU: ''
};

const DEFAULT_DETAIL: DetailData = {
    TO_CU: '', THUA_CU: '', DT_CU: '', LOAI_DAT_CU: '',
    TO_MOI: '', THUA_TAM: '', THUA_CHINH_THUC: '', DT_MOI: '', LOAI_DAT_MOI: '',
    TONG_DT: ''
};

const ChinhLyBienDongTab: React.FC<ChinhLyBienDongTabProps> = ({ currentUser, notify }) => {
    const [mode, setMode] = useState<'create' | 'list'>('list');
    const [records, setRecords] = useState<RecordFile[]>([]);
    const [savedList, setSavedList] = useState<ChinhLyRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // State Form
    const [commonData, setCommonData] = useState<CommonData>(DEFAULT_COMMON);
    const [detailRows, setDetailRows] = useState<DetailData[]>([ { ...DEFAULT_DETAIL } ]);
    
    const [searchQuery, setSearchQuery] = useState(''); 
    const [isSaving, setIsSaving] = useState(false);
    
    // State để quản lý việc sửa (Nếu sửa 1 dòng trong nhóm, ta load cả nhóm lên để sửa)
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [appRecords, utilityRecords] = await Promise.all([
            fetchRecords(),
            fetchChinhLyRecords()
        ]);
        setRecords(appRecords);
        setSavedList(utilityRecords);
    };

    // --- LOGIC FORM ---
    const handleAddDetailRow = () => {
        setDetailRows(prev => [...prev, { ...DEFAULT_DETAIL }]);
    };

    const handleRemoveDetailRow = (index: number) => {
        if (detailRows.length === 1) {
            setDetailRows([{ ...DEFAULT_DETAIL }]); // Clear nếu là dòng cuối
        } else {
            setDetailRows(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleDetailChange = (index: number, field: keyof DetailData, value: string) => {
        const newRows = [...detailRows];
        newRows[index] = { ...newRows[index], [field]: value };
        setDetailRows(newRows);
    };

    const handleSearchAndFill = () => {
        if (!searchQuery.trim()) return;
        const found = records.find(r => r.code.toLowerCase() === searchQuery.toLowerCase().trim());
        
        if (found) {
            // Fill Common Info
            setCommonData(prev => ({
                ...prev,
                // TEN_CSD: found.customerName, // Bỏ điền tên
                XA: found.ward ? found.ward : '', // Giữ nguyên tên xã/phường đầy đủ
                SO_HD: found.code
            }));

            // Fill Detail (Vào dòng cuối cùng hoặc dòng mới)
            const newDetail: DetailData = {
                ...DEFAULT_DETAIL,
                TO_CU: found.mapSheet || '',
                THUA_CU: found.landPlot || '',
                DT_CU: found.area ? found.area.toString() : '',
                DT_MOI: found.area ? found.area.toString() : '',
                TONG_DT: found.area ? found.area.toString() : '',
                TO_MOI: found.mapSheet || '',
            };

            // Nếu dòng cuối đang trống thì điền đè, không thì thêm mới
            const lastIdx = detailRows.length - 1;
            const isLastEmpty = !detailRows[lastIdx].TO_CU && !detailRows[lastIdx].THUA_CU;
            
            if (isLastEmpty) {
                const updated = [...detailRows];
                updated[lastIdx] = newDetail;
                setDetailRows(updated);
            } else {
                setDetailRows(prev => [...prev, newDetail]);
            }
            
            notify(`Đã lấy dữ liệu từ hồ sơ: ${found.code}`, 'success');
            setSearchQuery('');
        } else {
            notify('Không tìm thấy mã hồ sơ này.', 'error');
        }
    };

    // --- LOGIC TÍNH TOÁN DIỆN TÍCH ---
    const calculateTotals = useMemo(() => {
        const totalBefore = detailRows.reduce((sum, row) => sum + (parseFloat(row.DT_CU) || 0), 0);
        const totalAfter = detailRows.reduce((sum, row) => sum + (parseFloat(row.DT_MOI) || 0), 0);
        // Làm tròn 2 chữ số thập phân để so sánh
        const diff = Math.abs(totalBefore - totalAfter);
        const isMismatch = diff > 0.1; // Cho phép sai số nhỏ do làm tròn (0.1m2)

        return {
            totalBefore: parseFloat(totalBefore.toFixed(2)),
            totalAfter: parseFloat(totalAfter.toFixed(2)),
            isMismatch,
            diff: parseFloat(diff.toFixed(2))
        };
    }, [detailRows]);

    const handleSaveGroup = async () => {
        if (!commonData.XA) { notify("Vui lòng chọn Xã/Phường.", 'error'); return; }
        
        setIsSaving(true);

        // KIỂM TRA TỔNG DIỆN TÍCH
        if (calculateTotals.isMismatch) {
            const warningMsg = `CẢNH BÁO SAI LỆCH DIỆN TÍCH!\n\n` +
                `- Tổng diện tích TRƯỚC biến động: ${calculateTotals.totalBefore} m²\n` +
                `- Tổng diện tích SAU biến động: ${calculateTotals.totalAfter} m²\n` +
                `- Chênh lệch: ${calculateTotals.diff} m²\n\n` +
                `Bạn có chắc chắn muốn lưu không?`;
            
            if (!(await confirmAction(warningMsg, 'Xác nhận lưu dữ liệu lệch'))) {
                setIsSaving(false);
                return;
            }
        }
        
        // 1. Nếu đang sửa, xóa các record cũ thuộc nhóm này (client-side filter để lấy IDs)
        if (editingGroupId) {
            const oldRecords = savedList.filter(r => r.data.SO_HD === editingGroupId);
            for (const rec of oldRecords) {
                await deleteChinhLyRecord(rec.id);
            }
        }

        // 2. Insert các dòng mới
        let successCount = 0;
        // Filter empty rows
        const validRows = detailRows.filter(r => r.TO_CU || r.THUA_CU || r.TO_MOI || r.THUA_CHINH_THUC);
        
        if (validRows.length === 0) {
            setIsSaving(false);
            notify("Vui lòng nhập ít nhất 1 dòng chi tiết thửa đất.", 'error');
            return;
        }

        for (const row of validRows) {
            const recordData = {
                ...commonData,
                ...row
            };
            
            const recordToSave: Partial<ChinhLyRecord> = {
                customer_name: `${commonData.XA} - ${commonData.SO_HD}`, // Dùng Xã + HĐ làm tên gợi nhớ
                data: recordData,
                created_by: currentUser.name
            };
            
            await saveChinhLyRecord(recordToSave);
            successCount++;
        }

        setIsSaving(false);
        await loadData();
        notify(`Đã lưu thành công ${successCount} dòng!`, 'success');
        setMode('list');
        handleReset();
    };

    const handleEditGroup = (soHD: string) => {
        // Tìm tất cả records có cùng SO_HD
        const groupRecords = savedList.filter(r => r.data.SO_HD === soHD);
        
        if (groupRecords.length === 0) return;

        const first = groupRecords[0].data;
        
        setCommonData({
            XA: first.XA || '',
            // TEN_CSD: first.TEN_CSD || '',
            SO_HD: first.SO_HD || '',
            CAN_CU_PHAP_LY: first.CAN_CU_PHAP_LY || '',
            GHI_CHU: first.GHI_CHU || ''
        });

        const details: DetailData[] = groupRecords.map(r => ({
            TO_CU: r.data.TO_CU, THUA_CU: r.data.THUA_CU, DT_CU: r.data.DT_CU, LOAI_DAT_CU: r.data.LOAI_DAT_CU,
            TO_MOI: r.data.TO_MOI, THUA_TAM: r.data.THUA_TAM, THUA_CHINH_THUC: r.data.THUA_CHINH_THUC, DT_MOI: r.data.DT_MOI, LOAI_DAT_MOI: r.data.LOAI_DAT_MOI,
            TONG_DT: r.data.TONG_DT
        }));

        setDetailRows(details);
        setEditingGroupId(soHD);
        setMode('create');
    };

    const handleDeleteGroup = async (soHD: string) => {
        const groupRecords = savedList.filter(r => r.data.SO_HD === soHD);
        if (await confirmAction(`Xóa toàn bộ ${groupRecords.length} dòng thuộc hợp đồng ${soHD}?`)) {
            for (const rec of groupRecords) {
                await deleteChinhLyRecord(rec.id);
            }
            await loadData();
            notify("Đã xóa nhóm hồ sơ.", 'success');
        }
    };

    const handleReset = () => {
        setEditingGroupId(null);
        setCommonData(DEFAULT_COMMON);
        setDetailRows([{ ...DEFAULT_DETAIL }]);
        setSearchQuery('');
    };

    // --- GROUPING LOGIC FOR LIST VIEW ---
    const groupedList = useMemo(() => {
        // 1. Filter
        let list = savedList;
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            list = list.filter(item => 
                (item.customer_name || '').toLowerCase().includes(lower) ||
                (item.data.XA || '').toLowerCase().includes(lower) ||
                (item.data.SO_HD || '').toLowerCase().includes(lower)
            );
        }

        // 2. Sort by SO_HD (để gom nhóm)
        // Những dòng có cùng SO_HD sẽ nằm cạnh nhau
        list.sort((a, b) => {
            const hdA = a.data.SO_HD || '';
            const hdB = b.data.SO_HD || '';
            // Nếu không có số HD, xếp xuống dưới
            if (!hdA && !hdB) return 0;
            if (!hdA) return 1;
            if (!hdB) return -1;
            return hdA.localeCompare(hdB);
        });

        return list;
    }, [savedList, searchTerm]);

    // Hàm tính toán rowSpan
    // Trả về số dòng cần span nếu là dòng đầu tiên của nhóm, trả về 0 nếu là dòng tiếp theo (để ẩn)
    const getRowSpan = (index: number, field: string) => {
        const current = groupedList[index];
        const prev = groupedList[index - 1];
        
        // Chỉ gộp khi có SO_HD. Nếu không có SO_HD, không gộp.
        if (!current.data.SO_HD) return 1;

        if (prev && prev.data.SO_HD === current.data.SO_HD) {
            return 0; // Đã được gộp vào dòng trên
        }

        // Đếm xem có bao nhiêu dòng tiếp theo cùng SO_HD
        let count = 1;
        for (let i = index + 1; i < groupedList.length; i++) {
            if (groupedList[i].data.SO_HD === current.data.SO_HD) {
                count++;
            } else {
                break;
            }
        }
        return count;
    };
    
    // Tính STT nhóm (Group Index) thay vì Row Index
    const getGroupSTT = (index: number) => {
        const current = groupedList[index];
        if (!current.data.SO_HD) return index + 1; // Fallback

        // Tìm index của dòng đầu tiên trong nhóm này
        let firstIdx = index;
        while(firstIdx > 0 && groupedList[firstIdx - 1].data.SO_HD === current.data.SO_HD) {
            firstIdx--;
        }
        
        // Đếm số nhóm ĐỘC LẬP đứng trước firstIdx
        let groupCount = 0;
        let i = 0;
        while (i < firstIdx) {
            groupCount++;
            const hd = groupedList[i].data.SO_HD;
            if (hd) {
                // Skip qua các dòng cùng nhóm
                while (i < firstIdx && groupedList[i].data.SO_HD === hd) i++;
            } else {
                i++;
            }
        }
        return groupCount + 1;
    }

    // --- EXCEL EXPORT (MERGED) ---
    const handleExportExcel = () => {
        if (groupedList.length === 0) { notify("Danh sách trống.", 'error'); return; }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([]);

        const header1 = ["STT", "Xã, Phường", "Thông tin trước biến động", "", "", "", "Thông tin sau biến động", "", "", "", "", "Tổng DT (m2)", "Căn cứ pháp lý", "Số HĐ", "Ghi chú"];
        const header2 = ["", "", "Tờ BĐĐC", "Số thửa", "Diện tích (m2)", "Loại đất", "Tờ BĐĐC", "Số thửa tạm", "Số thửa chính thức", "Diện tích (m2)", "Loại đất", "", "", "", ""];

        // Add Header
        XLSX.utils.sheet_add_aoa(ws, [
            ["DANH SÁCH CUNG CẤP SỐ THỬA CHÍNH THỨC"],
            [""],
            header1,
            header2
        ], { origin: "A1" });

        // Build Data Rows & Merges
        const dataRows: any[] = [];
        const merges: any[] = [];
        
        // Base merges for Header
        merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 14 } }); // Title
        merges.push({ s: { r: 2, c: 0 }, e: { r: 3, c: 0 } }); // STT
        merges.push({ s: { r: 2, c: 1 }, e: { r: 3, c: 1 } }); // Xã
        merges.push({ s: { r: 2, c: 2 }, e: { r: 2, c: 5 } }); // Trước BĐ
        merges.push({ s: { r: 2, c: 6 }, e: { r: 2, c: 10 } }); // Sau BĐ
        merges.push({ s: { r: 2, c: 11 }, e: { r: 3, c: 11 } }); // Tổng DT
        merges.push({ s: { r: 2, c: 12 }, e: { r: 3, c: 12 } }); // Căn cứ
        merges.push({ s: { r: 2, c: 13 }, e: { r: 3, c: 13 } }); // Số HĐ
        merges.push({ s: { r: 2, c: 14 }, e: { r: 3, c: 14 } }); // Ghi chú

        let currentRow = 4; // Data starts at row index 4 (A5)

        // Loop through groupedList to build rows and merges
        for (let i = 0; i < groupedList.length; i++) {
            const item = groupedList[i];
            const d = item.data;
            const span = getRowSpan(i, 'SO_HD');
            
            dataRows.push([
                span > 0 ? getGroupSTT(i) : '', // STT chỉ hiện ở dòng đầu
                span > 0 ? d.XA : '',           // Xã
                d.TO_CU, d.THUA_CU, d.DT_CU, d.LOAI_DAT_CU,
                d.TO_MOI, d.THUA_TAM, d.THUA_CHINH_THUC, d.DT_MOI, d.LOAI_DAT_MOI,
                d.TONG_DT,
                span > 0 ? d.CAN_CU_PHAP_LY : '', // Căn cứ
                span > 0 ? d.SO_HD : '',          // Số HĐ
                span > 0 ? d.GHI_CHU : ''         // Ghi chú
            ]);

            // Add merges for Common Columns if span > 1
            if (span > 1) {
                // Cột STT (0), Xã (1), Tổng DT (11) - nếu muốn gộp, Căn cứ (12), Số HĐ (13), Ghi chú (14)
                [0, 1, 12, 13, 14].forEach(colIdx => {
                    merges.push({ s: { r: currentRow, c: colIdx }, e: { r: currentRow + span - 1, c: colIdx } });
                });
            }
            currentRow++;
        }

        XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: "A5" });
        ws['!merges'] = merges;

        // Styling
        const headerStyle = { font: { bold: true, sz: 11, name: "Times New Roman" }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }, fill: { fgColor: { rgb: "E0E0E0" } } };
        const cellStyle = { font: { sz: 11, name: "Times New Roman" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }, alignment: { vertical: "center", wrapText: true } };
        const centerStyle = { ...cellStyle, alignment: { ...cellStyle.alignment, horizontal: "center" } };

        // Apply Header Styles
        for (let r = 2; r <= 3; r++) {
            for (let c = 0; c <= 14; c++) {
                const ref = XLSX.utils.encode_cell({ r, c });
                if (!ws[ref]) ws[ref] = { v: "", t: "s" };
                ws[ref].s = headerStyle;
            }
        }

        // Apply Data Styles
        for (let r = 4; r < 4 + dataRows.length; r++) {
            for (let c = 0; c <= 14; c++) {
                const ref = XLSX.utils.encode_cell({ r, c });
                if (!ws[ref]) ws[ref] = { v: "", t: "s" };
                // Center align specific columns: STT, Tờ, Thửa
                if ([0, 2, 3, 6, 7, 8, 13].includes(c)) ws[ref].s = centerStyle;
                else ws[ref].s = cellStyle;
            }
        }

        ws['!cols'] = [
            { wch: 5 }, { wch: 15 }, 
            { wch: 6 }, { wch: 6 }, { wch: 8 }, { wch: 8 }, 
            { wch: 6 }, { wch: 6 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, 
            { wch: 10 }, { wch: 25 }, { wch: 12 }, { wch: 20 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, "DS_ChinhLy");
        XLSX.writeFile(wb, `DS_ChinhLy_BienDong_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const commonInputClass = "w-full border border-gray-300 rounded px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white";
    const detailInputClass = "w-full border-none bg-transparent px-1 py-2 text-sm text-center focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none h-full";

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9]">
            {/* SUB-HEADER TABS */}
            <div className="flex items-center gap-2 px-4 pt-2 border-b border-gray-200 bg-white shadow-sm shrink-0 z-20">
                <button onClick={() => { setMode('create'); handleReset(); }} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors ${mode === 'create' ? 'border-orange-600 text-orange-600 bg-orange-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <Plus size={16} /> Nhập liệu
                </button>
                <button onClick={() => setMode('list')} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors ${mode === 'list' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <List size={16} /> Danh sách ({savedList.length})
                </button>
            </div>

            <div className="flex-1 overflow-hidden p-4">
                {mode === 'create' ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden max-w-[1600px] mx-auto">
                        
                        {/* 1. HEADER: COMMON INFO */}
                        <div className="p-4 bg-gray-50 border-b border-gray-200">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <Layers size={18} className="text-blue-600"/> 
                                    {editingGroupId ? `Đang chỉnh sửa hồ sơ: ${editingGroupId}` : 'Thông tin chung (Nhóm)'}
                                </h3>
                                
                                {/* Quick Search & Fill */}
                                {!editingGroupId && (
                                    <div className="flex gap-2">
                                        <div className="relative">
                                            <input 
                                                className="pl-8 pr-3 py-1.5 text-sm border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" 
                                                placeholder="Mã HS..."
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleSearchAndFill()}
                                            />
                                            <Search size={14} className="absolute left-2.5 top-2.5 text-blue-400" />
                                        </div>
                                        <button onClick={handleSearchAndFill} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-200">Điền</button>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Xã / Phường *</label>
                                    <select 
                                        className={commonInputClass}
                                        value={commonData.XA}
                                        onChange={e => setCommonData({...commonData, XA: e.target.value})}
                                    >
                                        <option value="">-- Chọn Xã/Phường --</option>
                                        {CHON_THANH_WARDS.map(w => (
                                            <option key={w} value={w}>{w}</option>
                                        ))}
                                    </select>
                                </div>
                                {/* ĐÃ BỎ Ô TÊN CHỦ */}
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Số Hợp đồng / Mã HS *</label>
                                    <input className={`${commonInputClass} font-mono font-bold text-blue-700`} value={commonData.SO_HD} onChange={e => setCommonData({...commonData, SO_HD: e.target.value})} placeholder="0902/HĐ..." />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Căn cứ pháp lý</label>
                                    <input className={commonInputClass} value={commonData.CAN_CU_PHAP_LY} onChange={e => setCommonData({...commonData, CAN_CU_PHAP_LY: e.target.value})} />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ghi chú</label>
                                    <input className={commonInputClass} value={commonData.GHI_CHU} onChange={e => setCommonData({...commonData, GHI_CHU: e.target.value})} />
                                </div>
                            </div>
                        </div>

                        {/* 2. BODY: DETAIL LIST TABLE */}
                        <div className="flex-1 overflow-auto bg-white relative">
                            <table className="w-full border-collapse min-w-[1000px]">
                                <thead className="bg-gray-100 text-xs font-bold text-gray-600 uppercase sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-2 border w-10 bg-gray-200">#</th>
                                        <th colSpan={4} className="p-2 border text-center bg-blue-50 text-blue-800">Thông tin Trước Biến Động</th>
                                        <th colSpan={5} className="p-2 border text-center bg-green-50 text-green-800">Thông tin Sau Biến Động</th>
                                        <th className="p-2 border w-24 bg-gray-200">Tổng DT</th>
                                        <th className="p-2 border w-10 bg-gray-200">Xóa</th>
                                    </tr>
                                    <tr>
                                        <th className="bg-gray-200 border"></th>
                                        <th className="p-2 border w-16 text-center bg-blue-50">Tờ</th>
                                        <th className="p-2 border w-16 text-center bg-blue-50">Thửa</th>
                                        <th className="p-2 border w-20 text-center bg-blue-50">DT (m2)</th>
                                        <th className="p-2 border w-20 text-center bg-blue-50">Loại đất</th>
                                        
                                        <th className="p-2 border w-16 text-center bg-green-50">Tờ</th>
                                        <th className="p-2 border w-16 text-center bg-green-50">Thửa Tạm</th>
                                        <th className="p-2 border w-20 text-center bg-green-50 text-green-700">Thửa CT</th>
                                        <th className="p-2 border w-20 text-center bg-green-50">DT (m2)</th>
                                        <th className="p-2 border w-20 text-center bg-green-50">Loại đất</th>
                                        <th className="bg-gray-200 border"></th>
                                        <th className="bg-gray-200 border"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {detailRows.map((row, idx) => (
                                        <tr key={idx} className="border-b border-gray-200 hover:bg-blue-50/20">
                                            <td className="border text-center text-gray-400 text-xs bg-gray-50">{idx + 1}</td>
                                            
                                            {/* TRƯỚC */}
                                            <td className="border p-0"><input className={detailInputClass} value={row.TO_CU} onChange={e => handleDetailChange(idx, 'TO_CU', e.target.value)} /></td>
                                            <td className="border p-0"><input className={detailInputClass} value={row.THUA_CU} onChange={e => handleDetailChange(idx, 'THUA_CU', e.target.value)} /></td>
                                            <td className="border p-0"><input className={detailInputClass} value={row.DT_CU} onChange={e => handleDetailChange(idx, 'DT_CU', e.target.value)} /></td>
                                            <td className="border p-0"><input className={detailInputClass} value={row.LOAI_DAT_CU} onChange={e => handleDetailChange(idx, 'LOAI_DAT_CU', e.target.value)} /></td>

                                            {/* SAU */}
                                            <td className="border p-0"><input className={detailInputClass} value={row.TO_MOI} onChange={e => handleDetailChange(idx, 'TO_MOI', e.target.value)} /></td>
                                            <td className="border p-0"><input className={detailInputClass} value={row.THUA_TAM} onChange={e => handleDetailChange(idx, 'THUA_TAM', e.target.value)} /></td>
                                            <td className="border p-0"><input className={`${detailInputClass} font-bold text-green-700 bg-green-50/30`} value={row.THUA_CHINH_THUC} onChange={e => handleDetailChange(idx, 'THUA_CHINH_THUC', e.target.value)} /></td>
                                            <td className="border p-0"><input className={detailInputClass} value={row.DT_MOI} onChange={e => handleDetailChange(idx, 'DT_MOI', e.target.value)} /></td>
                                            <td className="border p-0"><input className={detailInputClass} value={row.LOAI_DAT_MOI} onChange={e => handleDetailChange(idx, 'LOAI_DAT_MOI', e.target.value)} /></td>

                                            <td className="border p-0"><input className={`${detailInputClass} font-bold`} value={row.TONG_DT} onChange={e => handleDetailChange(idx, 'TONG_DT', e.target.value)} /></td>
                                            
                                            <td className="border text-center">
                                                <button onClick={() => handleRemoveDetailRow(idx)} className="text-gray-300 hover:text-red-500 p-1"><X size={16}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td colSpan={12} className="p-2 border-t bg-gray-50">
                                            <button onClick={handleAddDetailRow} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 mx-auto px-3 py-1 bg-white border border-blue-200 rounded-full shadow-sm hover:shadow">
                                                <Plus size={14}/> Thêm dòng thửa đất
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                                {/* FOOTER: HIỂN THỊ TỔNG CỘNG ĐỂ KIỂM TRA */}
                                <tfoot>
                                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-300 text-sm">
                                        <td colSpan={3} className="p-2 text-right text-gray-600 border-r border-gray-200">Tổng cộng Trước:</td>
                                        <td className={`p-2 text-center border-r border-gray-200 ${calculateTotals.isMismatch ? 'text-red-600' : 'text-blue-600'}`}>
                                            {calculateTotals.totalBefore}
                                        </td>
                                        <td className="p-2 border-r border-gray-200"></td>
                                        <td colSpan={3} className="p-2 text-right text-gray-600 border-r border-gray-200">Tổng cộng Sau:</td>
                                        <td className={`p-2 text-center border-r border-gray-200 ${calculateTotals.isMismatch ? 'text-red-600' : 'text-green-600'}`}>
                                            {calculateTotals.totalAfter}
                                        </td>
                                        <td colSpan={2} className="p-2 text-left">
                                            {calculateTotals.isMismatch ? (
                                                <span className="text-xs text-red-500 flex items-center gap-1 animate-pulse">
                                                    <AlertTriangle size={14}/> Lệch {calculateTotals.diff} m²
                                                </span>
                                            ) : (
                                                <span className="text-xs text-green-600 flex items-center gap-1">
                                                    <CheckCircle2 size={14}/> Khớp
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* 3. FOOTER: ACTIONS */}
                        <div className="p-4 border-t border-gray-200 bg-white flex justify-between items-center shrink-0">
                            <button onClick={() => { setMode('list'); handleReset(); }} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium text-sm">Hủy bỏ</button>
                            <button onClick={handleSaveGroup} disabled={isSaving} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md flex items-center gap-2">
                                <Save size={18}/> {editingGroupId ? 'Cập nhật Nhóm' : 'Lưu Danh Sách'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden">
                        {/* List Toolbar */}
                        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input 
                                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none" 
                                    placeholder="Tìm kiếm..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 shadow-sm">
                                <FileSpreadsheet size={16} /> Xuất Excel
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead className="bg-gray-100 text-gray-600 font-bold sticky top-0 shadow-sm z-10 text-xs uppercase">
                                    <tr>
                                        <th className="p-3 border-b text-center w-12 border-r bg-gray-200">STT</th>
                                        <th className="p-3 border-b border-r w-[150px] bg-white">Xã / Phường</th>
                                        <th className="p-3 border-b border-r min-w-[200px] bg-white">Thông tin Trước BĐ</th>
                                        <th className="p-3 border-b border-r min-w-[200px] bg-white">Thông tin Sau BĐ</th>
                                        <th className="p-3 border-b border-r w-[80px] bg-white">Tổng DT</th>
                                        <th className="p-3 border-b border-r w-[150px] bg-white">Căn cứ pháp lý</th>
                                        <th className="p-3 border-b border-r w-[100px] bg-white">Số HĐ</th>
                                        <th className="p-3 border-b border-r w-[150px] bg-white">Ghi chú</th>
                                        <th className="p-3 border-b w-[80px] text-center bg-gray-200 sticky right-0">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {groupedList.length > 0 ? groupedList.map((item, idx) => {
                                        // Logic Merge Rows
                                        const rowSpan = getRowSpan(idx, 'SO_HD');
                                        const shouldRenderCommon = rowSpan > 0;
                                        const isFirstInGroup = shouldRenderCommon; // Dòng đầu của nhóm
                                        
                                        // Chỉ hiện border-top đậm cho dòng đầu nhóm
                                        const rowClass = isFirstInGroup ? "border-t-2 border-gray-300" : "hover:bg-blue-50/30";

                                        return (
                                            <tr key={item.id} className={rowClass}>
                                                {/* COMMON COLUMNS (Render with RowSpan) */}
                                                {shouldRenderCommon && (
                                                    <td className="p-3 text-center text-gray-500 border-r align-middle bg-white" rowSpan={rowSpan}>
                                                        {getGroupSTT(idx)}
                                                    </td>
                                                )}
                                                
                                                {shouldRenderCommon && (
                                                    <td className="p-3 font-bold text-gray-800 border-r align-middle bg-white" rowSpan={rowSpan}>
                                                        {item.data.XA}
                                                    </td>
                                                )}

                                                {/* DETAIL COLUMNS (Always render) */}
                                                <td className="p-2 border-r text-xs">
                                                    {/* ĐÃ BỎ HIỂN THỊ TÊN CHỦ */}
                                                    <div>Tờ: <b>{item.data.TO_CU}</b> - Thửa: <b>{item.data.THUA_CU}</b></div>
                                                    <div>DT: {item.data.DT_CU} ({item.data.LOAI_DAT_CU})</div>
                                                </td>
                                                <td className="p-2 border-r text-xs">
                                                    <div>Tờ: <b>{item.data.TO_MOI}</b></div>
                                                    <div>Tạm: {item.data.THUA_TAM} <span className="text-gray-300">|</span> CT: <b className="text-green-700">{item.data.THUA_CHINH_THUC}</b></div>
                                                    <div>DT: {item.data.DT_MOI} ({item.data.LOAI_DAT_MOI})</div>
                                                </td>

                                                {/* COMMON COLUMNS (Right side) */}
                                                {shouldRenderCommon && (
                                                    <td className="p-3 text-center border-r align-middle font-bold bg-white" rowSpan={rowSpan}>
                                                        {item.data.TONG_DT}
                                                    </td>
                                                )}
                                                {shouldRenderCommon && (
                                                    <td className="p-3 text-xs text-gray-500 border-r align-middle bg-white" rowSpan={rowSpan}>
                                                        {item.data.CAN_CU_PHAP_LY}
                                                    </td>
                                                )}
                                                {shouldRenderCommon && (
                                                    <td className="p-3 text-center font-mono text-xs font-bold text-blue-600 border-r align-middle bg-white" rowSpan={rowSpan}>
                                                        {item.data.SO_HD}
                                                    </td>
                                                )}
                                                {shouldRenderCommon && (
                                                    <td className="p-3 text-xs text-gray-500 border-r align-middle italic bg-white" rowSpan={rowSpan}>
                                                        {item.data.GHI_CHU}
                                                    </td>
                                                )}

                                                {/* ACTION COLUMN */}
                                                {shouldRenderCommon && (
                                                    <td className="p-3 text-center align-middle bg-white sticky right-0 shadow-l" rowSpan={rowSpan}>
                                                        <div className="flex flex-col gap-2 items-center">
                                                            <button onClick={() => handleEditGroup(item.data.SO_HD)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded border border-blue-200 bg-blue-50" title="Sửa nhóm"><Edit size={14}/></button>
                                                            <button onClick={() => handleDeleteGroup(item.data.SO_HD)} className="p-1.5 text-red-500 hover:bg-red-100 rounded border border-red-200 bg-red-50" title="Xóa nhóm"><Trash2 size={14}/></button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    }) : (
                                        <tr><td colSpan={9} className="p-8 text-center text-gray-400 italic">Chưa có dữ liệu.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChinhLyBienDongTab;
