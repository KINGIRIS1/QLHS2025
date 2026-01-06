
import React, { useState, useEffect } from 'react';
import { User as UserType, RecordFile } from '../../types';
import { fetchRecords } from '../../services/apiRecords';
import { ChinhLyRecord, fetchChinhLyRecords, saveChinhLyRecord, deleteChinhLyRecord } from '../../services/apiUtilities';
import { NotifyFunction } from '../../components/UtilitiesView';
import { Search, Plus, Save, List, Edit, Trash2, FileSpreadsheet, PlusCircle, X, Check } from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';
import * as XLSX from 'xlsx-js-style';

interface ChinhLyBienDongTabProps {
    currentUser: UserType;
    notify: NotifyFunction;
}

// Định nghĩa cấu trúc dữ liệu cho một dòng nhập liệu
interface RowData {
    XA: string;
    TO_CU: string; THUA_CU: string; DT_CU: string; LOAI_DAT_CU: string;
    TO_MOI: string; THUA_TAM: string; THUA_CHINH_THUC: string; DT_MOI: string; LOAI_DAT_MOI: string;
    TONG_DT: string;
    CAN_CU_PHAP_LY: string;
    SO_HD: string;
    GHI_CHU: string;
    TEN_CSD: string;
}

const EMPTY_ROW: RowData = {
    XA: '',
    TO_CU: '', THUA_CU: '', DT_CU: '', LOAI_DAT_CU: '',
    TO_MOI: '', THUA_TAM: '', THUA_CHINH_THUC: '', DT_MOI: '', LOAI_DAT_MOI: '',
    TONG_DT: '',
    CAN_CU_PHAP_LY: 'Phiếu yêu cầu nộp hồ sơ GQ TTHC',
    SO_HD: '',
    GHI_CHU: '',
    TEN_CSD: ''
};

