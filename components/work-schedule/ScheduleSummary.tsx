import React, { useState, useMemo } from 'react';
import { WorkSchedule } from '../../types';
import { BarChart3, Search, Calendar as CalendarIcon, MapPin, Users } from 'lucide-react';

interface ScheduleSummaryProps {
    schedules: WorkSchedule[];
}

const ScheduleSummary: React.FC<ScheduleSummaryProps> = ({ schedules }) => {
    const [filterType, setFilterType] = useState<'week' | 'month' | 'year'>('month');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewTab, setViewTab] = useState<'location' | 'employee'>('location');

    const { employeeSummary, locationSummary, totalSchedules } = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        // Helper to get week number
        const getWeekNumber = (d: Date) => {
            d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
            return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
        };
        const currentWeek = getWeekNumber(now);

        // Filter schedules based on selected time period
        const filteredSchedules = schedules.filter(s => {
            if (s.partner === 'DANG_KY_MAY_DO') return false;
            const date = new Date(s.date);
            if (filterType === 'year') {
                return date.getFullYear() === currentYear;
            } else if (filterType === 'month') {
                return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
            } else if (filterType === 'week') {
                return date.getFullYear() === currentYear && getWeekNumber(date) === currentWeek;
            }
            return true;
        });

        // 1. Aggregate by employee
        const empCounts: Record<string, number> = {};
        // 2. Aggregate by location / Ward
        const locCounts: Record<string, number> = {};

        filteredSchedules.forEach(s => {
            // Employee split
            const executors = s.executors.split(',').map(e => e.trim()).filter(e => e);
            executors.forEach(emp => {
                empCounts[emp] = (empCounts[emp] || 0) + 1;
            });

            // Location ward
            const loc = s.location && s.location.trim() ? s.location.trim() : 'Chưa phân loại';
            locCounts[loc] = (locCounts[loc] || 0) + 1;
        });

        const empArr = Object.entries(empCounts)
            .map(([name, count]) => ({ name, count }))
            .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => b.count - a.count);

        const locArr = Object.entries(locCounts)
            .map(([name, count]) => ({ name, count }))
            .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => b.count - a.count);

        return { 
            employeeSummary: empArr, 
            locationSummary: locArr,
            totalSchedules: filteredSchedules.length
        };

    }, [schedules, filterType, searchQuery]);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden mt-6">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-tight">
                        <BarChart3 size={18} className="text-purple-600"/> Tổng hợp số lượng lịch công tác ({totalSchedules} lượt)
                    </h3>
                    
                    <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200">
                        <button onClick={() => setFilterType('week')} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${filterType === 'week' ? 'bg-purple-600 text-white shadow-3xs' : 'text-gray-500 hover:bg-gray-100'}`}>Tuần này</button>
                        <button onClick={() => setFilterType('month')} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${filterType === 'month' ? 'bg-purple-600 text-white shadow-3xs' : 'text-gray-500 hover:bg-gray-100'}`}>Tháng này</button>
                        <button onClick={() => setFilterType('year')} className={`px-3 py-1 text-xs font-bold rounded transition-colors ${filterType === 'year' ? 'bg-purple-600 text-white shadow-3xs' : 'text-gray-500 hover:bg-gray-100'}`}>Năm nay</button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex items-center gap-1.5 bg-gray-200/70 p-1 rounded-lg">
                        <button 
                            onClick={() => setViewTab('location')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-md transition-all ${
                                viewTab === 'location' 
                                    ? 'bg-white text-purple-700 shadow-3xs' 
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <MapPin size={14} className={viewTab === 'location' ? 'text-purple-600' : 'text-gray-400'} />
                            Theo Địa bàn Xã/Phường
                        </button>
                        <button 
                            onClick={() => setViewTab('employee')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-md transition-all ${
                                viewTab === 'employee' 
                                    ? 'bg-white text-blue-700 shadow-3xs' 
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Users size={14} className={viewTab === 'employee' ? 'text-blue-600' : 'text-gray-400'} />
                            Theo Nhân viên
                        </button>
                    </div>

                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                        <input 
                            type="text" 
                            placeholder={viewTab === 'location' ? "Lọc theo tên xã phường..." : "Lọc theo tên nhân viên..."} 
                            className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-purple-500 outline-none"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="p-0 overflow-auto max-h-80">
                {viewTab === 'location' ? (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-purple-50/70 text-xs font-extrabold text-purple-900 uppercase sticky top-0 shadow-3xs z-10">
                            <tr>
                                <th className="p-3 w-16 text-center">STT</th>
                                <th className="p-3">Địa bàn Xã / Phường</th>
                                <th className="p-3 w-48 text-center">Số lượt công tác</th>
                                <th className="p-3 w-36 text-center">Tỷ lệ %</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-100 font-medium">
                            {locationSummary.length > 0 ? locationSummary.map((item, idx) => {
                                const percent = totalSchedules > 0 ? ((item.count / totalSchedules) * 100).toFixed(1) : '0';
                                return (
                                    <tr key={item.name} className="hover:bg-purple-50/40 transition-colors">
                                        <td className="p-3 text-center text-gray-400 font-bold">{idx + 1}</td>
                                        <td className="p-3 font-bold text-gray-900 flex items-center gap-2">
                                            <MapPin size={14} className="text-purple-600" />
                                            {item.name}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800 border border-purple-200">
                                                {item.count} lượt
                                            </span>
                                        </td>
                                        <td className="p-3 text-center text-xs font-bold text-gray-600">
                                            {percent}%
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr><td colSpan={4} className="p-8 text-center text-gray-400 italic">Không có dữ liệu địa bàn.</td></tr>
                            )}
                        </tbody>
                    </table>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-blue-50/70 text-xs font-extrabold text-blue-900 uppercase sticky top-0 shadow-3xs z-10">
                            <tr>
                                <th className="p-3 w-16 text-center">STT</th>
                                <th className="p-3">Nhân viên</th>
                                <th className="p-3 w-48 text-center">Số lượt thực hiện</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-100 font-medium">
                            {employeeSummary.length > 0 ? employeeSummary.map((item, idx) => (
                                <tr key={item.name} className="hover:bg-blue-50/40 transition-colors">
                                    <td className="p-3 text-center text-gray-400 font-bold">{idx + 1}</td>
                                    <td className="p-3 font-bold text-gray-800">{item.name}</td>
                                    <td className="p-3 text-center">
                                        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200">
                                            {item.count} lượt
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={3} className="p-8 text-center text-gray-400 italic">Không có dữ liệu nhân viên.</td></tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default ScheduleSummary;
