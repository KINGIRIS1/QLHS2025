

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from '../../types';
import { ArchiveRecord, fetchArchiveRecords, saveArchiveRecord, deleteArchiveRecord } from '../../services/apiArchive';
import { Search, Plus, Trash2, Save, BookOpen, Loader2 } from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';

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
        if (!searchTerm) return records;
        const lower = searchTerm.toLowerCase();
        return records.filter(r => {
            const d = r.data || {};
            return (
                (d.ma_ho_so || '').toLowerCase().includes(lower) ||
                (d.ten_chu_su_dung || '').toLowerCase().includes(lower) ||
                (d.ten_chuyen_quyen || '').toLowerCase().includes(lower)
            );
        });
    }, [records, searchTerm]);

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

        // Lưu ngay để tạo ID và dòng mới
        await saveArchiveRecord(newRecord);
        await loadData();
    };

    const handleDelete = async (id: string) => {
        if (await confirmAction('Xóa dòng này?')) {
            await deleteArchiveRecord(id);
            setRecords(prev => prev.filter(r => r.id !== id));
        }
    };

    // Hàm update local state khi nhập liệu
    const handleCellChange = (id: string, key: string, value: string) => {
        setRecords(prev => prev.map(r => {
            if (r.id === id) {
                const newData = { ...r.data, [key]: value };
                // Cập nhật các trường chính của ArchiveRecord để tương thích
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

    // Hàm save xuống DB khi blur (rời khỏi ô input)
    const handleBlur = async (record: ArchiveRecord) => {
        setSavingId(record.id);
        await saveArchiveRecord(record);
        setSavingId(null);
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 items-center bg-gray-50">
                <div className="font-bold text-gray-700 flex items-center gap-2 text-lg">
                    <BookOpen size={20} className="text-teal-600" /> Sổ Đăng Ký Biến Động (Vào Số)
                </div>
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" 
                        placeholder="Tìm kiếm theo mã hồ sơ, tên chủ..." 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                </div>
                <button 
                    onClick={handleAddNew} 
                    className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-teal-700 shadow-sm transition-colors"
                >
                    <Plus size={16}/> Thêm dòng mới
                </button>
            </div>

            {/* Table Container */}
            <div className="flex-1 overflow-auto relative">
                {loading ? (
                    <div className="flex items-center justify-center h-full text-gray-500 gap-2">
                        <Loader2 className="animate-spin" /> Đang tải dữ liệu...
                    </div>
                ) : (
                    <div className="inline-block min-w-full align-middle">
                        <table className="min-w-full border-collapse">
                            <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-2 border-b border-r border-gray-200 w-12 text-center bg-gray-100 sticky left-0 z-20">#</th>
                                    {COLUMNS.map(col => (
                                        <th key={col.key} className="p-2 border-b border-r border-gray-200 text-xs font-bold text-gray-600 uppercase text-left whitespace-nowrap" style={{ minWidth: col.width }}>
                                            {col.label}
                                        </th>
                                    ))}
                                    <th className="p-2 border-b border-gray-200 w-16 text-center bg-gray-100 sticky right-0 z-20">Xóa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredRecords.length > 0 ? filteredRecords.map((r, idx) => (
                                    <tr key={r.id} className="hover:bg-teal-50/30 group">
                                        <td className="p-2 border-r border-gray-200 text-center text-gray-500 text-xs bg-white sticky left-0 group-hover:bg-teal-50/30 z-10">
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
                                                />
                                            </td>
                                        ))}
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
                                        <td colSpan={COLUMNS.length + 2} className="p-8 text-center text-gray-400 italic">
                                            Chưa có dữ liệu. Nhấn "Thêm dòng mới" để bắt đầu.
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