const ChinhLyBienDongTab: React.FC<ChinhLyBienDongTabProps> = ({ currentUser, notify }) => {
    const [mode, setMode] = useState<'create' | 'list'>('list');
    const [records, setRecords] = useState<RecordFile[]>([]);
    const [savedList, setSavedList] = useState<ChinhLyRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // State cho Input dạng bảng
    const [inputRows, setInputRows] = useState<RowData[]>([ { ...EMPTY_ROW } ]);
    const [searchQuery, setSearchQuery] = useState(''); 
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

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

    // --- LOGIC XỬ LÝ DÒNG ---
    const handleAddRow = () => {
        setInputRows(prev => [...prev, { ...EMPTY_ROW }]);
    };

    const handleRemoveRow = (index: number) => {
        if (inputRows.length === 1 && !editingId) {
            // Nếu chỉ còn 1 dòng thì clear data chứ không xóa
            setInputRows([{ ...EMPTY_ROW }]);
        } else {
            setInputRows(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleRowChange = (index: number, field: keyof RowData, value: string) => {
        const newRows = [...inputRows];
        newRows[index] = { ...newRows[index], [field]: value };
        setInputRows(newRows);
    };

    const handleSearchAndFill = () => {
        if (!searchQuery.trim()) return;
        const found = records.find(r => r.code.toLowerCase() === searchQuery.toLowerCase().trim());
        
        if (found) {
            const newRow: RowData = {
                ...EMPTY_ROW,
                TEN_CSD: found.customerName,
                XA: found.ward ? found.ward.replace(/^(xã|phường|thị trấn)\s+/i, '') : '',
                TO_CU: found.mapSheet || '',
                THUA_CU: found.landPlot || '',
                DT_CU: found.area ? found.area.toString() : '',
                DT_MOI: found.area ? found.area.toString() : '',
                TONG_DT: found.area ? found.area.toString() : '',
                TO_MOI: found.mapSheet || '',
                SO_HD: found.code
            };

            // Nếu dòng cuối cùng đang trống thì điền vào đó, ngược lại thêm dòng mới
            const lastRow = inputRows[inputRows.length - 1];
            const isLastRowEmpty = !lastRow.TEN_CSD && !lastRow.XA && !lastRow.TO_CU;

            if (isLastRowEmpty) {
                const updatedRows = [...inputRows];
                updatedRows[updatedRows.length - 1] = newRow;
                setInputRows(updatedRows);
            } else {
                setInputRows(prev => [...prev, newRow]);
            }
            
            notify(`Đã thêm hồ sơ: ${found.code}`, 'success');
            setSearchQuery(''); // Clear search
        } else {
            notify('Không tìm thấy mã hồ sơ này.', 'error');
        }
    };

    // --- CRUD ---
    const handleSaveAll = async () => {
        // Filter rows that have meaningful data
        const validRows = inputRows.filter(row => row.XA || row.TEN_CSD || row.TO_CU);
        
        if (validRows.length === 0) {
            notify("Vui lòng nhập ít nhất một dòng dữ liệu.", 'error');
            return;
        }

        setIsSaving(true);
        let successCount = 0;

        for (const rowData of validRows) {
            const recordToSave: Partial<ChinhLyRecord> = {
                id: editingId || undefined, // Nếu đang edit thì dùng ID cũ (lúc này validRows chỉ có 1 row)
                customer_name: rowData.TEN_CSD || rowData.XA,
                data: rowData,
                created_by: currentUser.name
            };
            const res = await saveChinhLyRecord(recordToSave);
            if (res) successCount++;
        }

        setIsSaving(false);
        if (successCount > 0) {
            await loadData();
            notify(`Đã lưu thành công ${successCount} dòng!`, 'success');
            setMode('list');
            handleReset();
        } else {
            notify("Lỗi khi lưu dữ liệu.", 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (await confirmAction("Xóa dòng này khỏi danh sách?")) {
            const success = await deleteChinhLyRecord(id);
            if (success) {
                setSavedList(prev => prev.filter(r => r.id !== id));
                notify("Đã xóa.", 'success');
            }
        }
    };

    const handleEdit = (item: ChinhLyRecord) => {
        setEditingId(item.id);
        setInputRows([item.data]); // Load data vào bảng (chỉ 1 dòng)
        setMode('create');
    };

    const handleReset = () => {
        setEditingId(null);
        setInputRows([ { ...EMPTY_ROW } ]);
        setSearchQuery('');
    };

    // --- EXCEL EXPORT ---
    const handleExportExcel = () => {
        if (savedList.length === 0) { notify("Danh sách trống.", 'error'); return; }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([]);

        // Header Structure
        const header1 = ["STT", "Xã, Thị trấn", "Thông tin trước biến động", "", "", "", "Thông tin sau biến động", "", "", "", "", "Tổng DT (m2)", "Căn cứ pháp lý", "Số HĐ", "Ghi chú"];
        const header2 = ["", "", "Tờ BĐĐC", "Số thửa", "Diện tích (m2)", "Loại đất", "Tờ BĐĐC", "Số thửa tạm", "Số thửa chính thức", "Diện tích (m2)", "Loại đất", "", "", "", ""];

        // Data Rows
        const dataRows = savedList.map((item, index) => {
            const d = item.data;
            return [
                index + 1,
                d.XA,
                d.TO_CU, d.THUA_CU, d.DT_CU, d.LOAI_DAT_CU,
                d.TO_MOI, d.THUA_TAM, d.THUA_CHINH_THUC, d.DT_MOI, d.LOAI_DAT_MOI,
                d.TONG_DT,
                d.CAN_CU_PHAP_LY,
                d.SO_HD,
                d.GHI_CHU
            ];
        });

        // Add content
        XLSX.utils.sheet_add_aoa(ws, [
            ["DANH SÁCH CUNG CẤP SỐ THỬA CHÍNH THỨC"],
            [""],
            header1,
            header2,
            ...dataRows
        ], { origin: "A1" });

        // Merges
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 14 } }); // Title
        
        // Header merges
        ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 3, c: 0 } }); // STT
        ws['!merges'].push({ s: { r: 2, c: 1 }, e: { r: 3, c: 1 } }); // Xã
        ws['!merges'].push({ s: { r: 2, c: 2 }, e: { r: 2, c: 5 } }); // Trước BĐ
        ws['!merges'].push({ s: { r: 2, c: 6 }, e: { r: 2, c: 10 } }); // Sau BĐ
        ws['!merges'].push({ s: { r: 2, c: 11 }, e: { r: 3, c: 11 } }); // Tổng DT
        ws['!merges'].push({ s: { r: 2, c: 12 }, e: { r: 3, c: 12 } }); // Căn cứ
        ws['!merges'].push({ s: { r: 2, c: 13 }, e: { r: 3, c: 13 } }); // Số HĐ
        ws['!merges'].push({ s: { r: 2, c: 14 }, e: { r: 3, c: 14 } }); // Ghi chú

        // Style
        const headerStyle = { font: { bold: true, sz: 11, name: "Times New Roman" }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }, fill: { fgColor: { rgb: "E0E0E0" } } };
        const cellStyle = { font: { sz: 11, name: "Times New Roman" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }, alignment: { vertical: "center", wrapText: true } };
        
        for (let c = 0; c <= 14; c++) {
            const h1Ref = XLSX.utils.encode_cell({ r: 2, c });
            const h2Ref = XLSX.utils.encode_cell({ r: 3, c });
            if (!ws[h1Ref]) ws[h1Ref] = { v: "", t: "s" };
            if (!ws[h2Ref]) ws[h2Ref] = { v: "", t: "s" };
            ws[h1Ref].s = headerStyle;
            ws[h2Ref].s = headerStyle;

            for (let r = 4; r < 4 + dataRows.length; r++) {
                const cellRef = XLSX.utils.encode_cell({ r, c });
                if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
                ws[cellRef].s = cellStyle;
            }
        }

        ws['!cols'] = [
            { wch: 5 }, { wch: 15 }, 
            { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, 
            { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, 
            { wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 20 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, "DS_ChinhLy");
        XLSX.writeFile(wb, `DS_ChinhLy_BienDong_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const filteredList = savedList.filter(item => {
        if (!searchTerm) return true;
        const lower = searchTerm.toLowerCase();
        return (
            (item.customer_name || '').toLowerCase().includes(lower) ||
            (item.data.XA || '').toLowerCase().includes(lower) ||
            (item.data.SO_HD || '').toLowerCase().includes(lower)
        );
    });

    const commonInputClass = "w-full h-full border-none outline-none bg-transparent px-2 py-1 text-sm focus:ring-2 focus:ring-inset focus:ring-blue-500 focus:bg-white";

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9]">
            {/* TOOLBAR */}
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
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden">
                        {/* INPUT TOOLBAR */}
                        <div className="p-3 border-b border-gray-200 flex flex-wrap gap-4 items-center bg-gray-50">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                {editingId ? <Edit size={16} className="text-orange-500"/> : <FileSpreadsheet size={16} className="text-green-600"/>}
                                {editingId ? 'Cập nhật dòng' : 'Nhập liệu dạng bảng'}
                            </h3>
                            
                            {!editingId && (
                                <div className="flex items-center gap-2 bg-white px-2 py-1 border border-blue-200 rounded-lg shadow-sm focus-within:ring-2 focus-within:ring-blue-500 ml-auto">
                                    <Search size={14} className="text-gray-400" />
                                    <input 
                                        className="text-xs outline-none w-48" 
                                        placeholder="Nhập mã HS để điền nhanh..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSearchAndFill()}
                                    />
                                    <button onClick={handleSearchAndFill} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded hover:bg-blue-200 font-bold">Điền</button>
                                </div>
                            )}

                            <div className="flex gap-2 ml-auto">
                                {!editingId && (
                                    <button onClick={handleAddRow} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50">
                                        <PlusCircle size={14}/> Thêm dòng
                                    </button>
                                )}
                                <button onClick={handleSaveAll} disabled={isSaving} className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm disabled:opacity-50">
                                    {isSaving ? 'Đang lưu...' : <><Save size={14}/> {editingId ? 'Cập nhật' : 'Lưu tất cả'}</>}
                                </button>
                            </div>
                        </div>

                        {/* SPREADSHEET TABLE */}
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left border-collapse min-w-[1500px]">
                                <thead className="bg-gray-100 text-gray-700 text-xs font-bold uppercase sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th rowSpan={2} className="p-2 border border-gray-300 w-10 text-center bg-gray-200">#</th>
                                        <th rowSpan={2} className="p-2 border border-gray-300 w-10 text-center bg-gray-200"><Trash2 size={14}/></th>
                                        <th rowSpan={2} className="p-2 border border-gray-300 min-w-[120px]">Xã / TT</th>
                                        <th rowSpan={2} className="p-2 border border-gray-300 min-w-[150px]">Chủ Sử Dụng (Tên)</th>
                                        <th colSpan={4} className="p-2 border border-gray-300 text-center bg-blue-50 text-blue-800">Thông tin Trước BĐ</th>
                                        <th colSpan={5} className="p-2 border border-gray-300 text-center bg-green-50 text-green-800">Thông tin Sau BĐ</th>
                                        <th rowSpan={2} className="p-2 border border-gray-300 w-20">Tổng DT</th>
                                        <th rowSpan={2} className="p-2 border border-gray-300 min-w-[100px]">Số HĐ</th>
                                        <th rowSpan={2} className="p-2 border border-gray-300 min-w-[150px]">Căn cứ pháp lý</th>
                                        <th rowSpan={2} className="p-2 border border-gray-300 min-w-[150px]">Ghi chú</th>
                                    </tr>
                                    <tr>
                                        <th className="p-2 border border-gray-300 w-16 text-center bg-blue-50">Tờ</th>
                                        <th className="p-2 border border-gray-300 w-16 text-center bg-blue-50">Thửa</th>
                                        <th className="p-2 border border-gray-300 w-20 text-center bg-blue-50">DT</th>
                                        <th className="p-2 border border-gray-300 w-20 text-center bg-blue-50">Loại</th>
                                        
                                        <th className="p-2 border border-gray-300 w-16 text-center bg-green-50">Tờ</th>
                                        <th className="p-2 border border-gray-300 w-16 text-center bg-green-50">Tạm</th>
                                        <th className="p-2 border border-gray-300 w-16 text-center bg-green-50 text-green-700">CT</th>
                                        <th className="p-2 border border-gray-300 w-20 text-center bg-green-50">DT</th>
                                        <th className="p-2 border border-gray-300 w-20 text-center bg-green-50">Loại</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {inputRows.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50/30 group">
                                            <td className="border border-gray-300 text-center text-xs text-gray-500 bg-gray-50">{idx + 1}</td>
                                            <td className="border border-gray-300 text-center">
                                                <button tabIndex={-1} onClick={() => handleRemoveRow(idx)} className="text-gray-300 hover:text-red-500 p-1"><X size={14}/></button>
                                            </td>
                                            <td className="border border-gray-300 p-0"><input className={commonInputClass} value={row.XA} onChange={e => handleRowChange(idx, 'XA', e.target.value)} /></td>
                                            <td className="border border-gray-300 p-0"><input className={`${commonInputClass} font-bold`} value={row.TEN_CSD} onChange={e => handleRowChange(idx, 'TEN_CSD', e.target.value)} /></td>
                                            
                                            {/* TRƯỚC BĐ */}
                                            <td className="border border-gray-300 p-0"><input className={`${commonInputClass} text-center`} value={row.TO_CU} onChange={e => handleRowChange(idx, 'TO_CU', e.target.value)} /></td>
                                            <td className="border border-gray-300 p-0"><input className={`${commonInputClass} text-center`} value={row.THUA_CU} onChange={e => handleRowChange(idx, 'THUA_CU', e.target.value)} /></td>
                                            <td className="border border-gray-300 p-0"><input className={`${commonInputClass} text-center`} value={row.DT_CU} onChange={e => handleRowChange(idx, 'DT_CU', e.target.value)} /></td>
                                            <td className="border border-gray-300 p-0"><input className={`${commonInputClass} text-center`} value={row.LOAI_DAT_CU} onChange={e => handleRowChange(idx, 'LOAI_DAT_CU', e.target.value)} /></td>

                                            {/* SAU BĐ */}
                                            <td className="border border-gray-300 p-0"><input className={`${commonInputClass} text-center`} value={row.TO_MOI} onChange={e => handleRowChange(idx, 'TO_MOI', e.target.value)} /></td>
                                            <td className="border border-gray-300 p-0"><input className={`${commonInputClass} text-center`} value={row.THUA_TAM} onChange={e => handleRowChange(idx, 'THUA_TAM', e.target.value)} /></td>
                                            <td className="border border-gray-300 p-0"><input className={`${commonInputClass} text-center font-bold text-green-700 bg-green-50/30`} value={row.THUA_CHINH_THUC} onChange={e => handleRowChange(idx, 'THUA_CHINH_THUC', e.target.value)} /></td>
                                            <td className="border border-gray-300 p-0"><input className={`${commonInputClass} text-center`} value={row.DT_MOI} onChange={e => handleRowChange(idx, 'DT_MOI', e.target.value)} /></td>
                                            <td className="border border-gray-300 p-0"><input className={`${commonInputClass} text-center`} value={row.LOAI_DAT_MOI} onChange={e => handleRowChange(idx, 'LOAI_DAT_MOI', e.target.value)} /></td>

                                            <td className="border border-gray-300 p-0"><input className={`${commonInputClass} text-center font-bold`} value={row.TONG_DT} onChange={e => handleRowChange(idx, 'TONG_DT', e.target.value)} /></td>
                                            <td className="border border-gray-300 p-0"><input className={`${commonInputClass} text-center`} value={row.SO_HD} onChange={e => handleRowChange(idx, 'SO_HD', e.target.value)} /></td>
                                            <td className="border border-gray-300 p-0"><input className={commonInputClass} value={row.CAN_CU_PHAP_LY} onChange={e => handleRowChange(idx, 'CAN_CU_PHAP_LY', e.target.value)} /></td>
                                            <td className="border border-gray-300 p-0"><input className={commonInputClass} value={row.GHI_CHU} onChange={e => handleRowChange(idx, 'GHI_CHU', e.target.value)} /></td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td colSpan={17} className="p-2 bg-gray-50 border-t border-gray-200">
                                            <button onClick={handleAddRow} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 mx-auto">
                                                <Plus size={14}/> Thêm dòng mới
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
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
                                        <th className="p-3 border-b text-center w-10">STT</th>
                                        <th className="p-3 border-b">Xã/Thị trấn</th>
                                        <th className="p-3 border-b">Tên Chủ / HĐ</th>
                                        <th className="p-3 border-b">Thông tin trước BĐ</th>
                                        <th className="p-3 border-b">Thông tin sau BĐ</th>
                                        <th className="p-3 border-b w-20 text-center">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredList.length > 0 ? filteredList.map((item, idx) => (
                                        <tr key={item.id} className="hover:bg-blue-50/50">
                                            <td className="p-3 text-center text-gray-500">{idx + 1}</td>
                                            <td className="p-3 font-medium text-blue-700">{item.data.XA}</td>
                                            <td className="p-3">
                                                <div className="font-bold text-gray-800">{item.data.TEN_CSD}</div>
                                                <div className="text-xs text-gray-500 font-mono">{item.data.SO_HD}</div>
                                            </td>
                                            <td className="p-3 text-xs">
                                                <div>Tờ: <b>{item.data.TO_CU}</b> - Thửa: <b>{item.data.THUA_CU}</b></div>
                                                <div>DT: {item.data.DT_CU} m2</div>
                                            </td>
                                            <td className="p-3 text-xs">
                                                <div>Tờ: <b>{item.data.TO_MOI}</b> - Thửa CT: <b className="text-green-700">{item.data.THUA_CHINH_THUC}</b></div>
                                                <div>DT: {item.data.DT_MOI} m2</div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => handleEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"><Edit size={16}/></button>
                                                    <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-500 hover:bg-red-100 rounded"><Trash2 size={16}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">Chưa có dữ liệu.</td></tr>
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
