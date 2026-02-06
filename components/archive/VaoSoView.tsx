
import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../../types';
import { ArchiveRecord, fetchArchiveRecords, saveArchiveRecord, deleteArchiveRecord } from '../../services/apiArchive';
import { Search, Plus, Trash2, Edit, Save, BookOpen } from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';

interface VaoSoViewProps {
    currentUser: User;
}

const VaoSoView: React.FC<VaoSoViewProps> = ({ currentUser }) => {
    const [records, setRecords] = useState<ArchiveRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<ArchiveRecord>>({
        type: 'vaoso',
        status: 'completed', // Vào số thì mặc định là hoàn thành lưu trữ
        so_hieu: '',
        trich_yeu: '',
        ngay_thang: new Date().toISOString().split('T')[0],
        noi_nhan_gui: ''
    });
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        const data = await fetchArchiveRecords('vaoso');
        setRecords(data);
    };

    const filteredRecords = useMemo(() => {
        if (!searchTerm) return records;
        const lower = searchTerm.toLowerCase();
        return records.filter(r => 
            (r.so_hieu || '').toLowerCase().includes(lower) ||
            (r.trich_yeu || '').toLowerCase().includes(lower) ||
            (r.noi_nhan_gui || '').toLowerCase().includes(lower)
        );
    }, [records, searchTerm]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.so_hieu || !formData.trich_yeu) return;
        
        const success = await saveArchiveRecord({
            ...formData,
            id: editingId || undefined,
            created_by: currentUser.username
        });

        if (success) {
            await loadData();
            setIsFormOpen(false);
            setEditingId(null);
            setFormData({ type: 'vaoso', status: 'completed', so_hieu: '', trich_yeu: '', ngay_thang: new Date().toISOString().split('T')[0], noi_nhan_gui: '' });
        }
    };

    const handleDelete = async (id: string) => {
        if (await confirmAction('Xóa dòng vào số này?')) {
            await deleteArchiveRecord(id);
            loadData();
        }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 items-center bg-gray-50">
                <div className="font-bold text-gray-700 flex items-center gap-2 text-lg">
                    <BookOpen size={20} className="text-teal-600" /> Sổ Đăng Ký Văn Bản
                </div>
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Tìm kiếm..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <button onClick={() => { setIsFormOpen(true); setEditingId(null); setFormData({type: 'vaoso', status: 'completed', so_hieu: '', trich_yeu: '', ngay_thang: new Date().toISOString().split('T')[0], noi_nhan_gui: ''}); }} className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-teal-700 shadow-sm">
                    <Plus size={16}/> Vào số mới
                </button>
            </div>

            <div className="flex-1 overflow-auto p-4 flex gap-4">
                {isFormOpen && (
                    <div className="w-1/3 min-w-[300px] border-r pr-4 bg-gray-50 p-4 rounded-lg h-full flex flex-col">
                        <h3 className="font-bold text-gray-800 mb-4">{editingId ? 'Cập nhật' : 'Vào sổ mới'}</h3>
                        <form onSubmit={handleSave} className="space-y-3 flex-1 overflow-y-auto">
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Số văn bản</label><input className="w-full border rounded px-3 py-2 text-sm" value={formData.so_hieu} onChange={e => setFormData({...formData, so_hieu: e.target.value})} placeholder="Số VB..." /></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Ngày ban hành</label><input type="date" className="w-full border rounded px-3 py-2 text-sm" value={formData.ngay_thang} onChange={e => setFormData({...formData, ngay_thang: e.target.value})} /></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Trích yếu nội dung</label><textarea rows={3} className="w-full border rounded px-3 py-2 text-sm" value={formData.trich_yeu} onChange={e => setFormData({...formData, trich_yeu: e.target.value})} placeholder="Nội dung..." /></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Cơ quan ban hành / Nơi nhận</label><input className="w-full border rounded px-3 py-2 text-sm" value={formData.noi_nhan_gui} onChange={e => setFormData({...formData, noi_nhan_gui: e.target.value})} placeholder="Đơn vị..." /></div>
                            
                            <div className="pt-4 flex gap-2 justify-end">
                                <button type="button" onClick={() => setIsFormOpen(false)} className="px-3 py-2 text-gray-600 hover:bg-gray-200 rounded text-sm">Hủy</button>
                                <button type="submit" className="px-4 py-2 bg-teal-600 text-white rounded font-bold text-sm hover:bg-teal-700 flex items-center gap-1"><Save size={16}/> Lưu</button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-100 text-xs font-bold text-gray-600 uppercase sticky top-0">
                            <tr>
                                <th className="p-3 w-10 text-center">#</th>
                                <th className="p-3 w-32">Số VB</th>
                                <th className="p-3 w-28">Ngày</th>
                                <th className="p-3">Nội dung</th>
                                <th className="p-3 w-40">Cơ quan/Đơn vị</th>
                                <th className="p-3 w-24 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-100">
                            {filteredRecords.length > 0 ? filteredRecords.map((r, idx) => (
                                <tr key={r.id} className="hover:bg-teal-50/30">
                                    <td className="p-3 text-center text-gray-500">{idx + 1}</td>
                                    <td className="p-3 font-bold text-teal-700">{r.so_hieu}</td>
                                    <td className="p-3 text-gray-600">{r.ngay_thang?.split('-').reverse().join('/')}</td>
                                    <td className="p-3 text-gray-800">{r.trich_yeu}</td>
                                    <td className="p-3 text-gray-600">{r.noi_nhan_gui}</td>
                                    <td className="p-3 text-center">
                                        <div className="flex justify-center gap-1">
                                            <button onClick={() => { setFormData(r); setEditingId(r.id); setIsFormOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Sửa"><Edit size={14}/></button>
                                            <button onClick={() => handleDelete(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Xóa"><Trash2 size={14}/></button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">Chưa có dữ liệu</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default VaoSoView;
