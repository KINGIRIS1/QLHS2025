
import React, { useState, useEffect } from 'react';
import { User as UserType, RecordFile } from '../../types';
import { fetchRecords } from '../../services/apiRecords';
import { ChinhLyRecord, fetchChinhLyRecords, saveChinhLyRecord, deleteChinhLyRecord } from '../../services/apiUtilities';
import { NotifyFunction } from '../../components/UtilitiesView';
import { Search, Plus, Save, List, Edit, Trash2, FileSpreadsheet, Check, ArrowRight, Table2 } from 'lucide-react';
import { confirmAction, removeVietnameseTones } from '../../utils/appHelpers';
import * as XLSX from 'xlsx-js-style';

interface ChinhLyBienDongTabProps {
    currentUser: UserType;
    notify: NotifyFunction;
}

const ChinhLyBienDongTab: React.FC<ChinhLyBienDongTabProps> = ({ currentUser, notify }) => {
    const [mode, setMode] = useState<'create' | 'list'>('list');
    const [records, setRecords] = useState<RecordFile[]>([]);
    const [savedList, setSavedList] = useState<ChinhLyRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchQuery, setSearchQuery] = useState(''); // Cho ô tìm kiếm hồ sơ để điền
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form Data
    const [formData, setFormData] = useState({
        XA: '',
        TO_CU: '', THUA_CU: '', DT_CU: '', LOAI_DAT_CU: '',
        TO_MOI: '', THUA_TAM: '', THUA_CHINH_THUC: '', DT_MOI: '', LOAI_DAT_MOI: '',
        TONG_DT: '',
        CAN_CU_PHAP_LY: '',
        SO_HD: '',
        GHI_CHU: '',
        TEN_CSD: '' // Để hiển thị/tìm kiếm, không in trong bảng này nhưng cần lưu
    });

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

    const handleSearchRecord = () => {
        const found = records.find(r => r.code.toLowerCase() === searchQuery.toLowerCase());
        if (found) {
            setFormData(prev => ({
                ...prev,
                TEN_CSD: found.customerName,
                XA: found.ward ? found.ward.replace(/^(xã|phường|thị trấn)\s+/i, '') : '',
                TO_CU: found.mapSheet || '',
                THUA_CU: found.landPlot || '',
                DT_CU: found.area ? found.area.toString() : '',
                DT_MOI: found.area ? found.area.toString() : '',
                TONG_DT: found.area ? found.area.toString() : '',
                LOAI_DAT_CU: '',
                LOAI_DAT_MOI: '',
                TO_MOI: found.mapSheet || '', // Thường tờ mới = tờ cũ nếu chưa có BĐĐC mới
                THUA_TAM: '',
                THUA_CHINH_THUC: '',
                CAN_CU_PHAP_LY: 'Phiếu yêu cầu nộp hồ sơ giải quyết thủ tục hành chính về đất đai',
                SO_HD: '',
                GHI_CHU: ''
            }));
            notify(`Đã tải dữ liệu từ hồ sơ: ${found.code}`, 'success');
        } else {
            notify('Không tìm thấy mã hồ sơ này.', 'error');
        }
    };

    const handleSave = async () => {
        if (!formData.XA) {
            notify("Vui lòng nhập tên Xã/Thị trấn.", 'error');
            return;
        }

        const recordToSave: Partial<ChinhLyRecord> = {
            id: editingId || undefined,
            customer_name: formData.TEN_CSD || formData.XA, // Dùng tên CSD để tìm kiếm, hoặc tên Xã
            data: formData,
            created_by: currentUser.name
        };

        const success = await saveChinhLyRecord(recordToSave);
        if (success) {
            await loadData();
            notify(editingId ? "Đã cập nhật!" : "Đã thêm vào danh sách!", 'success');
            if (!editingId) handleReset();
            setMode('list'); // Quay về danh sách sau khi lưu
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
        setFormData(item.data);
        setMode('create');
    };

    const handleReset = () => {
        setEditingId(null);
        setFormData({
            XA: '',
            TO_CU: '', THUA_CU: '', DT_CU: '', LOAI_DAT_CU: '',
            TO_MOI: '', THUA_TAM: '', THUA_CHINH_THUC: '', DT_MOI: '', LOAI_DAT_MOI: '',
            TONG_DT: '',
            CAN_CU_PHAP_LY: '',
            SO_HD: '',
            GHI_CHU: '',
            TEN_CSD: ''
        });
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
        // Title merge
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 14 } });
        
        // Header merges
        // STT (A3:A4)
        ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 3, c: 0 } });
        // Xã (B3:B4)
        ws['!merges'].push({ s: { r: 2, c: 1 }, e: { r: 3, c: 1 } });
        // Trước BĐ (C3:F3)
        ws['!merges'].push({ s: { r: 2, c: 2 }, e: { r: 2, c: 5 } });
        // Sau BĐ (G3:K3)
        ws['!merges'].push({ s: { r: 2, c: 6 }, e: { r: 2, c: 10 } });
        // Tổng DT (L3:L4)
        ws['!merges'].push({ s: { r: 2, c: 11 }, e: { r: 3, c: 11 } });
        // Căn cứ (M3:M4)
        ws['!merges'].push({ s: { r: 2, c: 12 }, e: { r: 3, c: 12 } });
        // Số HĐ (N3:N4)
        ws['!merges'].push({ s: { r: 2, c: 13 }, e: { r: 3, c: 13 } });
        // Ghi chú (O3:O4)
        ws['!merges'].push({ s: { r: 2, c: 14 }, e: { r: 3, c: 14 } });

        // Style
        const headerStyle = { font: { bold: true, sz: 11, name: "Times New Roman" }, alignment: { horizontal: "center", vertical: "center", wrapText: true }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }, fill: { fgColor: { rgb: "E0E0E0" } } };
        const cellStyle = { font: { sz: 11, name: "Times New Roman" }, border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }, alignment: { vertical: "center", wrapText: true } };
        
        // Apply styles
        for (let c = 0; c <= 14; c++) {
            // Row 3, 4 (Index 2, 3) are headers
            const h1Ref = XLSX.utils.encode_cell({ r: 2, c });
            const h2Ref = XLSX.utils.encode_cell({ r: 3, c });
            if (!ws[h1Ref]) ws[h1Ref] = { v: "", t: "s" };
            if (!ws[h2Ref]) ws[h2Ref] = { v: "", t: "s" };
            ws[h1Ref].s = headerStyle;
            ws[h2Ref].s = headerStyle;

            // Data rows
            for (let r = 4; r < 4 + dataRows.length; r++) {
                const cellRef = XLSX.utils.encode_cell({ r, c });
                if (!ws[cellRef]) ws[cellRef] = { v: "", t: "s" };
                ws[cellRef].s = cellStyle;
            }
        }

        // Column widths
        ws['!cols'] = [
            { wch: 5 }, { wch: 15 }, 
            { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, // Trước BĐ
            { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, // Sau BĐ
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

    return (
        <div className="flex flex-col h-full bg-[#f1f5f9]">
            {/* TOOLBAR */}
            <div className="flex items-center gap-2 px-4 pt-2 border-b border-gray-200 bg-white shadow-sm shrink-0 z-20">
                <button onClick={() => { setMode('create'); handleReset(); }} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors ${mode === 'create' ? 'border-orange-600 text-orange-600 bg-orange-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <Plus size={16} /> Thêm mới
                </button>
                <button onClick={() => setMode('list')} className={`flex items-center gap-2 px-4 py-2 text-sm font-bold border-b-2 transition-colors ${mode === 'list' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <List size={16} /> Danh sách ({savedList.length})
                </button>
            </div>

            <div className="flex-1 overflow-hidden p-4">
                {mode === 'create' ? (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-full flex flex-col overflow-y-auto max-w-5xl mx-auto">
                        <div className="border-b border-gray-100 pb-4 mb-4">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                {editingId ? <Edit className="text-orange-500"/> : <Plus className="text-green-500"/>}
                                {editingId ? 'Cập nhật thông tin chỉnh lý' : 'Nhập thông tin chỉnh lý mới'}
                            </h3>
                        </div>

                        {/* SECTION 1: AUTO FILL */}
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6 flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input 
                                    className="w-full pl-9 pr-4 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                    placeholder="Nhập mã hồ sơ để tự động điền (VD: 241025-001-CT)..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSearchRecord()}
                                />
                            </div>
                            <button onClick={handleSearchRecord} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">Điền tự động</button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Xã / Thị trấn *</label>
                                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none" value={formData.XA} onChange={e => setFormData({...formData, XA: e.target.value})} placeholder="VD: Tân Phú" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tên chủ (Tham khảo)</label>
                                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 outline-none" value={formData.TEN_CSD} onChange={e => setFormData({...formData, TEN_CSD: e.target.value})} placeholder="Nguyễn Văn A..." />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* TRƯỚC BIẾN ĐỘNG */}
                            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                                <h4 className="text-sm font-bold text-gray-700 mb-3 border-b pb-2 uppercase">Thông tin trước biến động</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-xs text-gray-500 block mb-1">Tờ BĐĐC</label><input className="w-full border rounded p-2 text-sm text-center" value={formData.TO_CU} onChange={e => setFormData({...formData, TO_CU: e.target.value})} /></div>
                                    <div><label className="text-xs text-gray-500 block mb-1">Số thửa</label><input className="w-full border rounded p-2 text-sm text-center" value={formData.THUA_CU} onChange={e => setFormData({...formData, THUA_CU: e.target.value})} /></div>
                                    <div><label className="text-xs text-gray-500 block mb-1">Diện tích (m2)</label><input className="w-full border rounded p-2 text-sm text-center" value={formData.DT_CU} onChange={e => setFormData({...formData, DT_CU: e.target.value})} /></div>
                                    <div><label className="text-xs text-gray-500 block mb-1">Loại đất</label><input className="w-full border rounded p-2 text-sm text-center" value={formData.LOAI_DAT_CU} onChange={e => setFormData({...formData, LOAI_DAT_CU: e.target.value})} placeholder="ONT, CLN..." /></div>
                                </div>
                            </div>

                            {/* SAU BIẾN ĐỘNG */}
                            <div className="border border-green-200 rounded-xl p-4 bg-green-50">
                                <h4 className="text-sm font-bold text-green-800 mb-3 border-b border-green-200 pb-2 uppercase">Thông tin sau biến động</h4>
                                <div className="grid grid-cols-3 gap-3">
                                    <div><label className="text-xs text-gray-500 block mb-1">Tờ BĐĐC</label><input className="w-full border rounded p-2 text-sm text-center" value={formData.TO_MOI} onChange={e => setFormData({...formData, TO_MOI: e.target.value})} /></div>
                                    <div><label className="text-xs text-gray-500 block mb-1">Thửa tạm</label><input className="w-full border rounded p-2 text-sm text-center" value={formData.THUA_TAM} onChange={e => setFormData({...formData, THUA_TAM: e.target.value})} /></div>
                                    <div><label className="text-xs text-green-600 font-bold block mb-1">Thửa chính thức</label><input className="w-full border border-green-300 rounded p-2 text-sm text-center font-bold text-green-700 bg-white" value={formData.THUA_CHINH_THUC} onChange={e => setFormData({...formData, THUA_CHINH_THUC: e.target.value})} /></div>
                                    <div><label className="text-xs text-gray-500 block mb-1">Diện tích (m2)</label><input className="w-full border rounded p-2 text-sm text-center" value={formData.DT_MOI} onChange={e => setFormData({...formData, DT_MOI: e.target.value})} /></div>
                                    <div className="col-span-2"><label className="text-xs text-gray-500 block mb-1">Loại đất</label><input className="w-full border rounded p-2 text-sm" value={formData.LOAI_DAT_MOI} onChange={e => setFormData({...formData, LOAI_DAT_MOI: e.target.value})} placeholder="ONT, CLN..." /></div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div><label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tổng Diện Tích (m2)</label><input className="w-full border border-gray-300 rounded-lg p-2 text-sm font-bold" value={formData.TONG_DT} onChange={e => setFormData({...formData, TONG_DT: e.target.value})} /></div>
                                <div><label className="text-xs font-bold text-gray-500 uppercase block mb-1">Số Hợp Đồng</label><input className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={formData.SO_HD} onChange={e => setFormData({...formData, SO_HD: e.target.value})} /></div>
                                <div><label className="text-xs font-bold text-gray-500 uppercase block mb-1">Căn cứ pháp lý</label><input className="w-full border border-gray-300 rounded-lg p-2 text-sm" value={formData.CAN_CU_PHAP_LY} onChange={e => setFormData({...formData, CAN_CU_PHAP_LY: e.target.value})} placeholder="TT 26/2024..." /></div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Ghi chú</label>
                                <textarea className="w-full border border-gray-300 rounded-lg p-2 text-sm" rows={2} value={formData.GHI_CHU} onChange={e => setFormData({...formData, GHI_CHU: e.target.value})} />
                            </div>
                        </div>

                        <div className="mt-auto pt-6 border-t border-gray-200 flex justify-end gap-3">
                            <button onClick={() => { setMode('list'); handleReset(); }} className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold">Hủy bỏ</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md flex items-center gap-2">
                                <Save size={18}/> {editingId ? 'Cập nhật' : 'Lưu danh sách'}
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
                                        <th className="p-3 border-b text-center w-10">STT</th>
                                        <th className="p-3 border-b">Xã/Thị trấn</th>
                                        <th className="p-3 border-b">Thông tin trước BĐ</th>
                                        <th className="p-3 border-b">Thông tin sau BĐ</th>
                                        <th className="p-3 border-b w-32">Căn cứ pháp lý</th>
                                        <th className="p-3 border-b w-20 text-center">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredList.length > 0 ? filteredList.map((item, idx) => (
                                        <tr key={item.id} className="hover:bg-blue-50/50">
                                            <td className="p-3 text-center text-gray-500">{idx + 1}</td>
                                            <td className="p-3 font-medium text-blue-700">{item.data.XA}</td>
                                            <td className="p-3 text-xs">
                                                <div>Tờ: <b>{item.data.TO_CU}</b> - Thửa: <b>{item.data.THUA_CU}</b></div>
                                                <div>DT: {item.data.DT_CU} m2 ({item.data.LOAI_DAT_CU})</div>
                                            </td>
                                            <td className="p-3 text-xs">
                                                <div>Tờ: <b>{item.data.TO_MOI}</b> - Thửa tạm: {item.data.THUA_TAM}</div>
                                                <div className="text-green-700 font-bold">Thửa CT: {item.data.THUA_CHINH_THUC}</div>
                                                <div>DT: {item.data.DT_MOI} m2 ({item.data.LOAI_DAT_MOI})</div>
                                            </td>
                                            <td className="p-3 text-xs text-gray-500 italic truncate max-w-[150px]" title={item.data.CAN_CU_PHAP_LY}>
                                                {item.data.CAN_CU_PHAP_LY}
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
