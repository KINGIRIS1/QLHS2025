import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, FileSpreadsheet, Loader2, Search } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { NotifyFunction } from '../../types';
import { fetchMapSheetConversions, saveMapSheetConversions, deleteAllMapSheetConversions, MapSheetConversion } from '../../services/apiUtilities';

interface Props {
    notify: NotifyFunction;
}

const ChuyenDoiToBanDoTab: React.FC<Props> = ({ notify }) => {
    const [data, setData] = useState<MapSheetConversion[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await fetchMapSheetConversions();
            setData(result);
        } catch (error) {
            notify('Lỗi khi tải dữ liệu chuyển đổi', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                if (jsonData.length < 2) {
                    notify('File Excel không có dữ liệu', 'error');
                    return;
                }

                // Find header row (assuming row 0 or 1)
                let headerRowIdx = 0;
                for (let i = 0; i < Math.min(5, jsonData.length); i++) {
                    const row = jsonData[i];
                    if (row && row.some(cell => typeof cell === 'string' && cell.toLowerCase().includes('xã phường cũ'))) {
                        headerRowIdx = i;
                        break;
                    }
                }

                const newConversions: Partial<MapSheetConversion>[] = [];
                for (let i = headerRowIdx + 1; i < jsonData.length; i++) {
                    const row = jsonData[i];
                    if (!row || row.length < 4) continue;
                    
                    // Assuming columns: Xã phường cũ (0), Số tờ (1), Xã phường mới (2), Số tờ (3)
                    const xa_phuong_cu = row[0]?.toString().trim();
                    const so_to_cu = row[1]?.toString().trim();
                    const xa_phuong_moi = row[2]?.toString().trim();
                    const so_to_moi = row[3]?.toString().trim();

                    if (xa_phuong_cu && so_to_cu && xa_phuong_moi && so_to_moi) {
                        newConversions.push({
                            xa_phuong_cu,
                            so_to_cu,
                            xa_phuong_moi,
                            so_to_moi
                        });
                    }
                }

                if (newConversions.length > 0) {
                    handleSaveData(newConversions);
                } else {
                    notify('Không tìm thấy dữ liệu hợp lệ trong file', 'error');
                }
            } catch (error) {
                console.error(error);
                notify('Lỗi khi đọc file Excel', 'error');
            }
        };
        reader.readAsBinaryString(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSaveData = async (newConversions: Partial<MapSheetConversion>[]) => {
        setSaving(true);
        try {
            const success = await saveMapSheetConversions(newConversions);
            if (success) {
                notify(`Đã lưu ${newConversions.length} bản ghi thành công`, 'success');
                loadData();
            } else {
                notify('Lỗi khi lưu dữ liệu vào hệ thống', 'error');
            }
        } catch (error) {
            notify('Lỗi khi lưu dữ liệu', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAll = async () => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa TOÀN BỘ dữ liệu chuyển đổi? Hành động này không thể hoàn tác.')) return;
        
        setSaving(true);
        try {
            const success = await deleteAllMapSheetConversions();
            if (success) {
                notify('Đã xóa toàn bộ dữ liệu', 'success');
                setData([]);
            } else {
                notify('Lỗi khi xóa dữ liệu', 'error');
            }
        } catch (error) {
            notify('Lỗi khi xóa dữ liệu', 'error');
        } finally {
            setSaving(false);
        }
    };

    const filteredData = data.filter(item => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return item.xa_phuong_cu.toLowerCase().includes(term) ||
               item.so_to_cu.toLowerCase().includes(term) ||
               item.xa_phuong_moi.toLowerCase().includes(term) ||
               item.so_to_moi.toLowerCase().includes(term);
    });

    return (
        <div className="flex flex-col h-full bg-white animate-fade-in">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-2">
                    <FileSpreadsheet className="text-blue-600" size={24} />
                    <h2 className="text-lg font-bold text-slate-800">Chuyển đổi tờ bản đồ</h2>
                </div>
                <div className="flex gap-2">
                    <input 
                        type="file" 
                        accept=".xlsx, .xls" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                    />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={saving}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                        Nhập từ Excel
                    </button>
                    {data.length > 0 && (
                        <button 
                            onClick={handleDeleteAll}
                            disabled={saving}
                            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-md font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                            <Trash2 size={18} />
                            Xóa tất cả
                        </button>
                    )}
                </div>
            </div>

            <div className="p-4 border-b bg-white">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Tìm kiếm xã phường, số tờ..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-50">
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <Loader2 className="animate-spin text-blue-500" size={32} />
                    </div>
                ) : data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                        <FileSpreadsheet size={48} className="opacity-20" />
                        <p>Chưa có dữ liệu chuyển đổi. Vui lòng nhập từ file Excel.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                                <tr>
                                    <th className="px-4 py-3 text-center w-16">STT</th>
                                    <th className="px-4 py-3 border-l">Xã phường cũ</th>
                                    <th className="px-4 py-3 border-l text-center">Số tờ cũ</th>
                                    <th className="px-4 py-3 border-l">Xã phường mới</th>
                                    <th className="px-4 py-3 border-l text-center">Số tờ mới</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map((row, index) => (
                                    <tr key={row.id} className="border-b hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-2 text-center text-slate-500">{index + 1}</td>
                                        <td className="px-4 py-2 border-l font-medium">{row.xa_phuong_cu}</td>
                                        <td className="px-4 py-2 border-l text-center font-bold text-blue-600">{row.so_to_cu}</td>
                                        <td className="px-4 py-2 border-l font-medium">{row.xa_phuong_moi}</td>
                                        <td className="px-4 py-2 border-l text-center font-bold text-green-600">{row.so_to_moi}</td>
                                    </tr>
                                ))}
                                {filteredData.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                            Không tìm thấy kết quả phù hợp
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

export default ChuyenDoiToBanDoTab;