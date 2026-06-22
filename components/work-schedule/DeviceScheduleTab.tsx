import React, { useState, useMemo } from 'react';
import { User, WorkSchedule } from '../../types';
import { ChevronLeft, ChevronRight, Calendar, Plus, Trash2, ShieldAlert, Cpu } from 'lucide-react';
import { saveWorkSchedule, deleteWorkSchedule } from '../../services/apiWorkSchedule';
import { confirmAction } from '../../utils/appHelpers';

interface DeviceScheduleTabProps {
    currentUser: User;
    schedules: WorkSchedule[];
    onRefresh: () => Promise<void>;
}

export const DeviceScheduleTab: React.FC<DeviceScheduleTabProps> = ({ currentUser, schedules, onRefresh }) => {
    // Xác định Thứ Hai của tuần chứa ngày được chọn
    const getStartOfWeek = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Chủ nhật là 0, Thứ hai là 1
        return new Date(date.setDate(diff));
    };

    const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
        const now = new Date();
        const start = getStartOfWeek(now);
        start.setHours(0, 0, 0, 0);
        return start;
    });

    // Modal/Form đăng ký
    const [isRegisterOpen, setIsRegisterOpen] = useState(false);
    const [selectedDateStr, setSelectedDateStr] = useState('');
    const [selectedSession, setSelectedSession] = useState<'Sáng' | 'Chiều'>('Sáng');
    const [registerNote, setRegisterNote] = useState('');
    const [registerExecutor, setRegisterExecutor] = useState(currentUser.name);

    // Xem chi tiết lịch đã đăng ký
    const [selectedDetailReg, setSelectedDetailReg] = useState<WorkSchedule | null>(null);

    // Lấy 7 ngày trong tuần từ currentWeekStart
    const daysOfWeek = useMemo(() => {
        const days = [];
        const tempDate = new Date(currentWeekStart);
        for (let i = 0; i < 7; i++) {
            days.push(new Date(tempDate));
            tempDate.setDate(tempDate.getDate() + 1);
        }
        return days;
    }, [currentWeekStart]);

    // Lọc các bản ghi đăng ký máy đo
    const deviceSchedules = useMemo(() => {
        return schedules.filter(s => s.partner === 'DANG_KY_MAY_DO');
    }, [schedules]);

    // Hàm chuyển đổi tuần
    const handlePrevWeek = () => {
        setCurrentWeekStart(prev => {
            const next = new Date(prev);
            next.setDate(next.getDate() - 7);
            return next;
        });
    };

    const handleNextWeek = () => {
        setCurrentWeekStart(prev => {
            const next = new Date(prev);
            next.setDate(next.getDate() + 7);
            return next;
        });
    };

    const handleCurrentWeek = () => {
        setCurrentWeekStart(getStartOfWeek(new Date()));
    };

    // Format hiển thị ngày
    const formatDate = (date: Date) => {
        const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
        return {
            dayName: days[date.getDay()],
            dateStr: `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`,
            fullDateIso: date.toISOString().split('T')[0]
        };
    };

    // Tìm lịch đăng ký cho một ngày và một buổi cụ thể
    const findRegistration = (dateIso: string, session: 'Sáng' | 'Chiều') => {
        return deviceSchedules.find(s => {
            if (s.date !== dateIso) return false;
            const contentLower = s.content.trim().toLowerCase();
            if (session === 'Sáng') {
                return contentLower.startsWith('sáng');
            } else {
                return contentLower.startsWith('chiều');
            }
        });
    };

    // Khi người dùng click vào một buổi
    const handleCellClick = (dateIso: string, session: 'Sáng' | 'Chiều') => {
        const existing = findRegistration(dateIso, session);
        if (existing) {
            // Đã có lịch -> Mở Modal chi tiết đăng ký thay vì alert thô sơ
            setSelectedDetailReg(existing);
            return;
        }

        // Chưa có lịch -> Mở form đăng ký
        setSelectedDateStr(dateIso);
        setSelectedSession(session);
        setRegisterNote('');
        setRegisterExecutor(currentUser.name);
        setIsRegisterOpen(true);
    };

    // Hủy đăng ký
    const handleDeleteRegistration = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Tránh kích hoạt click của ô mẹ
        if (await confirmAction('Bạn có chắc chắn muốn hủy đăng ký sử dụng máy đo này?')) {
            const success = await deleteWorkSchedule(id);
            if (success) {
                await onRefresh();
            }
        }
    };

    // Submit Đăng ký
    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!registerExecutor.trim()) {
            alert('Vui lòng điền tên người đăng ký.');
            return;
        }

        // Double check trùng lặp để tránh race condition
        const existing = findRegistration(selectedDateStr, selectedSession);
        if (existing) {
            const displayDate = selectedDateStr.split('-').reverse().join('/');
            alert(`${selectedSession} ngày ${displayDate} đã có nhân viên ${existing.executors} đăng ký sử dụng máy đo hãy chọn Ngày khác.`);
            setIsRegisterOpen(false);
            return;
        }

        const noteText = registerNote.trim() ? ` - ${registerNote.trim()}` : '';
        const scheduleData: Partial<WorkSchedule> = {
            date: selectedDateStr,
            executors: registerExecutor.trim(),
            content: `${selectedSession}${noteText}`,
            partner: 'DANG_KY_MAY_DO',
            created_by: currentUser.username
        };

        const success = await saveWorkSchedule(scheduleData);
        if (success) {
            setIsRegisterOpen(false);
            await onRefresh();
        } else {
            alert('Có lỗi xảy ra khi lưu đăng ký lịch máy đo.');
        }
    };

    // Lấy ngày Thứ Hai và Chủ Nhật để hiển thị tiêu đề Tuần
    const weekTitleStr = useMemo(() => {
        const start = currentWeekStart;
        const end = new Date(currentWeekStart);
        end.setDate(end.getDate() + 6);
        
        const fStart = `${start.getDate().toString().padStart(2, '0')}/${(start.getMonth() + 1).toString().padStart(2, '0')}/${start.getFullYear()}`;
        const fEnd = `${end.getDate().toString().padStart(2, '0')}/${(end.getMonth() + 1).toString().padStart(2, '0')}/${end.getFullYear()}`;
        return `Tuần từ ${fStart} đến ${fEnd}`;
    }, [currentWeekStart]);

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col h-full overflow-hidden">
            {/* Header Tuần */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-150 pb-4 mb-5">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Cpu size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-base">Lịch Sử Dụng Máy Đo</h3>
                        <p className="text-xs text-slate-500 font-medium">{weekTitleStr}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={handlePrevWeek}
                        className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition-all active:scale-95"
                        title="Tuần trước"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <button 
                        onClick={handleCurrentWeek}
                        className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 rounded-xl transition-all active:scale-95"
                    >
                        Tuần này
                    </button>
                    <button 
                        onClick={handleNextWeek}
                        className="p-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 transition-all active:scale-95"
                        title="Tuần sau"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            {/* Bảng Lịch Tuần */}
            <div className="flex-1 overflow-auto">
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4 min-w-[800px] mb-4">
                    {daysOfWeek.map((day, idx) => {
                        const { dayName, dateStr, fullDateIso } = formatDate(day);
                        const isSunday = day.getDay() === 0;
                        const isToday = new Date().toISOString().split('T')[0] === fullDateIso;

                        // Tìm lịch Sáng & Chiều
                        const morningReg = findRegistration(fullDateIso, 'Sáng');
                        const afternoonReg = findRegistration(fullDateIso, 'Chiều');

                        return (
                            <div 
                                key={idx} 
                                className={`flex flex-col border rounded-2xl overflow-hidden transition-all duration-300 ${isToday ? 'border-indigo-550 ring-2 ring-indigo-500/10 shadow-md' : 'border-slate-150'} bg-white`}
                            >
                                {/* Header Ngày */}
                                <div className={`px-3.5 py-3 text-center border-b ${isToday ? 'bg-indigo-600 text-white' : isSunday ? 'bg-red-50/50 text-red-650' : 'bg-slate-50 text-slate-800'}`}>
                                    <div className="text-xs font-bold uppercase tracking-wider">{dayName}</div>
                                    <div className="text-sm font-black mt-0.5">{dateStr}</div>
                                </div>

                                {/* Body Buổi Sáng & Chiều */}
                                <div className="p-3 space-y-3.5 flex-1 flex flex-col justify-between">
                                    {/* BUỔI SÁNG */}
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                                            <span>SÁNG</span>
                                            {morningReg && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
                                        </div>

                                        {morningReg ? (
                                            /* Ô ĐÃ ĐĂNG KÝ (TÔ XANH THEO YÊU CẦU) */
                                            <div 
                                                onClick={() => handleCellClick(fullDateIso, 'Sáng')}
                                                className="group relative cursor-pointer bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-300 rounded-xl p-2.5 transition-all duration-250 select-none text-left"
                                            >
                                                <div className="text-xs font-bold text-emerald-900 leading-tight truncate" title={morningReg.executors}>
                                                    {morningReg.executors}
                                                </div>
                                                <div className="text-[10px] font-medium text-emerald-750 line-clamp-2 mt-1 leading-snug break-words">
                                                    {morningReg.content.replace(/^Sáng(\s*-\s*)?/, '') || 'Sử dụng máy đo'}
                                                </div>
                                                
                                                {/* Nút hủy lịch cho chính chủ hoặc admin */}
                                                {(currentUser.role === 'ADMIN' || morningReg.created_by === currentUser.username) && (
                                                    <button
                                                        onClick={(e) => handleDeleteRegistration(morningReg.id, e)}
                                                        className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-sm border border-red-200 transition-opacity"
                                                        title="Hủy đăng ký"
                                                    >
                                                        <Trash2 size={11} />
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            /* Ô TRỐNG CHƯA ĐĂNG KÝ */
                                            <div 
                                                onClick={() => handleCellClick(fullDateIso, 'Sáng')}
                                                className="group border border-dashed border-slate-200 hover:border-indigo-305 hover:bg-indigo-50/40 rounded-xl p-3 flex flex-col items-center justify-center min-h-[75px] cursor-pointer transition-all duration-200"
                                            >
                                                <Plus size={14} className="text-slate-300 group-hover:text-indigo-500 group-hover:scale-110 transition-all duration-200" />
                                                <span className="text-[10px] text-slate-400 group-hover:text-indigo-650 font-bold mt-1">Đăng ký</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* BUỔI CHIỀU */}
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                                            <span>CHIỀU</span>
                                            {afternoonReg && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
                                        </div>

                                        {afternoonReg ? (
                                            /* Ô ĐÃ ĐĂNG KÝ (TÔ XANH THEO YÊU CẦU) */
                                            <div 
                                                onClick={() => handleCellClick(fullDateIso, 'Chiều')}
                                                className="group relative cursor-pointer bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-300 rounded-xl p-2.5 transition-all duration-250 select-none text-left"
                                            >
                                                <div className="text-xs font-bold text-emerald-900 leading-tight truncate" title={afternoonReg.executors}>
                                                    {afternoonReg.executors}
                                                </div>
                                                <div className="text-[10px] font-medium text-emerald-750 line-clamp-2 mt-1 leading-snug break-words">
                                                    {afternoonReg.content.replace(/^Chiều(\s*-\s*)?/, '') || 'Sử dụng máy đo'}
                                                </div>

                                                {/* Nút hủy lịch cho chính chủ hoặc admin */}
                                                {(currentUser.role === 'ADMIN' || afternoonReg.created_by === currentUser.username) && (
                                                    <button
                                                        onClick={(e) => handleDeleteRegistration(afternoonReg.id, e)}
                                                        className="absolute -top-1.5 -right-1.5 h-6 w-6 rounded-full bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-sm border border-red-200 transition-opacity"
                                                        title="Hủy đăng ký"
                                                    >
                                                        <Trash2 size={11} />
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            /* Ô TRỐNG CHƯA ĐĂNG KÝ */
                                            <div 
                                                onClick={() => handleCellClick(fullDateIso, 'Chiều')}
                                                className="group border border-dashed border-slate-200 hover:border-indigo-305 hover:bg-indigo-50/40 rounded-xl p-3 flex flex-col items-center justify-center min-h-[75px] cursor-pointer transition-all duration-200"
                                            >
                                                <Plus size={14} className="text-slate-300 group-hover:text-indigo-500 group-hover:scale-110 transition-all duration-200" />
                                                <span className="text-[10px] text-slate-400 group-hover:text-indigo-650 font-bold mt-1">Đăng ký</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Chú dẫn */}
            <div className="flex flex-wrap items-center gap-4 bg-slate-50 border border-slate-100 p-3 rounded-2xl text-[11px] text-slate-600 font-medium">
                <span className="font-bold text-slate-700 flex items-center gap-1.5"><Calendar size={13} className="text-indigo-600"/> Ghi chú lịch:</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-6 bg-emerald-50 border border-emerald-200 rounded"></span> Sáng/Chiều đã có đăng ký sử dụng máy</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-6 bg-white border border-dashed border-slate-200 rounded"></span> Buổi còn trống và có thể đăng ký</span>
            </div>

            {/* MODAL ĐĂNG KÝ LỊCH MÁY ĐO */}
            {isRegisterOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden animate-slide-up">
                        <div className="px-5 py-4 bg-indigo-650 text-white flex items-center justify-between">
                            <h4 className="font-bold text-sm flex items-center gap-2">
                                <Cpu size={16} /> Đăng Ký Sử Dụng Máy Đo
                            </h4>
                            <button 
                                onClick={() => setIsRegisterOpen(false)}
                                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-all"
                            >
                                <XIcon size={14} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleRegisterSubmit} className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3.5 p-3.5 bg-slate-50 rounded-xl border border-slate-150">
                                <div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">Ngày sử dụng</div>
                                    <div className="text-xs font-extrabold text-slate-800 mt-0.5">
                                        {selectedDateStr.split('-').reverse().join('/')}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">Buổi đăng ký</div>
                                    <div className="text-xs font-extrabold text-indigo-700 mt-0.5 flex items-center gap-1">
                                        <span className="inline-block w-2 h-2 rounded-full bg-indigo-600"></span>{selectedSession}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tên nhân viên sử dụng <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-550"
                                    placeholder="Điền họ tên người sử dụng..."
                                    required
                                    value={registerExecutor}
                                    onChange={e => setRegisterExecutor(e.target.value)}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ghi chú công tác / Loại máy sử dụng</label>
                                <textarea 
                                    rows={2.5}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-550 resize-none placeholder:text-slate-400"
                                    placeholder="Ví dụ: Đo đạc xã Minh Hưng, sử dụng máy Pentax RTK..."
                                    value={registerNote}
                                    onChange={e => setRegisterNote(e.target.value)}
                                />
                            </div>

                            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                                <button 
                                    type="button" 
                                    onClick={() => setIsRegisterOpen(false)}
                                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
                                >
                                    Hủy bỏ
                                </button>
                                <button 
                                    type="submit" 
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/10 active:scale-95"
                                >
                                    Đăng ký sử dụng
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL CHI TIẾT ĐĂNG LỊCH MÁY ĐO */}
            {selectedDetailReg && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden animate-slide-up">
                        <div className="px-5 py-4 bg-emerald-600 text-white flex items-center justify-between">
                            <h4 className="font-bold text-sm flex items-center gap-2">
                                <Cpu size={16} /> Chi Tiết Đăng Ký Máy Đo
                            </h4>
                            <button 
                                onClick={() => setSelectedDetailReg(null)}
                                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-all"
                            >
                                <XIcon size={14} />
                            </button>
                        </div>
                        
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-3.5 p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                <div>
                                    <div className="text-[10px] font-bold text-emerald-800/60 uppercase">Ngày sử dụng</div>
                                    <div className="text-xs font-extrabold text-emerald-950 mt-0.5">
                                        {selectedDetailReg.date.split('-').reverse().join('/')}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[10px] font-bold text-emerald-800/60 uppercase">Buổi đăng ký</div>
                                    <div className="text-xs font-extrabold text-emerald-900 mt-0.5 flex items-center gap-1">
                                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        {selectedDetailReg.content.trim().toLowerCase().startsWith('chiều') ? 'Chiều' : 'Sáng'}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nhân viên sử dụng</span>
                                <div className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-150 px-3.5 py-2.5 rounded-xl">
                                    {selectedDetailReg.executors}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nội dung công tác & Thiết bị</span>
                                <div className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-150 px-3.5 py-3 rounded-xl min-h-[60px] whitespace-pre-line leading-relaxed">
                                    {selectedDetailReg.content.replace(/^(Sáng|Chiều)(\s*-\s*)?/, '') || 'Sử dụng máy đo'}
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold px-1 pt-1 border-t border-slate-100/60 pt-3">
                                <span>Đăng ký bởi: <strong className="text-slate-600">{selectedDetailReg.created_by || 'Hệ thống'}</strong></span>
                            </div>

                            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                                {/* Cho phép hủy đăng ký nếu là admin hoặc người tạo */}
                                {(currentUser.role === 'ADMIN' || selectedDetailReg.created_by === currentUser.username) ? (
                                    <button 
                                        type="button" 
                                        onClick={async (e) => {
                                            await handleDeleteRegistration(selectedDetailReg.id, e);
                                            setSelectedDetailReg(null);
                                        }}
                                        className="px-4 py-2 bg-rose-50 hover:bg-rose-100 hover:text-rose-700 text-rose-600 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1"
                                    >
                                        <Trash2 size={13} /> Hủy đăng ký
                                    </button>
                                ) : (
                                    <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mr-auto bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                                        <ShieldAlert size={12} className="text-amber-500" /> Chỉ người tạo hoặc Admin được hủy
                                    </div>
                                )}
                                <button 
                                    type="button" 
                                    onClick={() => setSelectedDetailReg(null)}
                                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Icon đóng nhanh thay thế cho Lucide X bị trùng
const XIcon: React.FC<{ size: number }> = ({ size }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
);
