import React, { useState, useMemo, useEffect } from 'react';
import { RecordFile, User, RecordStatus, WorkSchedule } from '../types';
import { fetchWorkSchedules } from '../services/apiWorkSchedule';
import * as XLSX from 'xlsx-js-style';
import { Calendar, Download, Search, CheckCircle, Clock } from 'lucide-react';
import { getShortRecordType } from '../constants';

interface PersonalReportViewProps {
    myRecords: RecordFile[];
    user: User;
}

const PersonalReportView: React.FC<PersonalReportViewProps> = ({ myRecords, user }) => {
    const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
    
    const [reportType, setReportType] = useState<'date' | 'week' | 'month'>('date');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [month, setMonth] = useState('');
    
    // Auto set current week / month
    useEffect(() => {
        const today = new Date();
        const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1))); 
        const lastDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 7));
        
        setFromDate(firstDayOfWeek.toISOString().split('T')[0]);
        setToDate(lastDayOfWeek.toISOString().split('T')[0]);
        
        const m = (new Date()).toISOString().slice(0, 7)
        setMonth(m);
        
        fetchWorkSchedules().then(res => setSchedules(res));
    }, []);

    const reportRange = useMemo(() => {
        let start = new Date();
        let end = new Date();
        
        if (reportType === 'date' || reportType === 'week') {
            start = fromDate ? new Date(fromDate) : new Date(0);
            end = toDate ? new Date(toDate) : new Date();
        } else if (reportType === 'month') {
            if (month) {
                const [year, m] = month.split('-');
                start = new Date(parseInt(year), parseInt(m) - 1, 1);
                end = new Date(parseInt(year), parseInt(m), 0);
            }
        }
        
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
        return { start, end };
    }, [reportType, fromDate, toDate, month]);

    const filteredRecords = useMemo(() => {
        // Hồ sơ nhận
        const received = myRecords.filter(r => {
            const dStr = r.assignedDate || r.receivedDate;
            if (!dStr) return false;
            const d = new Date(dStr);
            return d >= reportRange.start && d <= reportRange.end;
        });

        // Hồ sơ hoàn thành (FINISHED/RETURNED etc or COMPLETED_WORK)
        // Dựa vào context "hoàn thành" ở đây có thể là completed_work hoặc trả kết quả. Mình lấy Finished (SIGNED, HANDOVER, vb)
        const finishedStatuses = [
            RecordStatus.COMPLETED_WORK,
            RecordStatus.PENDING_SIGN,
            RecordStatus.SIGNED, 
            RecordStatus.HANDOVER, 
            RecordStatus.RETURNED
        ];
        
        const completed = myRecords.filter(r => {
            if (!finishedStatuses.includes(r.status)) return false;
            // nếu có action date thì tốt, không thì lấy receivedDate tạm hoặc lấy những hs hiện đã xong
            // tuy nhiên ko có completedDate, ta có completedDate, approvalDate
            const dStr = r.completedDate || r.approvalDate || r.resultReturnedDate || r.exportDate || r.submissionDate || r.assignedDate;
            if (!dStr) return false;
            const d = new Date(dStr);
            return d >= reportRange.start && d <= reportRange.end;
        });
        
        const getGroupedTypes = (arr: RecordFile[]) => {
            const groups: Record<string, number> = {};
            arr.forEach(r => {
                const t = getShortRecordType(r.recordType||'') || 'Khác';
                groups[t] = (groups[t] || 0) + 1;
            });
            return groups;
        };
        
        return { 
            received, 
            completed,
            receivedTypes: getGroupedTypes(received),
            completedTypes: getGroupedTypes(completed)
        };
    }, [myRecords, reportRange]);

    const mySchedules = useMemo(() => {
        const myName = removeVietnameseTones(user.name);
        return schedules.filter(s => {
            // Filter by date
            const sd = new Date(s.date);
            if (sd < reportRange.start || sd > reportRange.end) return false;
            
            // Filter by executor
            if (!s.executors) return false;
            const execs = removeVietnameseTones(s.executors);
            return execs.includes(myName);
        });
    }, [schedules, reportRange, user.name]);

    function removeVietnameseTones(str: string): string {
        if (!str) return '';
        str = str.toLowerCase();
        str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
        str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
        str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
        str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ợ|ở|ỡ/g, "o");
        str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
        str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
        str = str.replace(/đ/g, "d");
        str = str.replace(/ + /g, " ");
        str = str.trim();
        return str;
    }

    const handleExport = () => {
        const wsData: any[][] = [
            ["BÁO CÁO CÁ NHÂN: " + user.name.toUpperCase()],
            ["Từ ngày", reportRange.start.toLocaleDateString('vi-VN'), "Đến ngày", reportRange.end.toLocaleDateString('vi-VN')],
            [],
            ["I. THỐNG KÊ HỒ SƠ", "Nhận:", filteredRecords.received.length, "Hoàn thành:", filteredRecords.completed.length],
            ["Chi tiết nhận:"],
        ];
        Object.entries(filteredRecords.receivedTypes).forEach(([type, count]) => {
            wsData.push(["- " + type, count]);
        });
        wsData.push([]);
        wsData.push(["Chi tiết hoàn thành:"]);
        Object.entries(filteredRecords.completedTypes).forEach(([type, count]) => {
            wsData.push(["- " + type, count]);
        });
        wsData.push([]);
        wsData.push(["HỒ SƠ NHẬN/ĐƯỢC GIAO"]);
        wsData.push(["STT", "Mã HS", "Chủ sử dụng", "Loại hồ sơ", "Ngày P/C", "Trạng thái", "Hẹn trả"]);

        filteredRecords.received.forEach((r, i) => {
            wsData.push([
                i + 1,
                r.code || '',
                r.customerName || '',
                getShortRecordType(r.recordType || undefined) || '',
                r.assignedDate || r.receivedDate || '',
                r.status,
                r.deadline || ''
            ]);
        });
        
        wsData.push([]);
        wsData.push(["HỒ SƠ HOÀN THÀNH"]);
        wsData.push(["STT", "Mã HS", "Chủ sử dụng", "Loại hồ sơ", "Trạng thái", "Hẹn trả"]);
        filteredRecords.completed.forEach((r, i) => {
            wsData.push([
                i + 1,
                r.code || '',
                r.customerName || '',
                getShortRecordType(r.recordType || undefined) || '',
                r.status,
                r.deadline || ''
            ]);
        });

        wsData.push([]);
        wsData.push(["II. LỊCH CÔNG TÁC (" + mySchedules.length + " lịch)"]);
        wsData.push(["STT", "Ngày", "Nội dung", "Cơ quan phối hợp"]);
        mySchedules.forEach((s, i) => {
            wsData.push([
                i + 1,
                new Date(s.date).toLocaleDateString('vi-VN'),
                s.content || '',
                s.partner || ''
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Bao_Cao");
        XLSX.writeFile(wb, `Bao_Cao_${user.name.replace(/\s/g, '')}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="flex-1 bg-white p-6 overflow-y-auto w-full h-full text-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 relative z-10">
                <div className="flex gap-2">
                    <button 
                        onClick={() => setReportType('date')}
                        className={`px-3 py-1.5 rounded-md border ${reportType === 'date' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                    >
                        Tùy chọn ngày
                    </button>
                    <button 
                        onClick={() => setReportType('week')}
                        className={`px-3 py-1.5 rounded-md border ${reportType === 'week' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                    >
                        Theo tuần
                    </button>
                    <button 
                        onClick={() => setReportType('month')}
                        className={`px-3 py-1.5 rounded-md border ${reportType === 'month' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                    >
                        Theo tháng
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    {reportType === 'month' ? (
                        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border border-gray-300 rounded p-1.5 text-sm"/>
                    ) : (
                        <>
                            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border border-gray-300 rounded p-1.5 text-sm" />
                            <span>đến</span>
                            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border border-gray-300 rounded p-1.5 text-sm" />
                        </>
                    )}
                    <button onClick={handleExport} className="ml-2 flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700">
                        <Download size={16} /> Xuất Excel
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex flex-col justify-start">
                    <div className="text-center mb-2">
                        <span className="text-gray-500 text-sm font-semibold uppercase mb-1 block">Hồ sơ giao duyệt</span>
                        <span className="text-3xl font-bold text-blue-700">{filteredRecords.received.length}</span>
                    </div>
                    {Object.keys(filteredRecords.receivedTypes).length > 0 && (
                        <div className="w-full text-sm text-blue-800 space-y-1 bg-blue-100/50 p-3 rounded mt-2">
                            {Object.entries(filteredRecords.receivedTypes).map(([type, count]) => (
                                <div key={type} className="flex justify-between w-full">
                                    <span className="truncate mr-2">- {type}:</span> <span className="font-semibold whitespace-nowrap">{count} hs</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="bg-green-50 p-4 rounded-lg border border-green-100 flex flex-col justify-start">
                    <div className="text-center mb-2">
                        <span className="text-gray-500 text-sm font-semibold uppercase mb-1 block">Hồ sơ hoàn thành</span>
                        <span className="text-3xl font-bold text-green-700">{filteredRecords.completed.length}</span>
                    </div>
                    {Object.keys(filteredRecords.completedTypes).length > 0 && (
                        <div className="w-full text-sm text-green-800 space-y-1 bg-green-100/50 p-3 rounded mt-2">
                            {Object.entries(filteredRecords.completedTypes).map(([type, count]) => (
                                <div key={type} className="flex justify-between w-full">
                                    <span className="truncate mr-2">- {type}:</span> <span className="font-semibold whitespace-nowrap">{count} hs</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 flex flex-col justify-center items-center">
                    <span className="text-gray-500 text-sm font-semibold uppercase mb-1">Lịch công tác</span>
                    <span className="text-3xl font-bold text-purple-700">{mySchedules.length}</span>
                </div>
            </div>

            <div className="space-y-6">
                <div>
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><Calendar size={18} /> Danh sách lịch công tác</h3>
                    {mySchedules.length > 0 ? (
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border p-2 text-left">Ngày</th>
                                    <th className="border p-2 text-left">Nội dung</th>
                                    <th className="border p-2 text-left">Cơ quan phối hợp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mySchedules.map(s => (
                                    <tr key={s.id}>
                                        <td className="border p-2">{new Date(s.date).toLocaleDateString('vi-VN')}</td>
                                        <td className="border p-2 font-medium">{s.content}</td>
                                        <td className="border p-2">{s.partner}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <p className="text-gray-500 italic">Không có lịch công tác trong khoản thời gian này.</p>}
                </div>
            </div>
        </div>
    );
};

export default PersonalReportView;
