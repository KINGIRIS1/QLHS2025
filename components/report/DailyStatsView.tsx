import React, { useState, useMemo } from 'react';
import { RecordFile, Employee, RecordStatus } from '../../types';
import { CalendarDays, Download, Search, FileSpreadsheet, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { getNormalizedWard, STATUS_LABELS } from '../../constants';
import { exportDailyStatsToExcel } from '../../utils/excelExport';

interface DailyStatsViewProps {
    records: RecordFile[];
    employees: Employee[];
    wards: string[];
}

const DailyStatsView: React.FC<DailyStatsViewProps> = ({ records, employees, wards }) => {
    const [receiveFrom, setReceiveFrom] = useState('');
    const [receiveTo, setReceiveTo] = useState('');
    
    const [deadlineFrom, setDeadlineFrom] = useState('');
    const [deadlineTo, setDeadlineTo] = useState('');

    const [selectedWard, setSelectedWard] = useState<string>('all');

    // Pagination States
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            let matchReceive = true;
            if (receiveFrom || receiveTo) {
                if (!r.receivedDate) {
                    matchReceive = false;
                } else {
                    const rDate = new Date(r.receivedDate);
                    rDate.setHours(0,0,0,0);
                    if (receiveFrom) {
                        const from = new Date(receiveFrom); from.setHours(0,0,0,0);
                        if (rDate < from) matchReceive = false;
                    }
                    if (receiveTo) {
                        const to = new Date(receiveTo); to.setHours(23,59,59,999);
                        if (rDate > to) matchReceive = false;
                    }
                }
            }

            let matchDeadline = true;
            if (deadlineFrom || deadlineTo) {
                if (!r.deadline) {
                    matchDeadline = false;
                } else {
                    const rDate = new Date(r.deadline);
                    rDate.setHours(0,0,0,0);
                    if (deadlineFrom) {
                        const from = new Date(deadlineFrom); from.setHours(0,0,0,0);
                        if (rDate < from) matchDeadline = false;
                    }
                    if (deadlineTo) {
                        const to = new Date(deadlineTo); to.setHours(23,59,59,999);
                        if (rDate > to) matchDeadline = false;
                    }
                }
            }

            let matchWard = true;
            if (selectedWard !== 'all') {
                matchWard = getNormalizedWard(r.ward) === selectedWard;
            }

            return matchReceive && matchDeadline && matchWard;
        });
    }, [records, receiveFrom, receiveTo, deadlineFrom, deadlineTo, selectedWard]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    const paginatedRecords = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredRecords.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredRecords, currentPage, itemsPerPage]);

    // Reset page when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [receiveFrom, receiveTo, deadlineFrom, deadlineTo, selectedWard]);

    const handleExport = () => {
        exportDailyStatsToExcel(filteredRecords, employees, receiveFrom, receiveTo, deadlineFrom, deadlineTo);
    };

    const formatDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('vi-VN') : '-';

    return (
        <div className="flex flex-col h-full bg-white animate-fade-in-up p-4">
            <div className="flex flex-col md:flex-row gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Ngày nhận</label>
                    <div className="flex items-center gap-2">
                        <input type="date" value={receiveFrom} onChange={e => setReceiveFrom(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-full" title="Từ ngày" />
                        <span className="text-gray-400">-</span>
                        <input type="date" value={receiveTo} onChange={e => setReceiveTo(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-full" title="Đến ngày" />
                    </div>
                </div>
                
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Ngày hẹn trả</label>
                    <div className="flex items-center gap-2">
                        <input type="date" value={deadlineFrom} onChange={e => setDeadlineFrom(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-full" title="Từ ngày" />
                        <span className="text-gray-400">-</span>
                        <input type="date" value={deadlineTo} onChange={e => setDeadlineTo(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-full" title="Đến ngày" />
                    </div>
                </div>

                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Xã/Phường</label>
                    <div className="flex items-center gap-2 bg-white px-2 py-1.5 border border-gray-300 rounded-md">
                        <MapPin size={16} className="text-gray-500" />
                        <select 
                            value={selectedWard} 
                            onChange={(e) => setSelectedWard(e.target.value)} 
                            className="text-sm outline-none bg-transparent text-gray-700 font-medium cursor-pointer border-none focus:ring-0 w-full"
                        >
                            <option value="all">Toàn bộ địa bàn</option>
                            {wards.map(w => (
                                <option key={w} value={w}>{w}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex items-end">
                    <button 
                        onClick={handleExport}
                        disabled={filteredRecords.length === 0}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-bold text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FileSpreadsheet size={16} /> Xuất danh sách ({filteredRecords.length})
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto rounded-xl border border-gray-200">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold sticky top-0 shadow-sm z-10">
                        <tr>
                            <th className="p-3 w-10 text-center">#</th>
                            <th className="p-3 w-32">Mã HS</th>
                            <th className="p-3 w-48">Chủ sử dụng</th>
                            <th className="p-3 w-32">Xã/Phường</th>
                            <th className="p-3 w-24">Ngày nhận</th>
                            <th className="p-3 w-24">Ngày hẹn trả</th>
                            <th className="p-3 w-24">Ngày hoàn thành</th>
                            <th className="p-3 w-32">NV Xử lý</th>
                            <th className="p-3 w-32 text-center">Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {paginatedRecords.length > 0 ? paginatedRecords.map((r, i) => {
                            const emp = employees.find(e => e.id === r.assignedTo);
                            const rowIndex = (currentPage - 1) * itemsPerPage + i + 1;
                            return (
                                <tr key={r.id} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="p-3 text-center text-gray-400">{rowIndex}</td>
                                    <td className="p-3 font-medium text-blue-600">{r.code}</td>
                                    <td className="p-3 font-medium">{r.customerName}</td>
                                    <td className="p-3 text-gray-600">{getNormalizedWard(r.ward)}</td>
                                    <td className="p-3 text-gray-600">{formatDate(r.receivedDate)}</td>
                                    <td className="p-3 font-medium text-orange-600">{formatDate(r.deadline)}</td>
                                    <td className="p-3 font-medium text-green-700">{formatDate(r.completedDate || r.resultReturnedDate)}</td>
                                    <td className="p-3 text-gray-600 text-xs truncate" title={emp?.name}>{emp ? emp.name : '-'}</td>
                                    <td className="p-3 text-center">
                                        <span className={`px-2 py-1 rounded text-xs border ${
                                            r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED ? 'bg-green-100 text-green-700 border-green-200' : 
                                            r.status === RecordStatus.WITHDRAWN ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                            r.status === RecordStatus.PENDING_SIGN || r.status === RecordStatus.SIGNED ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                            r.status === RecordStatus.COMPLETED_WORK ? 'bg-teal-100 text-teal-700 border-teal-200' :
                                            'bg-blue-100 text-blue-700 border-blue-200'
                                        }`}>
                                            {STATUS_LABELS[r.status] || r.status}
                                        </span>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan={9} className="p-8 text-center text-gray-500">
                                    Không có dữ liệu phù hợp với điều kiện lọc
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Hiển thị</span>
                        <select 
                            value={itemsPerPage} 
                            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            className="border border-gray-300 rounded px-2 py-1 text-sm outline-none"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                        <span className="text-sm text-gray-600">hồ sơ / trang</span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={20} className="text-gray-600" />
                        </button>
                        
                        <div className="flex items-center gap-1 px-2">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum = currentPage;
                                if (currentPage <= 3) pageNum = i + 1;
                                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                else pageNum = currentPage - 2 + i;
                                
                                if (pageNum > 0 && pageNum <= totalPages) {
                                    return (
                                        <button 
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`w-8 h-8 rounded-md text-sm font-medium flex items-center justify-center transition-colors ${currentPage === pageNum ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                }
                                return null;
                            })}
                        </div>

                        <button 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight size={20} className="text-gray-600" />
                        </button>
                    </div>
                    <div className="text-sm text-gray-600">
                        Trang <span className="font-bold">{currentPage}</span> / {totalPages}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyStatsView;
