
import React, { useState, useEffect, useMemo } from 'react';
import { User, RecordFile, RecordStatus, Employee } from '../../types';
import { ArchiveRecord, fetchArchiveRecords, saveArchiveRecord, deleteArchiveRecord, updateArchiveRecordsBatch } from '../../services/apiArchive';
import { fetchEmployees } from '../../services/apiPeople';
import { Search, Plus, ListChecks, FileCheck, Send, Trash2, Edit, Save, X, RotateCcw, MapPin, Calendar, User as UserIcon, Users, CheckCircle2, LayoutGrid, PenTool, CheckCircle, Eye } from 'lucide-react';
import { confirmAction } from '../../utils/appHelpers';
import AssignModal from '../AssignModal';
import ArchiveDetailModal from './ArchiveDetailModal';
import { STATUS_LABELS, STATUS_COLORS } from '../../constants';

interface SaoLucViewProps {
    currentUser: User;
    wards?: string[];
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
    status: 'draft' | 'assigned' | 'executed' | 'pending_sign' | 'signed' | 'completed';
}

const SaoLucView: React.FC<SaoLucViewProps> = ({ currentUser, wards = ['Minh Hưng', 'Chơn Thành', 'Nha Bích'] }) => {
    const [subTab, setSubTab] = useState<'all' | 'draft' | 'assigned' | 'executed' | 'sign' | 'signed' | 'result'>('all');
    const [records, setRecords] = useState<ArchiveRecord[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    
    // Filters
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [filterWard, setFilterWard] = useState('');
    const [filterEmployee, setFilterEmployee] = useState('');
    
    // Detail Modal State
    const [detailRecord, setDetailRecord] = useState<ArchiveRecord | null>(null);

    // Assign Modal State
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    
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

    useEffect(() => {
        loadData();
        loadEmployees();
    }, []);

    const loadData = async () => {
        const data = await fetchArchiveRecords('saoluc');
        setRecords(data);
    };

    const loadEmployees = async () => {
        const data = await fetchEmployees();
        setEmployees(data);
    };

    const filteredRecords = useMemo(() => {
        let list = records;
        
        // Filter by Tab
        if (subTab === 'draft') list = list.filter(r => r.status === 'draft');
        if (subTab === 'assigned') list = list.filter(r => r.status === 'assigned');
        if (subTab === 'executed') list = list.filter(r => r.status === 'executed');
        if (subTab === 'sign') list = list.filter(r => r.status === 'pending_sign');
        if (subTab === 'signed') list = list.filter(r => r.status === 'signed');
        if (subTab === 'result') list = list.filter(r => r.status === 'completed');
        // 'all' shows everything

        // Filter by Date
        if (fromDate) list = list.filter(r => r.ngay_thang >= fromDate);
        if (toDate) list = list.filter(r => r.ngay_thang <= toDate);

        // Filter by Ward
        if (filterWard) list = list.filter(r => r.data?.xa_phuong === filterWard);

        // Filter by Employee
        if (filterEmployee) list = list.filter(r => r.data?.assigned_to === filterEmployee);

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
    }, [records, subTab, searchTerm, fromDate, toDate, filterWard, filterEmployee]);

    // Reset selection when tab changes
    useEffect(() => {
        setSelectedIds(new Set());
    }, [subTab]);

    const handleAssign = () => {
        if (selectedIds.size === 0) return;
        setShowAssignModal(true);
    };

    const handleConfirmAssign = async (employeeId: string) => {
        const historyEntry = {
            action: 'Giao việc',
            status: 'assigned',
            timestamp: new Date().toISOString(),
            user: currentUser.name,
            note: `Giao cho nhân viên: ${getEmployeeName(employeeId)}`
        };

        const updates = {
            status: 'assigned' as any,
            data: {
                assigned_to: employeeId,
                assigned_date: new Date().toISOString(),
                history: [historyEntry] // Will be appended by updateArchiveRecordsBatch
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
        let confirmMsg = '';
        let actionName = '';
        switch (newStatus) {
            case 'draft': confirmMsg = 'Thu hồi hồ sơ về trạng thái Nháp?'; actionName = 'Thu hồi'; break;
            case 'executed': confirmMsg = 'Xác nhận đã thực hiện xong?'; actionName = 'Thực hiện xong'; break;
            case 'pending_sign': confirmMsg = 'Trình ký hồ sơ này?'; actionName = 'Trình ký'; break;
            case 'signed': confirmMsg = 'Xác nhận đã ký duyệt?'; actionName = 'Ký duyệt'; break;
            case 'completed': confirmMsg = 'Xác nhận hoàn thành hồ sơ?'; actionName = 'Hoàn thành'; break;
            default: confirmMsg = 'Chuyển trạng thái?'; actionName = 'Chuyển trạng thái';
        }

        if (await confirmAction(confirmMsg)) {
            const historyEntry = {
                action: actionName,
                status: newStatus,
                timestamp: new Date().toISOString(),
                user: currentUser.name
            };
            
            const oldHistory = Array.isArray(record.data?.history) ? record.data.history : [];
            const newHistory = [...oldHistory, historyEntry];

            await saveArchiveRecord({ 
                ...record, 
                status: newStatus,
                data: { ...record.data, history: newHistory }
            });
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

    const mapStatusToEnum = (s: string): RecordStatus => {
        switch(s) {
            case 'draft': return RecordStatus.RECEIVED;
            case 'assigned': return RecordStatus.ASSIGNED;
            case 'executed': return RecordStatus.COMPLETED_WORK;
            case 'pending_sign': return RecordStatus.PENDING_SIGN;
            case 'signed': return RecordStatus.SIGNED;
            case 'completed': return RecordStatus.RETURNED;
            default: return RecordStatus.RECEIVED;
        }
    };

    const isManager = (currentUser.role as string) === 'ADMIN' || (currentUser.role as string) === 'SUBADMIN' || (currentUser.role as string) === 'admin' || (currentUser.role as string) === 'subadmin';

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        Sao lục hồ sơ
                    </h2>
                    <div className="relative flex-1 sm:w-64 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                            placeholder="Tìm Mã HS, Chủ sử dụng..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                        />
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded border border-gray-200">
                        <Calendar size={14} className="text-gray-500"/>
                        <input type="date" className="text-xs border-none outline-none text-gray-600 w-24" value={fromDate} onChange={e => setFromDate(e.target.value)} placeholder="Từ ngày" />
                        <span className="text-gray-400">-</span>
                        <input type="date" className="text-xs border-none outline-none text-gray-600 w-24" value={toDate} onChange={e => setToDate(e.target.value)} placeholder="Đến ngày" />
                    </div>

                    <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded border border-gray-200">
                        <MapPin size={14} className="text-gray-500"/>
                        <select className="text-xs border-none outline-none text-gray-600 bg-transparent min-w-[100px]" value={filterWard} onChange={e => setFilterWard(e.target.value)}>
                            <option value="">Tất cả Xã/Phường</option>
                            {wards.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded border border-gray-200">
                        <Users size={14} className="text-gray-500"/>
                        <select className="text-xs border-none outline-none text-gray-600 bg-transparent min-w-[100px]" value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
                            <option value="">Tất cả Nhân viên</option>
                            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
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
                            <ListChecks size={16}/> Chưa giao việc
                        </button>
                        <button 
                            onClick={() => setSubTab('assigned')} 
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${subTab === 'assigned' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <Users size={16}/> Đang thực hiện
                        </button>
                        <button 
                            onClick={() => setSubTab('executed')} 
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${subTab === 'executed' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <CheckCircle2 size={16}/> Đã thực hiện
                        </button>
                        <button 
                            onClick={() => setSubTab('sign')} 
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${subTab === 'sign' ? 'bg-purple-100 text-purple-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <Send size={16}/> Trình ký
                        </button>
                        <button 
                            onClick={() => setSubTab('signed')} 
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${subTab === 'signed' ? 'bg-teal-100 text-teal-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <PenTool size={16}/> Ký duyệt
                        </button>
                        <button 
                            onClick={() => setSubTab('result')} 
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${subTab === 'result' ? 'bg-green-100 text-green-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <FileCheck size={16}/> Hoàn thành
                        </button>
                    </div>

                    <div className="ml-auto flex gap-2">
                        {(subTab === 'draft' || subTab === 'all') && isManager && (
                            <>
                                {selectedIds.size > 0 && (
                                    <button onClick={handleAssign} className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-indigo-700 shadow-sm animate-pulse">
                                        <Users size={16}/> Giao việc ({selectedIds.size})
                                    </button>
                                )}
                                <button onClick={handleAddNew} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-blue-700 shadow-sm">
                                    <Plus size={16}/> Thêm mới
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-auto p-4 flex gap-6 bg-white relative">
                {/* Detail Modal */}
                <ArchiveDetailModal 
                    isOpen={!!detailRecord}
                    onClose={() => setDetailRecord(null)}
                    record={detailRecord}
                    getEmployeeName={getEmployeeName}
                />

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
                        ward: r.data?.xa_phuong,
                        status: RecordStatus.RECEIVED
                    } as RecordFile))}
                    filterDepartment="Thông tin lưu trữ"
                />

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
                                        {wards.map(w => <option key={w} value={w}>{w}</option>)}
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
                                    <th className="p-3 w-10 text-center">
                                        <input type="checkbox" onChange={handleSelectAll} checked={filteredRecords.length > 0 && selectedIds.size === filteredRecords.length} />
                                    </th>
                                    <th className="p-3 w-10 text-center">#</th>
                                    <th className="p-3 w-32 text-center">Mã HS</th>
                                    <th className="p-3 w-48 text-center">Chủ sử dụng</th>
                                    <th className="p-3 w-32 text-center">Xã/Phường</th>
                                    <th className="p-3 w-20 text-center">Tờ / Thửa</th>
                                    <th className="p-3 w-24 text-center">Ngày nhận</th>
                                    {(subTab === 'all') && <th className="p-3 w-32 text-center">Trạng thái</th>}
                                    {(subTab !== 'draft') && <th className="p-3 w-48 text-center">Người thực hiện</th>}
                                    <th className="p-3 w-24 text-center">Hẹn trả</th>
                                    <th className="p-3 w-64 text-center">Nội dung</th>
                                    <th className="p-3 w-28 text-center">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-gray-100">
                                {filteredRecords.length > 0 ? filteredRecords.map((r, idx) => (
                                    <tr key={r.id} className={`hover:bg-blue-50/50 group ${selectedIds.has(r.id) ? 'bg-blue-50' : ''}`}>
                                        <td className="p-3 text-center">
                                            <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => handleSelectRow(r.id)} />
                                        </td>
                                        <td className="p-3 text-center text-gray-500">{idx + 1}</td>
                                        <td className="p-3 font-bold text-blue-600 cursor-pointer hover:underline" onClick={() => setDetailRecord(r)}>{r.so_hieu}</td>
                                        <td className="p-3 font-medium text-gray-800">{r.noi_nhan_gui}</td>
                                        <td className="p-3 text-gray-600">{r.data?.xa_phuong}</td>
                                        <td className="p-3 text-center font-mono text-xs">{r.data?.to_ban_do || '-'} / {r.data?.thua_dat || '-'}</td>
                                        <td className="p-3 text-gray-600">{formatDate(r.ngay_thang)}</td>
                                        {(subTab === 'all') && (
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${STATUS_COLORS[mapStatusToEnum(r.status)]}`}>
                                                    {STATUS_LABELS[mapStatusToEnum(r.status)]}
                                                </span>
                                            </td>
                                        )}
                                        {(subTab !== 'draft') && (
                                            <td className="p-3 text-indigo-600 font-medium">
                                                {r.data?.assigned_to ? (
                                                    <div className="flex items-center gap-1">
                                                        <UserIcon size={14}/> {getEmployeeName(r.data?.assigned_to)}
                                                    </div>
                                                ) : <span className="text-gray-400 text-xs italic">Chưa giao</span>}
                                            </td>
                                        )}
                                        <td className="p-3 text-purple-600 font-medium">{formatDate(r.data?.hen_tra)}</td>
                                        <td className="p-3 text-gray-500 italic truncate max-w-xs">{r.trich_yeu}</td>
                                        <td className="p-3 text-center">
                                            <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setDetailRecord(r)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded" title="Xem chi tiết"><Eye size={14}/></button>
                                                {r.status === 'draft' && isManager && (
                                                    <button onClick={() => { setSelectedIds(new Set([r.id])); setShowAssignModal(true); }} className="p-1.5 text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100" title="Giao việc"><Users size={14}/></button>
                                                )}
                                                
                                                {r.status === 'assigned' && isManager && (
                                                    <>
                                                        <button onClick={() => handleStatusChange(r, 'draft')} className="p-1.5 text-orange-600 bg-orange-50 rounded hover:bg-orange-100" title="Thu hồi"><RotateCcw size={14}/></button>
                                                        <button onClick={() => handleStatusChange(r, 'executed')} className="p-1.5 text-blue-600 bg-blue-50 rounded hover:bg-blue-100" title="Đã thực hiện"><CheckCircle size={14}/></button>
                                                    </>
                                                )}

                                                {r.status === 'executed' && isManager && (
                                                    <>
                                                        <button onClick={() => handleStatusChange(r, 'assigned')} className="p-1.5 text-orange-600 bg-orange-50 rounded hover:bg-orange-100" title="Quay lại"><RotateCcw size={14}/></button>
                                                        <button onClick={() => handleStatusChange(r, 'pending_sign')} className="p-1.5 text-purple-600 bg-purple-50 rounded hover:bg-purple-100" title="Trình ký"><Send size={14}/></button>
                                                    </>
                                                )}

                                                {r.status === 'pending_sign' && isManager && (
                                                    <>
                                                        <button onClick={() => handleStatusChange(r, 'executed')} className="p-1.5 text-orange-600 bg-orange-50 rounded hover:bg-orange-100" title="Trả lại"><RotateCcw size={14}/></button>
                                                        <button onClick={() => handleStatusChange(r, 'signed')} className="p-1.5 text-teal-600 bg-teal-50 rounded hover:bg-teal-100" title="Ký duyệt"><PenTool size={14}/></button>
                                                    </>
                                                )}

                                                {r.status === 'signed' && isManager && (
                                                    <>
                                                        <button onClick={() => handleStatusChange(r, 'pending_sign')} className="p-1.5 text-orange-600 bg-orange-50 rounded hover:bg-orange-100" title="Trả lại"><RotateCcw size={14}/></button>
                                                        <button onClick={() => handleStatusChange(r, 'completed')} className="p-1.5 text-green-600 bg-green-50 rounded hover:bg-green-100" title="Hoàn thành"><FileCheck size={14}/></button>
                                                    </>
                                                )}
                                                
                                                {isManager && (
                                                    <>
                                                        <button onClick={() => handleEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Sửa"><Edit size={14}/></button>
                                                        <button onClick={() => handleDelete(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Xóa"><Trash2 size={14}/></button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={(subTab !== 'draft') ? 12 : 11} className="p-8 text-center text-gray-400 italic">Không có dữ liệu</td></tr>
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
