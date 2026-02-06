
import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../../types';
import { ArchiveRecord, fetchArchiveRecords, saveArchiveRecord, deleteArchiveRecord } from '../../services/apiArchive';
import { Search, Plus, ListChecks, FileCheck, Send, Trash2, Edit, Save, X, RotateCcw, MapPin, Calendar, User as UserIcon } from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';

interface SaoLucViewProps {
    currentUser: User;
}

// Định nghĩa form state riêng để dễ quản lý các trường trong JSON data
interface SaoLucFormData {
    id?: string;
    so_hieu: string;        // Mã hồ sơ
    chu_su_dung: string;    // Chủ sử dụng (Map vào noi_nhan_gui)
    xa_phuong: string;      // Xã phường (Lưu trong data)
    to_ban_do: string;      // Tờ (Lưu trong data)
    thua_dat: string;       // Thửa (Lưu trong data)
    ngay_nhan: string;      // Ngày nhận (Map vào ngay_thang)
    hen_tra: string;        // Hẹn trả (Lưu trong data)
    noi_dung: string;       // Nội dung yêu cầu (Map vào trich_yeu)
    status: 'draft' | 'pending_sign' | 'completed';
}

const WARDS = ['Minh Hưng', 'Chơn Thành', 'Nha Bích'];

const SaoLucView: React.FC<SaoLucViewProps> = ({ currentUser }) => {
    const [subTab, setSubTab] = useState<'list' | 'sign' | 'result'>('list');
    const [records, setRecords] = useState<ArchiveRecord[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    
    // Form State
    const [formData, setFormData] = useState<SaoLucFormData>({
        so_hieu: '',
        chu_su_dung: '',
        xa_phuong: 'Chơn Thành',
        to_ban_do: '',
        thua_dat: '',
        ngay_nhan: new Date().toISOString().split('T')[0],
        hen_tra: '',
        noi_dung: '',
        status: 'draft'
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
                (r.noi_nhan_gui || '').toLowerCase().includes(lower) || // Chủ sử dụng
                (r.trich_yeu || '').toLowerCase().includes(lower)
            );
        }
        return list;
    }, [records, subTab, searchTerm]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.so_hieu || !formData.chu_su_dung) { 
            alert('Vui lòng nhập Mã hồ sơ và Chủ sử dụng.'); 
            return; 
        }
        
        // Map form data về cấu trúc ArchiveRecord
        const recordToSave: Partial<ArchiveRecord> = {
            id: editingId || undefined,
            type: 'saoluc',
            status: formData.status,
            so_hieu: formData.so_hieu,          // Mã hồ sơ
            noi_nhan_gui: formData.chu_su_dung, // Chủ sử dụng
            ngay_thang: formData.ngay_nhan,     // Ngày nhận
            trich_yeu: formData.noi_dung,       // Nội dung
            data: {                             // Các trường mở rộng
                xa_phuong: formData.xa_phuong,
                to_ban_do: formData.to_ban_do,
                thua_dat: formData.thua_dat,
                hen_tra: formData.hen_tra
            },
            created_by: currentUser.username
        };

        const success = await saveArchiveRecord(recordToSave);

        if (success) {
            await loadData();
            setIsFormOpen(false);
            setEditingId(null);
            resetForm();
        } else {
            alert('Lỗi khi lưu.');
        }
    };

    const resetForm = () => {
        setFormData({
            so_hieu: '',
            chu_su_dung: '',
            xa_phuong: 'Chơn Thành',
            to_ban_do: '',
            thua_dat: '',
            ngay_nhan: new Date().toISOString().split('T')[0],
            hen_tra: '',
            noi_dung: '',
            status: 'draft'
        });
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
        setEditingId(r.id);
        // Map từ DB về Form
        setFormData({
            id: r.id,
            so_hieu: r.so_hieu,
            chu_su_dung: r.noi_nhan_gui,
            ngay_nhan: r.ngay_thang,
            noi_dung: r.trich_yeu,
            status: r.status,
            xa_phuong: r.data?.xa_phuong || 'Chơn Thành',
            to_ban_do: r.data?.to_ban_do || '',
            thua_dat: r.data?.thua_dat || '',
            hen_tra: r.data?.hen_tra || ''
        });
        setIsFormOpen(true);
    };

    const handleAddNew = () => {
        setIsFormOpen(true);
        setEditingId(null);
        resetForm();
    };

    const formatDate = (d: string) => d ? d.split('-').reverse().join('/') : '';

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
                    <input className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Tìm Mã HS, Chủ sử dụng..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>

                {subTab === 'list' && (
                    <button onClick={handleAddNew} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 shadow-sm">
                        <Plus size={16}/> Thêm mới
                    </button>
                )}
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-auto p-4 flex gap-6 bg-slate-50">
                {isFormOpen && (
                    <div className="w-[350px] shrink-0 bg-white border border-gray-200 p-5 rounded-xl h-full flex flex-col shadow-sm animate-fade-in-up">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-gray-800 text-lg">{editingId ? 'Cập nhật Sao Lục' : 'Thêm mới Sao Lục'}</h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-red-500"><X size={20}/></button>
                        </div>
                        
                        <form onSubmit={handleSave} className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Mã hồ sơ <span className="text-red-500">*</span></label>
                                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-700" value={formData.so_hieu} onChange={e => setFormData({...formData, so_hieu: e.target.value})} placeholder="Số HS..." />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block flex items-center gap-1"><UserIcon size={12}/> Chủ sử dụng <span className="text-red-500">*</span></label>
                                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.chu_su_dung} onChange={e => setFormData({...formData, chu_su_dung: e.target.value})} placeholder="Nguyễn Văn A..." />
                            </div>

                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block flex items-center gap-1"><MapPin size={12}/> Vị trí đất</label>
                                <div className="space-y-3">
                                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none" value={formData.xa_phuong} onChange={e => setFormData({...formData, xa_phuong: e.target.value})}>
                                        {WARDS.map(w => <option key={w} value={w}>{w}</option>)}
                                    </select>
                                    <div className="flex gap-2">
                                        <div>
                                            <input className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-center outline-none" value={formData.to_ban_do} onChange={e => setFormData({...formData, to_ban_do: e.target.value})} placeholder="Tờ" />
                                        </div>
                                        <div>
                                            <input className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm text-center outline-none" value={formData.thua_dat} onChange={e => setFormData({...formData, thua_dat: e.target.value})} placeholder="Thửa" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Ngày nhận</label>
                                    <input type="date" className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm outline-none" value={formData.ngay_nhan} onChange={e => setFormData({...formData, ngay_nhan: e.target.value})} />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-purple-600 uppercase mb-1 block">Hẹn trả</label>
                                    <input type="date" className="w-full border border-purple-200 bg-purple-50 rounded-lg px-2 py-2 text-sm outline-none text-purple-700 font-medium" value={formData.hen_tra} onChange={e => setFormData({...formData, hen_tra: e.target.value})} />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Nội dung yêu cầu</label>
                                <textarea rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" value={formData.noi_dung} onChange={e => setFormData({...formData, noi_dung: e.target.value})} placeholder="Nhập nội dung..." />
                            </div>
                            
                            <div className="pt-2 flex gap-2 justify-end border-t border-gray-100">
                                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Hủy</button>
                                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 flex items-center gap-1 shadow-sm"><Save size={16}/> Lưu</button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="flex-1 overflow-hidden bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
                    <div className="overflow-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-100 text-xs font-bold text-gray-600 uppercase sticky top-0 shadow-sm z-10">
                                <tr>
                                    <th className="p-3 w-10 text-center">#</th>
                                    <th className="p-3 w-32">Mã HS</th>
                                    <th className="p-3 w-48">Chủ sử dụng</th>
                                    <th className="p-3 w-32">Xã/Phường</th>
                                    <th className="p-3 w-20 text-center">Tờ / Thửa</th>
                                    <th className="p-3 w-24">Ngày nhận</th>
                                    <th className="p-3 w-24">Hẹn trả</th>
                                    <th className="p-3">Nội dung</th>
                                    <th className="p-3 w-28 text-center">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-gray-100">
                                {filteredRecords.length > 0 ? filteredRecords.map((r, idx) => (
                                    <tr key={r.id} className="hover:bg-blue-50/50 group">
                                        <td className="p-3 text-center text-gray-500">{idx + 1}</td>
                                        <td className="p-3 font-bold text-blue-600">{r.so_hieu}</td>
                                        <td className="p-3 font-medium text-gray-800">{r.noi_nhan_gui}</td>
                                        <td className="p-3 text-gray-600">{r.data?.xa_phuong}</td>
                                        <td className="p-3 text-center font-mono text-xs">{r.data?.to_ban_do || '-'} / {r.data?.thua_dat || '-'}</td>
                                        <td className="p-3 text-gray-600">{formatDate(r.ngay_thang)}</td>
                                        <td className="p-3 text-purple-600 font-medium">{formatDate(r.data?.hen_tra)}</td>
                                        <td className="p-3 text-gray-500 italic truncate max-w-xs">{r.trich_yeu}</td>
                                        <td className="p-3 text-center">
                                            <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {r.status === 'draft' && (
                                                    <button onClick={() => handleStatusChange(r, 'pending_sign')} className="p-1.5 text-purple-600 bg-purple-50 rounded hover:bg-purple-100" title="Trình ký"><Send size={14}/></button>
                                                )}
                                                {r.status === 'pending_sign' && (
                                                    <>
                                                        <button onClick={() => handleStatusChange(r, 'draft')} className="p-1.5 text-orange-600 bg-orange-50 rounded hover:bg-orange-100" title="Trả lại"><RotateCcw size={14}/></button>
                                                        <button onClick={() => handleStatusChange(r, 'completed')} className="p-1.5 text-green-600 bg-green-50 rounded hover:bg-green-100" title="Hoàn thành"><FileCheck size={14}/></button>
                                                    </>
                                                )}
                                                
                                                <button onClick={() => handleEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Sửa"><Edit size={14}/></button>
                                                <button onClick={() => handleDelete(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Xóa"><Trash2 size={14}/></button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={9} className="p-8 text-center text-gray-400 italic">Không có dữ liệu</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SaoLucView;
