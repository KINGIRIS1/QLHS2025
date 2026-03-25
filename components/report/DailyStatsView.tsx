import React, { useState, useMemo } from 'react';
import { RecordFile, Employee, RecordStatus } from '../../types';
import { CalendarDays, Download, Search, FileSpreadsheet } from 'lucide-react';
import { getNormalizedWard, STATUS_LABELS } from '../../constants';
import { exportDailyStatsToExcel } from '../../utils/excelExport';

interface DailyStatsViewProps {
    records: RecordFile[];
    employees: Employee[];
}

const DailyStatsView: React.FC<DailyStatsViewProps> = ({ records, employees }) => {
    const [receiveFrom, setReceiveFrom] = useState('');
    const [receiveTo, setReceiveTo] = useState('');
    
    const [returnFrom, setReturnFrom] = useState('');
    const [returnTo, setReturnTo] = useState('');

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

            let matchReturn = true;
            if (returnFrom || returnTo) {
                const retDateStr = r.completedDate || r.resultReturnedDate;
                if (!retDateStr) {
                    matchReturn = false;
                } else {
                    const rDate = new Date(retDateStr);
                    rDate.setHours(0,0,0,0);
                    if (returnFrom) {
                        const from = new Date(returnFrom); from.setHours(0,0,0,0);
                        if (rDate < from) matchReturn = false;
                    }
                    if (returnTo) {
                        const to = new Date(returnTo); to.setHours(23,59,59,999);
                        if (rDate > to) matchReturn = false;
                    }
                }
            }

            return matchReceive && matchReturn;
        });
    }, [records, receiveFrom, receiveTo, returnFrom, returnTo]);

    const handleExport = () => {
        exportDailyStatsToExcel(filteredRecords, employees, receiveFrom, receiveTo, returnFrom, returnTo);
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
                    <label className="block text-xs font-bold text-gray-700 mb-1">Ngày trả (Hoàn thành)</label>
                    <div className="flex items-center gap-2">
                        <input type="date" value={returnFrom} onChange={e => setReturnFrom(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-full" title="Từ ngày" />
                        <span className="text-gray-400">-</span>
                        <input type="date" value={returnTo} onChange={e => setReturnTo(e.target.value)} className="border border-gray-300 rounded-md px-2 py-1.5 text-sm w-full" title="Đến ngày" />
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
                            <th className="p-3 w-24">Ngày trả</th>
                            <th className="p-3 w-32">NV Xử lý</th>
                            <th className="p-3 w-32 text-center">Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredRecords.length > 0 ? filteredRecords.map((r, i) => {
                            const emp = employees.find(e => e.id === r.assignedTo);
                            return (
                                <tr key={r.id} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="p-3 text-center text-gray-400">{i + 1}</td>
                                    <td className="p-3 font-medium text-blue-600">{r.code}</td>
                                    <td className="p-3 font-medium">{r.customerName}</td>
                                    <td className="p-3 text-gray-600">{getNormalizedWard(r.ward)}</td>
                                    <td className="p-3 text-gray-600">{formatDate(r.receivedDate)}</td>
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
                                <td colSpan={8} className="p-8 text-center text-gray-500">
                                    Không có dữ liệu phù hợp với điều kiện lọc
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DailyStatsView;
