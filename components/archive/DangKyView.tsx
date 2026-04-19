import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Employee, UserRole } from '../../types';
import { ArchiveRecord, fetchArchiveRecords, saveArchiveRecord, deleteArchiveRecord, updateArchiveRecordsBatch, importArchiveRecords, deleteAllArchiveRecordsByType } from '../../services/apiArchive';
import { fetchEmployees, fetchUsers } from '../../services/apiPeople';
import { Search, Plus, Trash2, Edit, Save, X, Calendar, MapPin, Users, Send, CheckCircle2, FileSpreadsheet, Download, LayoutGrid, FileText, ClipboardList, FileSignature, CheckCircle, Upload } from 'lucide-react';
import { confirmAction, toTitleCase, removeVietnameseTones } from '../../utils/appHelpers';
import * as XLSX from 'xlsx-js-style';
import DeleteAllModal from './DeleteAllModal';
import AssignModal from '../AssignModal';

import RecordDetailModal from './RecordDetailModal';
import ReturnReasonModal from './ReturnReasonModal';

interface DangKyViewProps {
    currentUser: User;
    wards: string[];
}

interface DangKyFormData {
    id?: string;
    so_hieu: string; // Mã hồ sơ
    chuyen_quyen: string;
    chu_su_dung: string;
    cccd: string;
    loai_bien_dong: string;
    ngay_nhan: string;
    ngay_tra_kq: string;
    so_to: string;
    so_thua: string;
    dien_tich: string;
    dat_o: string;
    dia_danh: string;
    so_phat_hanh: string;
    status: 'tiep_nhan' | 'xu_ly' | 'tham_tra_thue' | 'chuyen_thue' | 'dong_thue' | 'ky_gcn' | 'hoan_thanh';
}

