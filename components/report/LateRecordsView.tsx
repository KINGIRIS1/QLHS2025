import React, { useMemo, useState } from 'react';
import { RecordFile, RecordStatus, Employee } from '../../types';
import { getNormalizedWard, STATUS_LABELS } from '../../constants';
import { isRecordOverdue } from '../../utils/appHelpers';
import * as XLSX from 'xlsx-js-style';
import { FileSpreadsheet, ListFilter } from 'lucide-react';

interface LateRecordsViewProps {
    records: RecordFile[];
    employees: Employee[];
    fromDate: string;
    toDate: string;
    wards: string[];
}

const LateRecordsView: React.FC<LateRecordsViewProps> = ({ records, employees, fromDate, toDate, wards }) => {
    const [subTab, setSubTab] = useState<'pending' | 'completed'>('pending');
    const [filterWard, setFilterWard] = useState<string>('all');

    const recordsInTimeRange = useMemo(() => {
        const start = new Date(fromDate); start.setHours(0,0,0,0);
        const end = new Date(toDate); end.setHours(23,59,59,999);
        return records.filter(r => {
            if (!r.receivedDate) return false;
            const rDate = new Date(r.receivedDate);
            if (rDate < start || rDate > end) return false;
            if (filterWard !== 'all' && r.ward !== filterWard) return false;
            return true;
        });
    }, [records, fromDate, toDate, filterWard]);

    const { overduePendingList, overdueCompletedList } = useMemo(() => {
        const pending: RecordFile[] = [];
        const completed: RecordFile[] = [];

        recordsInTimeRange.forEach(r => {
            const isFinished = [
                RecordStatus.HANDOVER, 
                RecordStatus.RETURNED, 
                RecordStatus.SIGNED
            ].includes(r.status) || !!r.exportBatch || !!r.exportDate;

            if (isFinished) {
                if (r.deadline && r.completedDate) {
                    const d = new Date(r.deadline); d.setHours(0,0,0,0);
                    const c = new Date(r.completedDate); c.setHours(0,0,0,0);
                    if (c > d) {
                        completed.push(r);
                    }
                }
            } else {
                if (r.status !== RecordStatus.WITHDRAWN) {
                    if (isRecordOverdue(r)) {
                        pending.push(r);
                    }
                }
            }
        });

        return { overduePendingList: pending, overdueCompletedList: completed };
    }, [recordsInTimeRange]);

    const activeList = subTab === 'pending' ? overduePendingList : overdueCompletedList;

    const exportToExcel = () => {
        const title = subTab === 'pending' ? 'DANH SÁCH HS TRỄ HẠN(CHƯA KẾT QUẢ)' : 'DANH SÁCH HS TRỄ HẠN(ĐÃ CÓ KẾT QUẢ)';
        const dateRangeStr = `(Từ ${fromDate.split('-').reverse().join('/')} Đến ${toDate.split('-').reverse().join('/')})`;
        
        const wb = XLSX.utils.book_new();
        const wsData: any[][] = [
            [title],
            [dateRangeStr],
            [],
            ["STT", "Mã HS", "Chủ sử dụng", "Xã/Phường", "Ngày nhận", "Hẹn trả", "Hoàn thành", "Trạng thái", "Nhân viên xử lý", "Số ngày trễ"]
        ];

        activeList.forEach((r, i) => {
            const emp = employees.find(e => e.id === r.assignedTo);
            let daysLate = 0;
            if (r.deadline) {
                const d = new Date(r.deadline); d.setHours(0,0,0,0);
                const endDate = (subTab === 'completed' && r.completedDate) ? new Date(r.completedDate) : new Date();
                endDate.setHours(0,0,0,0);
                
                const diffTime = endDate.getTime() - d.getTime();
                daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }

            wsData.push([
                i + 1,
                r.code || '',
                r.customerName || '',
                getNormalizedWard(r.ward),
                r.receivedDate ? r.receivedDate.split('-').reverse().join('/') : '',
                r.deadline ? r.deadline.split('-').reverse().join('/') : '',
                r.completedDate ? r.completedDate.split('-').reverse().join('/') : '',
                STATUS_LABELS[r.status] || '',
                emp ? emp.name : '',
                daysLate > 0 ? daysLate : ''
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }
        ];

        // Format
        const headerStyle = { font: { bold: true, sz: 14, color: { rgb: "000000" } }, alignment: { horizontal: "center", vertical: "center" } };
        const subHeaderStyle = { font: { italic: true }, alignment: { horizontal: "center", vertical: "center" } };
        const tableHeaderStyle = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4B5563" } }, alignment: { horizontal: "center", vertical: "center" }, border: { top: {style: "thin"}, bottom: {style: "thin"}, left: {style: "thin"}, right: {style: "thin"} } };
        const cellStyle = { border: { top: {style: "thin"}, bottom: {style: "thin"}, left: {style: "thin"}, right: {style: "thin"} } };
        
        ws['A1'].s = headerStyle;
        ws['A2'].s = subHeaderStyle;

        for (let C = 0; C <= 9; C++) {
            const cellAddr = XLSX.utils.encode_cell({r: 3, c: C});
            if (ws[cellAddr]) ws[cellAddr].s = tableHeaderStyle;
        }

        for (let R = 4; R < wsData.length; R++) {
            for (let C = 0; C <= 9; C++) {
                const cellAddr = XLSX.utils.encode_cell({r: R, c: C});
                if (ws[cellAddr]) ws[cellAddr].s = cellStyle;
            }
        }

        ws['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 12 }];

        XLSX.utils.book_append_sheet(wb, ws, "HoSoTreHan");
        const filename = `Ho_So_Tre_Han_${subTab}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, filename);
    };

    return (
        <div className="flex flex-col h-full bg-white animate-fade-in">
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-slate-50 shrink-0">
                <div className="flex bg-white rounded-lg p-1 border border-gray-200">
                    <button 
                        onClick={() => setSubTab('pending')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${subTab === 'pending' ? 'bg-red-50 text-red-600 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        Chưa có kết quả ({overduePendingList.length})
                    </button>
                    <button 
                        onClick={() => setSubTab('completed')}
                        className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${subTab === 'completed' ? 'bg-orange-50 text-orange-600 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        Đã có kết quả ({overdueCompletedList.length})
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <select
                        value={filterWard}
                        onChange={(e) => setFilterWard(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">Tất cả Xã/Phường</option>
                        {wards.map(w => (
                            <option key={w} value={w}>{w}</option>
                        ))}
                    </select>
                    <button onClick={exportToExcel} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-bold text-sm shadow-sm transition-colors">
                        <FileSpreadsheet size={16} /> Xuất danh sách này (Excel)
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                {activeList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                        <ListFilter size={48} className="text-gray-300" />
                        <p>Không có hồ sơ trễ hạn trong nhóm này.</p>
                    </div>
                ) : (
                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-xs text-gray-500 uppercase font-bold sticky top-0 shadow-sm z-10">
                                <tr>
                                    <th className="p-3 w-10 text-center">#</th>
                                    <th className="p-3 w-32">Mã HS</th>
                                    <th className="p-3 w-48">Chủ sử dụng</th>
                                    <th className="p-3 w-32">Xã/Phường</th>
                                    <th className="p-3 w-24">Ngày nhận</th>
                                    <th className="p-3 w-24">Hẹn trả</th>
                                    <th className="p-3 w-24">Hoàn thành</th>
                                    <th className="p-3 w-32">NV Xử lý</th>
                                    <th className="p-3 w-32 text-center">Trạng thái</th>
                                    <th className="p-3 text-center">Số ngày trễ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {activeList.map((r, i) => {
                                    const emp = employees.find(e => e.id === r.assignedTo);
                                    let daysLate = 0;
                                    if (r.deadline) {
                                        const d = new Date(r.deadline); d.setHours(0,0,0,0);
                                        const endDate = (subTab === 'completed' && r.completedDate) ? new Date(r.completedDate) : new Date();
                                        endDate.setHours(0,0,0,0);
                                        const diffTime = endDate.getTime() - d.getTime();
                                        daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                    }

                                    return (
                                        <tr key={r.id} className="hover:bg-red-50/20 transition-colors">
                                            <td className="p-3 text-center text-gray-400">{i + 1}</td>
                                            <td className="p-3 font-medium text-blue-600">{r.code}</td>
                                            <td className="p-3 font-medium text-gray-800">{r.customerName}</td>
                                            <td className="p-3 text-gray-600">{getNormalizedWard(r.ward)}</td>
                                            <td className="p-3 text-gray-600">{r.receivedDate ? r.receivedDate.split('-').reverse().join('/') : ''}</td>
                                            <td className="p-3 font-semibold text-red-600">{r.deadline ? r.deadline.split('-').reverse().join('/') : ''}</td>
                                            <td className="p-3 text-orange-600 font-medium">{r.completedDate ? r.completedDate.split('-').reverse().join('/') : '-'}</td>
                                            <td className="p-3 text-gray-600 truncate">{emp ? emp.name : '-'}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-1 rounded text-xs border ${subTab === 'completed' ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-red-100 text-red-700 border-red-200 font-bold'}`}>
                                                    {STATUS_LABELS[r.status] || r.status}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="font-bold text-red-600">{daysLate > 0 ? daysLate : 0} ngày</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LateRecordsView;
