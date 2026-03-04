
import React, { useState, useEffect, useMemo } from 'react';
import { User, RecordFile, RecordStatus, Employee } from '../../types';
import { ArchiveRecord, fetchArchiveRecords, saveArchiveRecord, deleteArchiveRecord, updateArchiveRecordsBatch } from '../../services/apiArchive';
import { fetchEmployees } from '../../services/apiPeople';
import { Search, Plus, ListChecks, FileCheck, Send, Trash2, Edit, Save, X, RotateCcw, Users, User as UserIcon, LayoutGrid } from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';
import AssignModal from '../AssignModal';

interface CongVanViewProps {
    currentUser: User;
}

const CongVanView: React.FC<CongVanViewProps> = ({ currentUser }) => {
    const [subTab, setSubTab] = useState<'all' | 'draft' | 'sign' | 'result'>('all');
    const [records, setRecords] = useState<ArchiveRecord[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    
    // Assign Modal State
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const [formData, setFormData] = useState<Partial<ArchiveRecord>>({
        type: 'congvan',
        status: 'draft',
        so_hieu: '',
        trich_yeu: '',
        ngay_thang: new Date().toISOString().split('T')[0],
        noi_nhan_gui: ''
    });
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        loadData();
        loadEmployees();
    }, []);

    const loadData = async () => {
        const data = await fetchArchiveRecords('congvan');
        setRecords(data);
    };

    const loadEmployees = async () => {
        const data = await fetchEmployees();
        setEmployees(data);
    };

    const filteredRecords = useMemo(() => {
        let list = records;
        
        if (subTab === 'draft') list = list.filter(r => r.status === 'draft');
        if (subTab === 'sign') list = list.filter(r => r.status === 'pending_sign');
        if (subTab === 'result') list = list.filter(r => r.status === 'completed');
        // 'all' shows everything

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

    // Reset selection when tab changes
    useEffect(() => {
        setSelectedIds(new Set());
    }, [subTab]);

    const handleAssign = () => {
        if (selectedIds.size === 0) return;
        setShowAssignModal(true);
    };

    const handleConfirmAssign = async (employeeId: string) => {
        const updates = {
            status: 'assigned' as any,
            data: {
                assigned_to: employeeId,
                assigned_date: new Date().toISOString()
            }
        };
        
        await updateArchiveRecordsBatch(Array.from(selectedIds), updates);
        setShowAssignModal(false);
        setSelectedIds(new Set());
        loadData();
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

    // Helper để lấy tên nhân viên từ ID
    const getEmployeeName = (id?: string) => {
        if (!id) return '-';
        const emp = employees.find(e => e.id === id);
        return emp ? emp.name : id;
    };

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
            setFormData({ type: 'congvan', status: 'draft', so_hieu: '', trich_yeu: '', ngay_thang: new Date().toISOString().split('T')[0], noi_nhan_gui: '' });
        } else {
            alert('Lỗi khi lưu.');
        }
    };

    const handleStatusChange = async (record: ArchiveRecord, newStatus: ArchiveRecord['status']) => {
        if (await confirmAction(`Chuyển trạng thái công văn ${record.so_hieu}?`)) {
            await saveArchiveRecord({ ...record, status: newStatus });
            loadData();
        }
    };

    const handleDelete = async (id: string) => {
        if (await confirmAction('Xóa công văn này?')) {
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
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        QUẢN LÝ CÔNG VĂN
                    </h2>
                    <div className="relative flex-1 sm:w-64 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" 
                            placeholder="Tìm công văn..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-2 rounded-lg relative">
                    <div className="flex bg-white rounded-md border border-gray-200 p-1 mr-2 shadow-sm">
                        <button 
                            onClick={() => setSubTab('all')} 
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${subTab === 'all' ? 'bg-gray-100 text-gray-800 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <LayoutGrid size={16}/> Tất cả
                        </button>
                        <button 
                            onClick={() => setSubTab('draft')} 
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${subTab === 'draft' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <ListChecks size={16}/> Chưa giao
                        </button>
                        <button 
                            onClick={() => setSubTab('sign')} 
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${subTab === 'sign' ? 'bg-purple-100 text-purple-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <Send size={16}/> Trình ký
                        </button>
                        <button 
                            onClick={() => setSubTab('result')} 
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${subTab === 'result' ? 'bg-green-100 text-green-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <FileCheck size={16}/> Kết quả
                        </button>
                    </div>

                    <div className="ml-auto flex gap-2">
                        {(subTab === 'draft' || subTab === 'all') && (
                            <>
                                {selectedIds.size > 0 && (
                                    <button onClick={handleAssign} className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-indigo-700 shadow-sm animate-pulse">
                                        <Users size={16}/> Giao việc ({selectedIds.size})
                                    </button>
                                )}
                                <button onClick={() => { setIsFormOpen(true); setEditingId(null); setFormData({type: 'congvan', status: 'draft', so_hieu: '', trich_yeu: '', ngay_thang: new Date().toISOString().split('T')[0], noi_nhan_gui: ''}); }} className="flex items-center gap-2 bg-orange-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-orange-700 shadow-sm">
                                    <Plus size={16}/> Tạo mới
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-auto p-4 flex gap-4 relative">
                {/* Assign Modal */}
                <AssignModal 
                    isOpen={showAssignModal}
                    onClose={() => setShowAssignModal(false)}
                    onConfirm={handleConfirmAssign}
                    employees={employees}
                    selectedRecords={records.filter(r => selectedIds.has(r.id)).map(r => ({
                        id: r.id,
                        code: r.so_hieu,
                        customerName: r.noi_nhan_gui,
                        ward: '',
                        status: RecordStatus.RECEIVED
                    } as RecordFile))}
                    filterDepartment="Thông tin lưu trữ"
                />

                {isFormOpen && (
                    <div className="w-1/3 min-w-[300px] border-r pr-4 bg-gray-50 p-4 rounded-lg h-full flex flex-col">
                        <h3 className="font-bold text-gray-800 mb-4">{editingId ? 'Cập nhật Công văn' : 'Thêm mới Công văn'}</h3>
                        <form onSubmit={handleSave} className="space-y-3 flex-1 overflow-y-auto">
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Số hiệu</label><input className="w-full border rounded px-3 py-2 text-sm" value={formData.so_hieu} onChange={e => setFormData({...formData, so_hieu: e.target.value})} placeholder="Số CV..." /></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Ngày tháng</label><input type="date" className="w-full border rounded px-3 py-2 text-sm" value={formData.ngay_thang} onChange={e => setFormData({...formData, ngay_thang: e.target.value})} /></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Trích yếu</label><textarea rows={3} className="w-full border rounded px-3 py-2 text-sm" value={formData.trich_yeu} onChange={e => setFormData({...formData, trich_yeu: e.target.value})} placeholder="Nội dung..." /></div>
                            <div><label className="text-xs font-bold text-gray-500 uppercase">Nơi nhận / Gửi</label><input className="w-full border rounded px-3 py-2 text-sm" value={formData.noi_nhan_gui} onChange={e => setFormData({...formData, noi_nhan_gui: e.target.value})} placeholder="Đơn vị..." /></div>
                            
                            <div className="pt-4 flex gap-2 justify-end">
                                <button type="button" onClick={() => setIsFormOpen(false)} className="px-3 py-2 text-gray-600 hover:bg-gray-200 rounded text-sm">Hủy</button>
                                <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded font-bold text-sm hover:bg-orange-700 flex items-center gap-1"><Save size={16}/> Lưu</button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-100 text-xs font-bold text-gray-600 uppercase sticky top-0 shadow-sm z-10">
                            <tr>
                                <th className="p-3 w-10 text-center">
                                    <input type="checkbox" onChange={handleSelectAll} checked={filteredRecords.length > 0 && selectedIds.size === filteredRecords.length} />
                                </th>
                                <th className="p-3 w-10 text-center">#</th>
                                <th className="p-3 w-32">Số hiệu</th>
                                <th className="p-3 w-28">Ngày</th>
                                <th className="p-3">Trích yếu</th>
                                <th className="p-3 w-40">Nơi nhận/Gửi</th>
                                {(subTab === 'all' || subTab === 'sign' || subTab === 'result') && <th className="p-3 w-32">Người thực hiện</th>}
                                <th className="p-3 w-32 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-100">
                            {filteredRecords.length > 0 ? filteredRecords.map((r, idx) => (
                                <tr key={r.id} className={`hover:bg-orange-50/30 group ${selectedIds.has(r.id) ? 'bg-orange-50' : ''}`}>
                                    <td className="p-3 text-center">
                                        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => handleSelectRow(r.id)} />
                                    </td>
                                    <td className="p-3 text-center text-gray-500">{idx + 1}</td>
                                    <td className="p-3 font-bold text-orange-600">{r.so_hieu}</td>
                                    <td className="p-3 text-gray-600">{r.ngay_thang?.split('-').reverse().join('/')}</td>
                                    <td className="p-3 text-gray-800">{r.trich_yeu}</td>
                                    <td className="p-3 text-gray-600">{r.noi_nhan_gui}</td>
                                    {(subTab === 'all' || subTab === 'sign' || subTab === 'result') && (
                                        <td className="p-3 text-indigo-600 font-medium">
                                            {r.data?.assigned_to ? (
                                                <div className="flex items-center gap-1">
                                                    <UserIcon size={14}/> {getEmployeeName(r.data?.assigned_to)}
                                                </div>
                                            ) : <span className="text-gray-400 text-xs italic">Chưa giao</span>}
                                        </td>
                                    )}
                                    <td className="p-3 text-center">
                                        <div className="flex justify-center gap-1">
                                            {r.status === 'draft' && (
                                                <button onClick={() => { setSelectedIds(new Set([r.id])); setShowAssignModal(true); }} className="p-1.5 text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100" title="Giao việc"><Users size={14}/></button>
                                            )}
                                            {r.status === 'assigned' && (
                                                <>
                                                    <button onClick={() => handleStatusChange(r, 'draft')} className="p-1.5 text-orange-600 bg-orange-50 rounded hover:bg-orange-100" title="Thu hồi"><RotateCcw size={14}/></button>
                                                    <button onClick={() => handleStatusChange(r, 'pending_sign')} className="p-1.5 text-purple-600 bg-purple-50 rounded hover:bg-purple-100" title="Trình ký"><Send size={14}/></button>
                                                </>
                                            )}
                                            {r.status === 'pending_sign' && (
                                                <div className="flex gap-1">
                                                    <button onClick={() => handleStatusChange(r, 'assigned')} className="p-1.5 text-orange-600 bg-orange-50 rounded hover:bg-orange-100" title="Trả lại"><RotateCcw size={14}/></button>
                                                    <button onClick={() => handleStatusChange(r, 'completed')} className="p-1.5 text-green-600 bg-green-50 rounded hover:bg-green-100" title="Hoàn thành"><FileCheck size={14}/></button>
                                                </div>
                                            )}
                                            
                                            <button onClick={() => handleEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Sửa"><Edit size={14}/></button>
                                            <button onClick={() => handleDelete(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Xóa"><Trash2 size={14}/></button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={(subTab === 'all' || subTab === 'sign' || subTab === 'result') ? 8 : 7} className="p-8 text-center text-gray-400 italic">Không có dữ liệu</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CongVanView;