const DangKyView: React.FC<DangKyViewProps> = ({ currentUser, wards }) => {
    const [activeTab, setActiveTab] = useState<'all' | 'xu_ly' | 'thue' | 'gcn'>('all');
    const [thueSubTab, setThueSubTab] = useState<'tham_tra_thue' | 'chuyen_thue' | 'dong_thue'>('tham_tra_thue');
    const [records, setRecords] = useState<ArchiveRecord[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    
    // Filters
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [filterWard, setFilterWard] = useState('');
    const [filterAssignee, setFilterAssignee] = useState('');

    // Modal States
    const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignTargetStatus, setAssignTargetStatus] = useState<string>('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [detailRecord, setDetailRecord] = useState<ArchiveRecord | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    
    // Return States
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [returnTargetStatus, setReturnTargetStatus] = useState<string>('');
    
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<DangKyFormData>({
        so_hieu: '',
        chuyen_quyen: '',
        chu_su_dung: '',
        cccd: '',
        loai_bien_dong: '',
        ngay_nhan: new Date().toISOString().split('T')[0],
        ngay_tra_kq: '',
        so_to: '',
        so_thua: '',
        dien_tich: '',
        dat_o: '',
        dia_danh: '',
        so_phat_hanh: '',
        status: 'tiep_nhan'
    });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadData();
        loadEmployees();
    }, []);

    const loadData = async () => {
        const data = await fetchArchiveRecords('dangky');
        setRecords(data);
    };

    const loadEmployees = async () => {
        const data = await fetchEmployees();
        setEmployees(data);
    };

    const handleDeleteAll = async () => {
        await deleteAllArchiveRecordsByType('dangky');
        loadData();
    };

    const filteredEmployeesForAssign = useMemo(() => {
        if (assignTargetStatus === 'ky_gcn' || assignTargetStatus === 'chuyen_thue') {
            return employees.filter(e => e.position && (e.position.toLowerCase().includes('giám đốc') || e.position.toLowerCase().includes('phó giám đốc')));
        } else if (assignTargetStatus === 'tham_tra_thue') {
            return employees.filter(e => 
                e.department && e.department.toLowerCase().includes('đăng ký') && 
                e.position && (e.position.toLowerCase().includes('tổ trưởng') || e.position.toLowerCase().includes('tổ phó'))
            );
        }
        return employees;
    }, [employees, assignTargetStatus]);

    const filteredRecords = useMemo(() => {
        let list = records;
        
        // Filter by Tab
        if (activeTab === 'all') {
            // Show all
        } else if (activeTab === 'xu_ly') {
            list = list.filter(r => r.status === 'xu_ly');
            // Restrict EMPLOYEE to see only records from their assigned wards
            if (currentUser?.role === UserRole.EMPLOYEE) {
                const emp = employees.find(e => e.id === currentUser.employeeId);
                if (emp && emp.managedWards && emp.managedWards.length > 0) {
                    const normalizeWard = (w: string) => {
                        let str = removeVietnameseTones(w).toLowerCase();
                        // Loại bỏ các từ khóa phổ biến để so sánh chính xác cốt lõi
                        str = str.replace(/phuong|xa|thi tran|tt\.|p\.|x\./g, '');
                        // Xóa sạch mọi khoảng trắng và ký tự đặc biệt
                        return str.replace(/[^a-z0-9]/g, '');
                    };
                    const normalizedManagedWards = emp.managedWards.map(normalizeWard).filter(w => w.length > 0);
                    list = list.filter(r => {
                        const ward = r.data?.dia_danh || '';
                        if (!ward) return false;
                        const normalizedWard = normalizeWard(ward);
                        if (!normalizedWard) return false;
                        return normalizedManagedWards.some(mw => normalizedWard.includes(mw) || mw.includes(normalizedWard));
                    });
                } else if (emp) {
                    // Employee has no managed wards assigned, show nothing
                    list = [];
                }
            }
        } else if (activeTab === 'thue') {
            list = list.filter(r => r.status === thueSubTab);
        } else if (activeTab === 'gcn') {
            list = list.filter(r => r.status === 'ky_gcn');
        }

        // Filter by Date
        if (fromDate) list = list.filter(r => r.data?.ngay_nhan >= fromDate);
        if (toDate) list = list.filter(r => r.data?.ngay_nhan <= toDate);

        // Filter by Ward
        if (filterWard) {
            const normalizeWardStr = (w: string) => removeVietnameseTones(w).toLowerCase().replace(/phuong|xa|thi tran|tt\.|p\.|x\./g, '').replace(/[^a-z0-9]/g, '');
            const normalizedFilterWard = normalizeWardStr(filterWard);
            list = list.filter(r => {
                if (!r.data?.dia_danh) return false;
                const normalizedRecordWard = normalizeWardStr(r.data.dia_danh);
                if (!normalizedRecordWard || !normalizedFilterWard) return false;
                return normalizedRecordWard.includes(normalizedFilterWard) || normalizedFilterWard.includes(normalizedRecordWard);
            });
        }

        // Filter by Assignee
        if (filterAssignee) {
            list = list.filter(r => {
                const history = r.data?.history || [];
                const lastAssignment = [...history].reverse().find(h => h.assignedTo);
                return lastAssignment?.assignedTo === filterAssignee;
            });
        }

        // Filter by Search
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            list = list.filter(r => 
                (r.so_hieu || '').toLowerCase().includes(lower) ||
                (r.noi_nhan_gui || '').toLowerCase().includes(lower) ||
                (r.data?.cccd || '').toLowerCase().includes(lower)
            );
        }
        return list;
    }, [records, activeTab, thueSubTab, searchTerm, fromDate, toDate, filterWard, filterAssignee]);

    useEffect(() => {
        setSelectedIds(new Set());
        setCurrentPage(1);
    }, [activeTab, thueSubTab, searchTerm, fromDate, toDate, filterWard, filterAssignee]);

    const isManager = (currentUser.role as string) === 'ADMIN' || (currentUser.role as string) === 'SUBADMIN' || (currentUser.role as string) === 'admin' || (currentUser.role as string) === 'subadmin';

    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const toggleSelectAll = () => {
        if (selectedIds.size === paginatedRecords.length && paginatedRecords.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(paginatedRecords.map(r => r.id)));
        }
    };

    const toggleSelect = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const resetForm = () => {
        setFormData({
            so_hieu: '',
            chuyen_quyen: '',
            chu_su_dung: '',
            cccd: '',
            loai_bien_dong: '',
            ngay_nhan: new Date().toISOString().split('T')[0],
            ngay_tra_kq: '',
            so_to: '',
            so_thua: '',
            dien_tich: '',
            dat_o: '',
            dia_danh: '',
            so_phat_hanh: '',
            status: 'tiep_nhan'
        });
    };

    const handleSave = async () => {
        if (!formData.so_hieu || !formData.chu_su_dung) {
            alert('Vui lòng nhập Mã hồ sơ và Chủ sử dụng');
            return;
        }

        const record: Partial<ArchiveRecord> = {
            id: editingId || undefined,
            type: 'dangky',
            status: formData.status as any,
            so_hieu: formData.so_hieu,
            noi_nhan_gui: formData.chu_su_dung,
            trich_yeu: formData.loai_bien_dong,
            ngay_thang: formData.ngay_nhan,
            created_by: currentUser.username,
            data: {
                chuyen_quyen: formData.chuyen_quyen,
                cccd: formData.cccd,
                ngay_nhan: formData.ngay_nhan,
                ngay_tra_kq: formData.ngay_tra_kq,
                so_to: formData.so_to,
                so_thua: formData.so_thua,
                dien_tich: formData.dien_tich,
                dat_o: formData.dat_o,
                dia_danh: formData.dia_danh,
                so_phat_hanh: formData.so_phat_hanh,
                history: []
            }
        };

        if (editingId) {
            const existing = records.find(r => r.id === editingId);
            if (existing) {
                record.data.history = existing.data?.history || [];
            }
        }

        await saveArchiveRecord(record);
        setIsFormOpen(false);
        setEditingId(null);
        resetForm();
        loadData();
    };

    const handleEdit = (r: ArchiveRecord) => {
        setFormData({
            id: r.id,
            so_hieu: r.so_hieu || '',
            chu_su_dung: r.noi_nhan_gui || '',
            loai_bien_dong: r.trich_yeu || '',
            chuyen_quyen: r.data?.chuyen_quyen || '',
            cccd: r.data?.cccd || '',
            ngay_nhan: r.data?.ngay_nhan || '',
            ngay_tra_kq: r.data?.ngay_tra_kq || '',
            so_to: r.data?.so_to || '',
            so_thua: r.data?.so_thua || '',
            dien_tich: r.data?.dien_tich || '',
            dat_o: r.data?.dat_o || '',
            dia_danh: r.data?.dia_danh || '',
            so_phat_hanh: r.data?.so_phat_hanh || '',
            status: r.status as any
        });
        setEditingId(r.id);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (await confirmAction('Bạn có chắc chắn muốn xóa hồ sơ này?')) {
            await deleteArchiveRecord(id);
            loadData();
        }
    };

    const handleBatchStatusChange = async (newStatus: string, assignedTo?: string) => {
        if (selectedIds.size === 0) return;
        
        for (const id of Array.from(selectedIds)) {
            const record = records.find(r => r.id === id);
            if (!record) continue;
            
            const history = record.data?.history || [];
            history.push({
                action: `Chuyển trạng thái: ${newStatus}`,
                timestamp: new Date().toISOString(),
                user: currentUser.name,
                assignedTo: assignedTo
            });

            await saveArchiveRecord({
                ...record,
                status: newStatus as any,
                data: {
                    ...record.data,
                    history,
                    ...(assignedTo ? { assigned_to: assignedTo } : {})
                }
            });
        }

        setSelectedIds(new Set());
        loadData();
    };

    const handleBatchReturn = async (reason: string, targetStatus: string = returnTargetStatus) => {
        if (selectedIds.size === 0 || !targetStatus) return;
        
        for (const id of Array.from(selectedIds)) {
            const record = records.find(r => r.id === id);
            if (!record) continue;
            
            const history = record.data?.history || [];
            history.push({
                action: `Trả về bước trước`,
                content: `Lý do: ${reason}`,
                timestamp: new Date().toISOString(),
                user: currentUser.name
            });

            await saveArchiveRecord({
                ...record,
                status: targetStatus as any,
                data: {
                    ...record.data,
                    history
                }
            });
        }

        setSelectedIds(new Set());
        setShowReturnModal(false);
        loadData();
    };

    const handleMoveToVaoSo = async () => {
        if (selectedIds.size === 0) return;
        
        for (const id of Array.from(selectedIds)) {
            const record = records.find(r => r.id === id);
            if (!record) continue;

            // Create a new record for Vao So
            await saveArchiveRecord({
                type: 'vaoso',
                status: 'completed',
                so_hieu: record.so_hieu,
                noi_nhan_gui: record.noi_nhan_gui,
                trich_yeu: record.trich_yeu,
                ngay_thang: record.ngay_thang,
                created_by: currentUser.username,
                data: {
                    ...record.data,
                    ten_chuyen_quyen: record.data?.chuyen_quyen || '',
                    ten_chu_su_dung: record.noi_nhan_gui || '',
                    is_pending_scan: true,
                    is_scanned: false
                }
            });

            // Update the current record status to hoan_thanh
            const history = record.data?.history || [];
            history.push({
                action: `Chuyển sang Vào số GCN`,
                timestamp: new Date().toISOString(),
                user: currentUser.name,
            });

            await saveArchiveRecord({
                ...record,
                status: 'hoan_thanh',
                data: {
                    ...record.data,
                    history
                }
            });
        }

        setSelectedIds(new Set());
        loadData();
        alert(`Đã chuyển ${selectedIds.size} hồ sơ sang Vào số GCN`);
    };

    const handleImportClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const parseExcelDate = (val: any) => {
        if (!val) return '';
        if (typeof val === 'number') {
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            return date.toISOString().split('T')[0];
        }
        if (typeof val === 'string') {
            const str = val.trim();
            // Check if already YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
            
            // Try to parse DD/MM/YYYY or DD-MM-YYYY
            const parts = str.split(/[-/]/);
            if (parts.length === 3) {
                if (parts[0].length === 4) {
                    // YYYY/MM/DD
                    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                } else {
                    // DD/MM/YYYY
                    const day = parts[0].padStart(2, '0');
                    const month = parts[1].padStart(2, '0');
                    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                    return `${year}-${month}-${day}`;
                }
            }
        }
        return val.toString();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

                // Find header row
                let headerRowIdx = -1;
                for (let i = 0; i < Math.min(10, data.length); i++) {
                    const row: any = data[i];
                    if (row && row.length > 0 && row.some((cell: any) => typeof cell === 'string' && cell.toLowerCase().includes('mã hồ sơ'))) {
                        headerRowIdx = i;
                        break;
                    }
                }

                if (headerRowIdx === -1) {
                    alert('Không tìm thấy dòng tiêu đề. Vui lòng đảm bảo file có cột "Mã hồ sơ".');
                    return;
                }

                const rows = data.slice(headerRowIdx + 1);
                const newRecords: Partial<ArchiveRecord>[] = [];

                for (const row of rows as any[]) {
                    if (!row || row.length === 0 || !row[0]) continue;

                    newRecords.push({
                        type: 'dangky',
                        status: 'tiep_nhan',
                        so_hieu: row[0]?.toString() || '',
                        noi_nhan_gui: row[2]?.toString() || '', // Chủ sử dụng
                        trich_yeu: row[4]?.toString() || '', // Loại biến động
                        ngay_thang: parseExcelDate(row[5]),
                        data: {
                            chuyen_quyen: row[1]?.toString() || '',
                            cccd: row[3]?.toString() || '',
                            ngay_nhan: parseExcelDate(row[5]),
                            ngay_tra_kq: parseExcelDate(row[6]),
                            so_to: row[7]?.toString() || '',
                            so_thua: row[8]?.toString() || '',
                            dien_tich: row[9]?.toString() || '',
                            dat_o: row[10]?.toString() || '',
                            dia_danh: row[11]?.toString() || '',
                            so_phat_hanh: row[12]?.toString() || '',
                            history: []
                        },
                        created_by: currentUser.username,
                        created_at: new Date().toISOString()
                    });
                }

                if (newRecords.length > 0) {
                    const success = await importArchiveRecords(newRecords);
                    if (success) {
                        alert(`Đã import thành công ${newRecords.length} hồ sơ.`);
                        loadData();
                    } else {
                        alert('Có lỗi xảy ra khi import.');
                    }
                } else {
                    alert('Không tìm thấy dữ liệu hợp lệ trong file.');
                }
            } catch (error) {
                console.error("Import error", error);
                alert('Lỗi đọc file Excel.');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const handleDownloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([
            ['Mã hồ sơ', 'Chuyển quyền', 'Chủ sử dụng', 'CCCD', 'Loại biến động', 'Ngày nhận', 'Ngày trả kết quả (lần 1)', 'Số tờ', 'Số thửa', 'Diện tích', 'Đất ở', 'Địa danh', 'Số phát hành']
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Mau_DangKy");
        XLSX.writeFile(wb, "Mau_Import_DangKy.xlsx");
    };

    const openAssignModal = (targetStatus: string) => {
        setAssignTargetStatus(targetStatus);
        setShowAssignModal(true);
    };

    const handleConfirmAssign = (employeeId: string) => {
        handleBatchStatusChange(assignTargetStatus, employeeId);
        setShowAssignModal(false);
    };

    const getStatusLabel = (status: string) => {
        switch(status) {
            case 'tiep_nhan': return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">Tiếp nhận</span>;
            case 'xu_ly': return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">Xử lý</span>;
            case 'chuyen_thue': return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">Chuyển thuế</span>;
            case 'dong_thue': return <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">Đóng thuế</span>;
            case 'ky_gcn': return <span className="px-2 py-1 bg-teal-100 text-teal-700 rounded text-xs font-medium">Ký GCN</span>;
            case 'hoan_thanh': return <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Hoàn thành</span>;
            default: return <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">{status}</span>;
        }
    };

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        Đăng ký
                    </h2>
                    <div className="relative flex-1 sm:w-64 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                            placeholder="Tìm Mã HS, Chủ sử dụng, CCCD..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                        />
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-md border border-gray-200 shadow-sm">
                        <Calendar size={16} className="text-gray-500"/>
                        <input type="date" className="text-sm outline-none bg-transparent text-gray-700 w-28" value={fromDate} onChange={e => setFromDate(e.target.value)} placeholder="Từ ngày" />
                        <span className="text-gray-400">-</span>
                        <input type="date" className="text-sm outline-none bg-transparent text-gray-700 w-28" value={toDate} onChange={e => setToDate(e.target.value)} placeholder="Đến ngày" />
                    </div>

                    <div className="flex items-center gap-2 bg-white px-2 py-1.5 rounded-md border border-gray-200 shadow-sm">
                        <MapPin size={16} className="text-gray-500"/>
                        <select className="text-sm outline-none bg-transparent text-gray-700 font-medium cursor-pointer border-none focus:ring-0 min-w-[120px]" value={filterWard} onChange={e => setFilterWard(e.target.value)}>
                            <option value="">Tất cả Xã/Phường</option>
                            {wards.map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-2 rounded-lg relative">
                    <div className="flex bg-white rounded-md border border-gray-200 p-1 mr-2 shadow-sm">
                        <button 
                            onClick={() => setActiveTab('all')} 
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-gray-100 text-gray-800 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <LayoutGrid size={16}/> Tất cả hồ sơ
                        </button>
                        <button 
                            onClick={() => setActiveTab('xu_ly')} 
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'xu_ly' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <ClipboardList size={16}/> Xử lý hồ sơ
                        </button>
                        <button 
                            onClick={() => setActiveTab('thue')} 
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'thue' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <FileText size={16}/> Thuế
                        </button>
                        <button 
                            onClick={() => setActiveTab('gcn')} 
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'gcn' ? 'bg-teal-100 text-teal-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <FileSignature size={16}/> GCN
                        </button>
                    </div>

                    {activeTab === 'thue' && (
                        <>
                            <div className="flex bg-white rounded-md border border-gray-200 p-1 mr-2 shadow-sm">
                                <button 
                                    onClick={() => setThueSubTab('tham_tra_thue')} 
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${thueSubTab === 'tham_tra_thue' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                                >
                                    Thẩm tra thuế
                                </button>
                                <button 
                                    onClick={() => setThueSubTab('chuyen_thue')} 
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${thueSubTab === 'chuyen_thue' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                                >
                                    Đã chuyển thuế
                                </button>
                                <button 
                                    onClick={() => setThueSubTab('dong_thue')} 
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-colors ${thueSubTab === 'dong_thue' ? 'bg-purple-100 text-purple-700 shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}
                                >
                                    Đã đóng thuế
                                </button>
                            </div>
                            {(thueSubTab === 'tham_tra_thue' || thueSubTab === 'chuyen_thue') && (
                                <div className="flex items-center mr-2">
                                    <select
                                        className="p-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        value={filterAssignee}
                                        onChange={(e) => setFilterAssignee(e.target.value)}
                                    >
                                        <option value="">Tất cả người phụ trách</option>
                                        {employees
                                            .filter(e => {
                                                if (thueSubTab === 'tham_tra_thue') {
                                                    return e.department && e.department.toLowerCase().includes('đăng ký') && 
                                                           e.position && (e.position.toLowerCase().includes('tổ trưởng') || e.position.toLowerCase().includes('tổ phó'));
                                                } else {
                                                    return e.position && (e.position.toLowerCase().includes('giám đốc') || e.position.toLowerCase().includes('phó giám đốc'));
                                                }
                                            })
                                            .map(e => (
                                                <option key={e.id} value={e.id}>{e.name}</option>
                                            ))
                                        }
                                    </select>
                                </div>
                            )}
                        </>
                    )}

                    <div className="ml-auto flex gap-2">
                        {activeTab === 'all' && (
                            <>
                                {selectedIds.size > 0 && (
                                    <button onClick={() => handleBatchStatusChange('xu_ly')} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-blue-700 shadow-sm animate-pulse">
                                        <Send size={16}/> Chuyển xử lý ({selectedIds.size})
                                    </button>
                                )}
                                <button onClick={handleDownloadTemplate} className="flex items-center gap-2 bg-gray-100 text-gray-700 border border-gray-300 px-3 py-1.5 rounded-md font-bold text-sm hover:bg-gray-200 shadow-sm">
                                    <Download size={16}/> Tải mẫu
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
                                <button onClick={handleImportClick} className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-blue-700 shadow-sm">
                                    <Upload size={16}/> Import Excel
                                </button>
                                <button onClick={() => { setIsFormOpen(true); setEditingId(null); resetForm(); }} className="flex items-center gap-2 bg-teal-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-teal-700 shadow-sm">
                                    <Plus size={16}/> Thêm mới
                                </button>
                                {currentUser.role === 'ADMIN' && (
                                    <button onClick={() => setShowDeleteAllModal(true)} className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-red-700 shadow-sm">
                                        <Trash2 size={16}/> Xóa dữ liệu
                                    </button>
                                )}
                            </>
                        )}

                        {activeTab === 'xu_ly' && selectedIds.size > 0 && (
                            <>
                                <button onClick={() => openAssignModal('ky_gcn')} className="flex items-center gap-2 bg-teal-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-teal-700 shadow-sm animate-pulse">
                                    <Send size={16}/> Trình Ban Giám Đốc ({selectedIds.size})
                                </button>
                                <button onClick={() => openAssignModal('tham_tra_thue')} className="flex items-center gap-2 bg-orange-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-orange-700 shadow-sm animate-pulse">
                                    <Send size={16}/> Trình Tổ trưởng/Tổ phó ({selectedIds.size})
                                </button>
                            </>
                        )}

                        {activeTab === 'thue' && thueSubTab === 'tham_tra_thue' && selectedIds.size > 0 && (
                            <>
                                <button onClick={() => { setReturnTargetStatus('xu_ly'); setShowReturnModal(true); }} className="flex items-center gap-2 bg-red-500 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-red-600 shadow-sm animate-pulse">
                                    <X size={16}/> Trả về Xử lý ({selectedIds.size})
                                </button>
                                <button onClick={() => openAssignModal('chuyen_thue')} className="flex items-center gap-2 bg-teal-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-teal-700 shadow-sm animate-pulse">
                                    <Send size={16}/> Trình Giám đốc/Phó giám đốc ({selectedIds.size})
                                </button>
                            </>
                        )}

                        {activeTab === 'thue' && thueSubTab === 'chuyen_thue' && selectedIds.size > 0 && (
                            <button onClick={() => handleBatchStatusChange('dong_thue')} className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-purple-700 shadow-sm animate-pulse">
                                <CheckCircle size={16}/> Chuyển Đã đóng thuế ({selectedIds.size})
                            </button>
                        )}

                        {activeTab === 'thue' && thueSubTab === 'dong_thue' && selectedIds.size > 0 && (
                            <button onClick={() => openAssignModal('ky_gcn')} className="flex items-center gap-2 bg-teal-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-teal-700 shadow-sm animate-pulse">
                                <Send size={16}/> Trình Ban Giám Đốc ({selectedIds.size})
                            </button>
                        )}

                        {activeTab === 'gcn' && selectedIds.size > 0 && (
                            <>
                                <button onClick={() => { setReturnTargetStatus('ky_gcn_return'); setShowReturnModal(true); }} className="flex items-center gap-2 bg-red-500 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-red-600 shadow-sm animate-pulse">
                                    <X size={16}/> Trả về bước trước ({selectedIds.size})
                                </button>
                                <button onClick={handleMoveToVaoSo} className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-md font-bold text-sm hover:bg-indigo-700 shadow-sm animate-pulse">
                                    <CheckCircle2 size={16}/> Chuyển Vào số GCN ({selectedIds.size})
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-auto p-4 flex gap-4 relative">
                <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-3 w-10 text-center border-b border-gray-200">
                                        <input type="checkbox" checked={selectedIds.size === paginatedRecords.length && paginatedRecords.length > 0} onChange={toggleSelectAll} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                    </th>
                                    <th className="p-3 font-semibold text-gray-700 border-b border-gray-200">Mã hồ sơ</th>
                                    <th className="p-3 font-semibold text-gray-700 border-b border-gray-200">Chủ sử dụng</th>
                                    <th className="p-3 font-semibold text-gray-700 border-b border-gray-200">CCCD</th>
                                    <th className="p-3 font-semibold text-gray-700 border-b border-gray-200">Loại biến động</th>
                                    <th className="p-3 font-semibold text-gray-700 border-b border-gray-200">Ngày nhận</th>
                                    <th className="p-3 font-semibold text-gray-700 border-b border-gray-200">Địa danh</th>
                                    <th className="p-3 font-semibold text-gray-700 border-b border-gray-200">Trạng thái</th>
                                    <th className="p-3 font-semibold text-gray-700 border-b border-gray-200 text-center w-24">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedRecords.length > 0 ? paginatedRecords.map(r => (
                                    <tr key={r.id} className={`hover:bg-blue-50/50 transition-colors ${selectedIds.has(r.id) ? 'bg-blue-50' : ''}`}>
                                        <td className="p-3 text-center">
                                            <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                        </td>
                                        <td className="p-3 font-medium text-gray-800">{r.so_hieu}</td>
                                        <td className="p-3 text-gray-600">{r.noi_nhan_gui}</td>
                                        <td className="p-3 text-gray-600">{r.data?.cccd}</td>
                                        <td className="p-3 text-gray-600">{r.trich_yeu}</td>
                                        <td className="p-3 text-gray-600">{r.data?.ngay_nhan ? r.data.ngay_nhan.split('-').reverse().join('/') : ''}</td>
                                        <td className="p-3 text-gray-600">{r.data?.dia_danh}</td>
                                        <td className="p-3">{getStatusLabel(r.status)}</td>
                                        <td className="p-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => { setDetailRecord(r); setShowDetailModal(true); }} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded" title="Xem chi tiết"><FileText size={14}/></button>
                                                {activeTab === 'all' && (
                                                    <>
                                                        <button onClick={() => handleEdit(r)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Sửa"><Edit size={14}/></button>
                                                        <button onClick={() => handleDelete(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded" title="Xóa"><Trash2 size={14}/></button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={9} className="p-8 text-center text-gray-400 italic">Không có dữ liệu</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="p-3 border-t border-gray-200 flex items-center justify-between bg-gray-50 shrink-0">
                            <span className="text-xs text-gray-500 font-medium">
                                Hiển thị {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredRecords.length)} / {filteredRecords.length} hồ sơ
                            </span>
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-2 py-1 rounded border border-gray-300 bg-white text-xs disabled:opacity-50 hover:bg-gray-100"
                                >
                                    Trước
                                </button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let p = i + 1;
                                    if (totalPages > 5) {
                                        if (currentPage > 3) p = currentPage - 2 + i;
                                        if (p > totalPages) p = totalPages - (4 - i);
                                        if (p < 1) p = i + 1;
                                    }
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => setCurrentPage(p)}
                                            className={`px-2 py-1 rounded border text-xs font-medium min-w-[24px] ${currentPage === p ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-300 bg-white hover:bg-gray-100 text-gray-600'}`}
                                        >
                                            {p}
                                        </button>
                                    );
                                })}
                                <button 
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-2 py-1 rounded border border-gray-300 bg-white text-xs disabled:opacity-50 hover:bg-gray-100"
                                >
                                    Sau
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Form Panel */}
                {isFormOpen && (
                    <div className="w-96 bg-white rounded-xl border border-gray-200 shadow-lg flex flex-col shrink-0 animate-fade-in-right">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                {editingId ? 'Sửa hồ sơ' : 'Thêm mới hồ sơ'}
                            </h3>
                            <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Mã hồ sơ <span className="text-red-500">*</span></label>
                                <input type="text" className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={formData.so_hieu} onChange={e => setFormData({...formData, so_hieu: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Chủ sử dụng <span className="text-red-500">*</span></label>
                                <input type="text" className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={formData.chu_su_dung} onChange={e => setFormData({...formData, chu_su_dung: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">CCCD</label>
                                    <input type="text" className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={formData.cccd} onChange={e => setFormData({...formData, cccd: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Chuyển quyền</label>
                                    <input type="text" className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={formData.chuyen_quyen} onChange={e => setFormData({...formData, chuyen_quyen: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Loại biến động</label>
                                <input type="text" className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={formData.loai_bien_dong} onChange={e => setFormData({...formData, loai_bien_dong: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Ngày nhận</label>
                                    <input type="date" className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={formData.ngay_nhan} onChange={e => setFormData({...formData, ngay_nhan: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Ngày trả kết quả</label>
                                    <input type="date" className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={formData.ngay_tra_kq} onChange={e => setFormData({...formData, ngay_tra_kq: e.target.value})} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Số tờ</label>
                                    <input type="text" className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={formData.so_to} onChange={e => setFormData({...formData, so_to: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Số thửa</label>
                                    <input type="text" className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={formData.so_thua} onChange={e => setFormData({...formData, so_thua: e.target.value})} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Diện tích</label>
                                    <input type="text" className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={formData.dien_tich} onChange={e => setFormData({...formData, dien_tich: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Đất ở</label>
                                    <input type="text" className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={formData.dat_o} onChange={e => setFormData({...formData, dat_o: e.target.value})} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Địa danh</label>
                                    <select className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={formData.dia_danh} onChange={e => setFormData({...formData, dia_danh: e.target.value})}>
                                        <option value="">Chọn xã/phường</option>
                                        {wards.map(w => <option key={w} value={w}>{w}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Số phát hành</label>
                                    <input type="text" className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" value={formData.so_phat_hanh} onChange={e => setFormData({...formData, so_phat_hanh: e.target.value})} />
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2 rounded-b-xl">
                            <button onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Hủy</button>
                            <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-2 shadow-sm">
                                <Save size={16} /> Lưu hồ sơ
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <DeleteAllModal
                isOpen={showDeleteAllModal}
                onClose={() => setShowDeleteAllModal(false)}
                onConfirm={handleDeleteAll}
                currentUser={currentUser}
                title="Đăng ký"
            />
            
            <ReturnReasonModal
                isOpen={showReturnModal}
                onClose={() => setShowReturnModal(false)}
                onConfirm={handleBatchReturn}
                targetOptions={returnTargetStatus === 'ky_gcn_return' ? [
                    { value: 'dong_thue', label: 'Đã đóng thuế' },
                    { value: 'chuyen_thue', label: 'Đã chuyển thuế' },
                    { value: 'tham_tra_thue', label: 'Thẩm tra thuế' },
                    { value: 'xu_ly', label: 'Xử lý' }
                ] : undefined}
            />

            <AssignModal
                isOpen={showAssignModal}
                onClose={() => setShowAssignModal(false)}
                onConfirm={handleConfirmAssign}
                employees={filteredEmployeesForAssign}
                selectedRecords={[]}
                filterDepartment={assignTargetStatus === 'ky_gcn' || assignTargetStatus === 'chuyen_thue' ? 'Ban Giám đốc' : assignTargetStatus === 'tham_tra_thue' ? 'Tổ trưởng/Tổ phó' : undefined}
                forceAllRecommended={assignTargetStatus === 'ky_gcn' || assignTargetStatus === 'chuyen_thue' || assignTargetStatus === 'tham_tra_thue'}
            />

            <RecordDetailModal
                isOpen={showDetailModal}
                onClose={() => setShowDetailModal(false)}
                record={detailRecord}
                currentUser={currentUser}
                onUpdateRecord={loadData}
                employees={employees}
            />
        </div>
    );
};

export default DangKyView;
