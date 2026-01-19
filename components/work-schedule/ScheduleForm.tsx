
import React, { useState, useEffect } from 'react';
import { WorkSchedule, User } from '../../types';
import { Calendar, User as UserIcon, FileText, Building, Save, X, Plus } from 'lucide-react';

interface ScheduleFormProps {
    initialData?: WorkSchedule | null;
    currentUser: User;
    onSave: (data: Partial<WorkSchedule>) => Promise<boolean>;
    onCancel: () => void;
}

const ScheduleForm: React.FC<ScheduleFormProps> = ({ initialData, currentUser, onSave, onCancel }) => {
    const [formData, setFormData] = useState<Partial<WorkSchedule>>({
        date: new Date().toISOString().split('T')[0],
        executors: currentUser.name,
        content: '',
        partner: ''
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else {
            // Reset khi tạo mới
            setFormData({
                date: new Date().toISOString().split('T')[0],
                executors: currentUser.name,
                content: '',
                partner: ''
            });
        }
    }, [initialData, currentUser]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.date || !formData.executors || !formData.content) {
            alert('Vui lòng nhập đầy đủ Ngày, Người thực hiện và Nội dung công việc.');
            return;
        }

        setIsSaving(true);
        const success = await onSave({
            ...formData,
            created_by: initialData ? initialData.created_by : currentUser.username
        });
        setIsSaving(false);
        
        if (!success) {
            alert('Lỗi khi lưu lịch công tác.');
        }
    };

    const addExecutor = () => {
        const name = prompt("Nhập tên người phối hợp:");
        if (name) {
            setFormData(prev => ({
                ...prev,
                executors: prev.executors ? `${prev.executors}, ${name}` : name
            }));
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-blue-200 shadow-sm">
            <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2 border-b pb-2">
                {initialData ? 'Chỉnh sửa Lịch Công Tác' : 'Thêm Lịch Công Tác Mới'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ngày công tác <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <Calendar size={16} className="absolute left-3 top-3 text-gray-400" />
                        <input 
                            type="date" 
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.date}
                            onChange={e => setFormData({...formData, date: e.target.value})}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Người thực hiện <span className="text-red-500">*</span></label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <UserIcon size={16} className="absolute left-3 top-3 text-gray-400" />
                            <input 
                                type="text" 
                                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                value={formData.executors}
                                onChange={e => setFormData({...formData, executors: e.target.value})}
                                placeholder="Nhập tên người thực hiện..."
                            />
                        </div>
                        <button 
                            type="button" 
                            onClick={addExecutor}
                            className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-100 flex items-center gap-1 text-xs font-bold whitespace-nowrap"
                        >
                            <Plus size={14} /> Thêm người
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Văn bản / Nội dung công việc <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <FileText size={16} className="absolute left-3 top-3 text-gray-400" />
                        <textarea 
                            rows={3}
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            value={formData.content}
                            onChange={e => setFormData({...formData, content: e.target.value})}
                            placeholder="Nhập nội dung chi tiết..."
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cơ quan phối hợp</label>
                    <div className="relative">
                        <Building size={16} className="absolute left-3 top-3 text-gray-400" />
                        <input 
                            type="text" 
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={formData.partner}
                            onChange={e => setFormData({...formData, partner: e.target.value})}
                            placeholder="VD: UBND xã, Phòng TNMT..."
                        />
                    </div>
                </div>

                <div className="pt-4 border-t flex justify-end gap-3">
                    <button 
                        type="button" 
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                    >
                        Hủy
                    </button>
                    <button 
                        type="submit" 
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md font-bold text-sm transition-all"
                    >
                        <Save size={16} /> {initialData ? 'Cập nhật' : 'Lưu lịch'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ScheduleForm;
