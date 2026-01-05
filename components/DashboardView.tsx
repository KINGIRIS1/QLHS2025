
import React, { useMemo, useState, useEffect } from 'react';
import { RecordFile, RecordStatus } from '../types';
import { getNormalizedWard, getShortRecordType } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileText, RotateCcw, CheckCircle, ArchiveX, MapPin, Layers, CalendarRange, Filter } from 'lucide-react';

interface DashboardViewProps {
    records: RecordFile[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

const DashboardView: React.FC<DashboardViewProps> = ({ records }) => {
    // 1. Tự động xác định danh sách các năm có trong dữ liệu
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        const currentYear = new Date().getFullYear();
        years.add(currentYear); // Luôn thêm năm hiện tại

        records.forEach(r => {
            if (r.receivedDate) {
                const y = new Date(r.receivedDate).getFullYear();
                if (!isNaN(y)) years.add(y);
            }
        });
        // Sắp xếp giảm dần (năm mới nhất lên đầu)
        return Array.from(years).sort((a, b) => b - a);
    }, [records]);

    // State lưu năm đang chọn (Mặc định là năm đầu tiên trong danh sách - năm mới nhất)
    const [selectedYear, setSelectedYear] = useState<number>(availableYears[0]);

    // Cập nhật selectedYear khi availableYears thay đổi (ví dụ khi load dữ liệu xong)
    useEffect(() => {
        if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
            setSelectedYear(availableYears[0]);
        }
    }, [availableYears, selectedYear]);

    // 2. Lọc dữ liệu theo năm đã chọn
    const recordsInYear = useMemo(() => {
        return records.filter(r => {
            if (!r.receivedDate) return false;
            return new Date(r.receivedDate).getFullYear() === selectedYear;
        });
    }, [records, selectedYear]);

    // 3. Tính toán thống kê cho năm đã chọn
    const total = recordsInYear.length;
    const completed = recordsInYear.filter(r => r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED).length;
    const withdrawn = recordsInYear.filter(r => r.status === RecordStatus.WITHDRAWN).length;
    const processing = total - completed - withdrawn;

    // --- Data cho Biểu đồ Địa bàn (Xã/Phường) ---
    const wardData = useMemo(() => {
        const counts: Record<string, number> = {};
        recordsInYear.forEach(r => {
            const w = getNormalizedWard(r.ward) || 'Khác';
            counts[w] = (counts[w] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value); 
    }, [recordsInYear]);

    // --- Data cho Biểu đồ Loại hồ sơ ---
    const typeData = useMemo(() => {
        const counts: Record<string, number> = {};
        recordsInYear.forEach(r => {
            const t = getShortRecordType(r.recordType);
            counts[t] = (counts[t] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [recordsInYear]);

    return (
        <div className="h-full overflow-y-auto space-y-6 p-2 flex flex-col">
            
            {/* HEADER: BỘ ĐẾM NĂM */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 text-white p-2 rounded-lg shadow-blue-200 shadow-md">
                        <CalendarRange size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Tổng quan tình hình hồ sơ</h2>
                        <p className="text-xs text-gray-500 font-medium">Thống kê dữ liệu tự động theo năm</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                    <div className="px-3 py-1 text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                        <Filter size={14} /> Chọn năm:
                    </div>
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        className="bg-white border border-slate-300 text-gray-800 text-sm font-bold rounded-md focus:ring-blue-500 focus:border-blue-500 block p-1.5 outline-none cursor-pointer hover:border-blue-400 transition-colors shadow-sm min-w-[100px]"
                    >
                        {availableYears.map(year => (
                            <option key={year} value={year}>Năm {year}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* CARDS: THỐNG KÊ CHI TIẾT */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group">
                    <div className="absolute -bottom-4 -right-4 opacity-10 group-hover:opacity-20 transition-all duration-300 transform rotate-12 z-0">
                        <FileText size={80} className="text-blue-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Tổng nhận {selectedYear}</p>
                        <h3 className="text-4xl font-black text-gray-800 mt-2">{total}</h3>
                        <p className="text-[10px] text-blue-600 font-medium mt-1">Hồ sơ</p>
                    </div>
                    <div className="relative z-10 bg-blue-50 p-3 rounded-xl text-blue-600 shadow-sm border border-blue-100">
                        <FileText size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group">
                    <div className="absolute -bottom-4 -right-4 opacity-10 group-hover:opacity-20 transition-all duration-300 transform rotate-12 z-0">
                        <RotateCcw size={80} className="text-yellow-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Đang xử lý</p>
                        <h3 className="text-4xl font-black text-yellow-600 mt-2">{processing}</h3>
                        <p className="text-[10px] text-yellow-600 font-medium mt-1">
                            Chiếm {total > 0 ? Math.round((processing / total) * 100) : 0}%
                        </p>
                    </div>
                    <div className="relative z-10 bg-yellow-50 p-3 rounded-xl text-yellow-600 shadow-sm border border-yellow-100">
                        <RotateCcw size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group">
                    <div className="absolute -bottom-4 -right-4 opacity-10 group-hover:opacity-20 transition-all duration-300 transform rotate-12 z-0">
                        <CheckCircle size={80} className="text-green-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Đã hoàn thành</p>
                        <h3 className="text-4xl font-black text-green-600 mt-2">{completed}</h3>
                        <p className="text-[10px] text-green-600 font-medium mt-1">
                            Chiếm {total > 0 ? Math.round((completed / total) * 100) : 0}%
                        </p>
                    </div>
                    <div className="relative z-10 bg-green-50 p-3 rounded-xl text-green-600 shadow-sm border border-green-100">
                        <CheckCircle size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group">
                    <div className="absolute -bottom-4 -right-4 opacity-10 group-hover:opacity-20 transition-all duration-300 transform rotate-12 z-0">
                        <ArchiveX size={80} className="text-slate-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Đã rút / Trả lại</p>
                        <h3 className="text-4xl font-black text-slate-600 mt-2">{withdrawn}</h3>
                        <p className="text-[10px] text-slate-500 font-medium mt-1">Hồ sơ</p>
                    </div>
                    <div className="relative z-10 bg-slate-100 p-3 rounded-xl text-slate-600 shadow-sm border border-slate-200">
                        <ArchiveX size={24} />
                    </div>
                </div>
            </div>

            {/* CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                {/* CHART 1: Thống kê theo Địa bàn */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[400px]">
                    <h3 className="text-sm font-bold text-gray-800 mb-4 shrink-0 flex items-center gap-2 uppercase tracking-wide">
                        <MapPin size={18} className="text-blue-600" /> Phân bố theo địa bàn ({selectedYear})
                    </h3>
                    <div className="flex-1 min-h-0 w-full relative">
                        {wardData.length > 0 ? (
                            <div className="absolute inset-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={wardData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                                        <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis dataKey="name" type="category" width={100} fontSize={11} tick={{fill: '#4b5563', fontWeight: 600}} tickLine={false} axisLine={false} />
                                        <Tooltip 
                                            cursor={{ fill: '#f3f4f6' }} 
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                                        />
                                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} name="Số lượng" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <p>Chưa có dữ liệu năm {selectedYear}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* CHART 2: Phân loại Hồ sơ */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[400px]">
                    <h3 className="text-sm font-bold text-gray-800 mb-4 shrink-0 flex items-center gap-2 uppercase tracking-wide">
                        <Layers size={18} className="text-purple-600" /> Loại hình hồ sơ ({selectedYear})
                    </h3>
                    <div className="w-full flex-1 min-h-0 relative">
                        {typeData.length > 0 ? (
                            <div className="absolute inset-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie 
                                            data={typeData} 
                                            cx="50%" 
                                            cy="50%" 
                                            innerRadius={60} 
                                            outerRadius={100} 
                                            paddingAngle={2} 
                                            dataKey="value"
                                        >
                                            {typeData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                        <Legend 
                                            layout="vertical" 
                                            verticalAlign="middle" 
                                            align="right"
                                            wrapperStyle={{ fontSize: '11px', fontWeight: 500, color: '#4b5563' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <p>Chưa có dữ liệu năm {selectedYear}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardView;
