
import React, { useState, useEffect } from 'react';
import { User, WorkSchedule } from '../types';
import { fetchWorkSchedules, saveWorkSchedule, deleteWorkSchedule } from '../services/apiWorkSchedule';
import ScheduleForm from './work-schedule/ScheduleForm';
import ScheduleList from './work-schedule/ScheduleList';
import { Calendar, Plus } from 'lucide-react';

interface WorkScheduleViewProps {
    currentUser: User;
}

const WorkScheduleView: React.FC<WorkScheduleViewProps> = ({ currentUser }) => {
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
        <div className="flex h-full gap-6 animate-fade-in">
            {/* Left Column: Form (Sticky or Modal-like behaviour handled by UI layout) */}
            <div className={`w-full max-w-sm flex-none transition-all duration-300 ${isFormOpen ? 'block' : 'hidden md:block'}`}>
                <div className="h-full flex flex-col gap-4">
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

            {/* Right Column: List */}
            <div className={`flex-1 min-w-0 transition-all duration-300 ${isFormOpen ? 'hidden md:block' : 'block'}`}>
                <ScheduleList 
                    schedules={schedules}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            </div>
        </div>
    );
};

export default WorkScheduleView;
