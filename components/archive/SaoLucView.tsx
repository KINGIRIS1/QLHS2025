
import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../../types';
import { ArchiveRecord, fetchArchiveRecords, saveArchiveRecord, deleteArchiveRecord } from '../../services/apiArchive';
import { Search, Plus, ListChecks, FileCheck, Send, Trash2, Edit, Save, X, RotateCcw } from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';

interface SaoLucViewProps {
    currentUser: User;
}

const SaoLucView: React.FC<SaoLucViewProps> = ({ currentUser }) => {
    const [subTab, setSubTab] = useState<'list' | 'sign' | 'result'>('list');
    const [records, setRecords] = useState<ArchiveRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    
    // Form State
    const [formData, setFormData] = useState<Partial<ArchiveRecord>>({
        type: 'saoluc',
        status: 'draft',
        so_hieu: '',
        trich_yeu: '',
        ngay_thang: new Date().toISOString().split('T')[0],
        noi_nhan_gui: ''
    });
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        const data = await fetchArchiveRecords('saoluc');
        setRecords(data);
    };

    const filteredRecords = useMemo(() => {
        let list = records;
        
        // Filter by Tab
        if (subTab === 'list') list = list.filter(r => r.status === 'draft');
        if (subTab === 'sign') list = list.filter(r => r.status === 'pending_sign');
        if (subTab === 'result') list = list.filter(r => r.status === 'completed');

        // Filter by Search
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            list = list.filter(r => 
                (r.so_hieu || '').toLowerCase().includes(lower) ||
                (r.trich_yeu || '').toLowerCase().includes(lower) ||
                (r.noi_nhan_gui || '').toLowerCase().includes(lower)
            );
        }
        return list;
    }, [records, subTab, searchTerm]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.so_hieu || !formData.trich_yeu) { alert('Vui lòng nhập Số hiệu và Trích yếu.'); return; }
        
        const success = await saveArchiveRecord({
            ...formData,
            id: editingId || undefined,
            created_by: currentUser.username
        });

        if (success) {
            await loadData();
            setIsFormOpen(false);
            setEditingId(null);
            setFormData({ type: 'saoluc', status: 'draft', so_hieu: '', trich_yeu: '', ngay_thang: new Date().toISOString().split('T')[0], noi_nhan_gui: '' });
        } else {
            alert('Lỗi khi lưu.');
        }
    };

    const handleStatusChange = async (record: ArchiveRecord, newStatus: ArchiveRecord['status']) => {
        if (await confirmAction(`Chuyển trạng thái hồ sơ ${record.so_hieu}?`)) {
            await saveArchiveRecord({ ...record, status: newStatus });
            loadData();
        }
    };

    const handleDelete = async (id: string) => {
        if (await confirmAction('Xóa hồ sơ sao lục này?')) {
            await deleteArchiveRecord(id);
            loadData();
        }
    };

    const handleEdit = (r: ArchiveRecord) => {
        setFormData(r);
        setEditingId(r.id);
        setIsFormOpen(true);
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* TOOLBAR */}
            <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4 items-center bg-gray-50">
                <div className="flex bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                    <button onClick={() => setSubTab('list')} className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 ${subTab === 'list' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <ListChecks size={16}/> Danh sách
                    </button>
                    <button onClick={() => setSubTab('sign')} className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 ${subTab === 'sign' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <Send size={16}/> Trình ký
                    </button>
                    <button onClick={() => setSubTab('result')} className={`px-4 py-2 text-sm font-bold rounded-md flex items-center gap-2 ${subTab === 'result' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <FileCheck size={16}/> Kết quả
                    </button>
                </div>

                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Tìm kiếm..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>

                {subTab === 'list' && (
                    <button onClick={() => { setIsFormOpen(true); setEditingId(null); setFormData({type: 'saoluc', status: 'draft', so_hieu: '', trich_yeu: '', ngay_thang: new Date().toISOString().split('T')[0], noi_nhan_gui: ''}); }} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 shadow-sm">
                        <Plus size={16}/> Thêm mới
                    </button>
                )}
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-auto p-4 flex gap-4">
                {isFormOpen && (
                    <div className="w-1/3 min-w-[300px] border-r pr-4 bg-gray-50 p-4 rounded-lg h-full flex flex-col">
                        <h3 className="font-bold text-gray-800 mb-4">{editingId ? 'Cập nhật Sao Lục' : 'Thêm mới Sao Lục'}</h3>
                        <form onSubmit={handleSave} className="space-y-3 flex-1 overflow-y-auto">
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Số hiệu</label><input className="w-full border rounded px-3 py-2 text-sm" value={formData.so_hieu} onChange={e => setFormData({...formData, so_hieu: e.target.value})} placeholder="Số HS..." /></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Ngày tháng</label><input type="date" className="w-full border rounded px-3 py-2 text-sm" value={formData.ngay_thang} onChange={e => setFormData({...formData, ngay_thang: e.target.value})} /></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Trích yếu</label><textarea rows={3} className="w-full border rounded px-3 py-2 text-sm" value={formData.trich_yeu} onChange={e => setFormData({...formData, trich_yeu: e.target.value})} placeholder="Nội dung..." /></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Nơi nhận / Gửi</label><input className="w-full border rounded px-3 py-2 text-sm" value={formData.noi_nhan_gui} onChange={e => setFormData({...formData, noi_nhan_gui: e.target.value})} placeholder="Đơn vị..." /></div>
                            
                            <div className="pt-4 flex gap-2 justify-end">
                                <button type="button" onClick={() => setIsFormOpen(false)} className="px-3 py-2 text-gray-600 hover:bg-gray-200 rounded text-sm">Hủy</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-bold text-sm hover:bg-blue-700 flex items-center gap-1"><Save size={16}/> Lưu</button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-100 text-xs font-bold text-gray-600 uppercase sticky top-0">
                            <tr>
                                <th className="p-3 w-10 text-center">#</th>
                                <th className="p-3 w-32">Số hiệu</th>
                                <th className="p-3 w-28">Ngày</th>
                                <th className="p-3">Trích yếu</th>
                                <th className="p-3 w-40">Nơi nhận/Gửi</th>
                                <th className="p-3 w-32 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-100">
                            {filteredRecords.length > 0 ? filteredRecords.map((r, idx) => (
                                <tr key={r.id} className="hover:bg-blue-50/50">
                                    <td className="p-3 text-center text-gray-500">{idx + 1}</td>
                                    <td className="p-3 font-bold text-blue-600">{r.so_hieu}</td>
                                    <td className="p-3 text-gray-600">{r.ngay_thang?.split('-').reverse().join('/')}</td>
                                    <td className="p-3 text-gray-800">{r.trich_yeu}</td>
                                    <td className="p-3 text-gray-600">{r.noi_nhan_gui}</td>
                                    <td className="p-3 text-center">
                                        <div className="flex justify-center gap-1">
                                            {r.status === 'draft' && (
                                                <button onClick={() => handleStatusChange(r, 'pending_sign')} className="p-1.5 text-purple-600 bg-purple-50 rounded hover:bg-purple-100" title="Trình ký"><Send size={14}/></button>
                                            )}
                                            {r.status === 'pending_sign' && (
                                                <div className="flex gap-1">
                                                    <button onClick={() => handleStatusChange(r, 'draft')} className="p-1.5 text-orange-600 bg-orange-50 rounded hover:bg-orange-100" title="Trả lại"><RotateCcw size={14}/></button>
                                                    <button onClick={() => handleStatusChange(r, 'completed')} className="p-1.5 text-green-600 bg-green-50 rounded hover:bg-green-100" title="Hoàn thành"><FileCheck size={14}/></button>
                                                </div>
                                            )}
                                            
                                            <button onClick={() => handleEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Sửa"><Edit size={14}/></button>
                                            <button onClick={() => handleDelete(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Xóa"><Trash2 size={14}/></button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">Không có dữ liệu</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SaoLucView;
