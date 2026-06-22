import React, { useState, useEffect } from 'react';
import { User, WorkSchedule } from '../types';
import { fetchWorkSchedules, saveWorkSchedule, deleteWorkSchedule } from '../services/apiWorkSchedule';
import ScheduleForm from './work-schedule/ScheduleForm';
import ScheduleList from './work-schedule/ScheduleList';
import ScheduleSummary from './work-schedule/ScheduleSummary';
import { DeviceScheduleTab } from './work-schedule/DeviceScheduleTab';
import { Calendar, Plus, CalendarDays, Cpu } from 'lucide-react';

interface WorkScheduleViewProps {
    currentUser: User;
}

const WorkScheduleView: React.FC<WorkScheduleViewProps> = ({ currentUser }) => {
    const [activeTab, setActiveTab] = useState<'work_schedule' | 'device_schedule'>('work_schedule');
    const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
    const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const data = await fetchWorkSchedules();
        setSchedules(data);
    };

    const handleSave = async (data: Partial<WorkSchedule>) => {
        const success = await saveWorkSchedule(data);
        if (success) {
            await loadData();
            setIsFormOpen(false);
            setEditingSchedule(null);
        }
        return success;
    };

    const handleDelete = async (id: string) => {
        const success = await deleteWorkSchedule(id);
        if (success) {
            setSchedules(prev => prev.filter(s => s.id !== id));
        }
    };

    const handleEdit = (schedule: WorkSchedule) => {
        setEditingSchedule(schedule);
        setIsFormOpen(true);
    };

    return (
        <div className="flex flex-col h-full animate-fade-in overflow-hidden">
            {/* Tab Selector đầu trang */}
            <div className="flex border-b border-slate-200 mb-5 shrink-0 bg-white shadow-sm rounded-xl p-1 gap-1">
                <button
                    onClick={() => setActiveTab('work_schedule')}
                    className={`flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg transition-all active:scale-[0.98] flex-1 sm:flex-initial ${
                        activeTab === 'work_schedule'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                >
                    <CalendarDays size={14} /> Lịch công tác
                </button>
                <button
                    onClick={() => setActiveTab('device_schedule')}
                    className={`flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold rounded-lg transition-all active:scale-[0.98] flex-1 sm:flex-initial ${
                        activeTab === 'device_schedule'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                >
                    <Cpu size={14} /> Lịch máy đo
                </button>
            </div>

            {/* Nội dung tương ứng của mỗi Tab */}
            <div className="flex-1 overflow-hidden min-h-0">
                {activeTab === 'work_schedule' ? (
                    <div className="flex h-full gap-6 overflow-hidden">
                        {/* Left Column: Form (Sticky or Modal-like behaviour handled by UI layout) */}
                        <div className={`w-full max-w-sm flex-none transition-all duration-300 overflow-y-auto pr-2 ${isFormOpen ? 'block' : 'hidden md:block'}`}>
                            <div className="flex flex-col gap-4">
                                <button 
                                    onClick={() => { setEditingSchedule(null); setIsFormOpen(true); }}
                                    className="w-full py-3 bg-blue-600 text-white rounded-xl shadow-md hover:bg-blue-700 font-bold flex items-center justify-center gap-2 md:hidden"
                                >
                                    <Plus size={20} /> Tạo Lịch Mới
                                </button>

                                <ScheduleForm 
                                    initialData={editingSchedule}
                                    currentUser={currentUser}
                                    onSave={handleSave}
                                    onCancel={() => { setIsFormOpen(false); setEditingSchedule(null); }}
                                />

                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800 hidden md:block">
                                    <h4 className="font-bold flex items-center gap-2 mb-2"><Calendar size={16}/> Hướng dẫn</h4>
                                    <ul className="list-disc list-inside space-y-1 text-xs">
                                        <li>Nhập đầy đủ ngày và nội dung công việc.</li>
                                        <li>Có thể thêm nhiều người phối hợp.</li>
                                        <li>Sử dụng bộ lọc bên phải để xuất báo cáo.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: List & Summary */}
                        <div className={`flex-1 min-w-0 transition-all duration-300 flex flex-col gap-6 overflow-y-auto pr-2 ${isFormOpen ? 'hidden md:block' : 'block'}`}>
                            <div className="h-[500px] flex-shrink-0">
                                <ScheduleList 
                                    schedules={schedules}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                />
                            </div>
                            
                            <div className="flex-shrink-0 pb-6">
                                <ScheduleSummary schedules={schedules} />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full overflow-hidden">
                        <DeviceScheduleTab 
                            currentUser={currentUser}
                            schedules={schedules}
                            onRefresh={loadData}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkScheduleView;
