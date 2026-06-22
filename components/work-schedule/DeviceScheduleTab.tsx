import React, { useState, useMemo } from 'react';
import { User, DeviceSchedule } from '../../types';
import { ChevronLeft, ChevronRight, Calendar, Plus, Trash2, ShieldAlert, Cpu } from 'lucide-react';
import { saveDeviceSchedule, deleteDeviceSchedule } from '../../services/apiDeviceSchedule';
import { confirmAction } from '../../utils/appHelpers';

interface DeviceScheduleTabProps {
    currentUser: User;
    deviceSchedules: DeviceSchedule[];
    onRefresh: () => Promise<void>;
}

export const DeviceScheduleTab: React.FC<DeviceScheduleTabProps> = ({ currentUser, deviceSchedules, onRefresh }) => {
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

    // Xem chi tiết lịch đã đăng ký (thay cho popup)
    const [selectedDetailReg, setSelectedDetailReg] = useState<DeviceSchedule | null>(null);

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

    // Hàm chuyển đổi tuần
    const handlePrevWeek = () => {
        setCurrentWeekStart(prev => {
            const next = new Date(prev);
            next.setDate(next.getDate() - 7);
            return next;
        });
        setSelectedDetailReg(null);
    };

    const handleNextWeek = () => {
        setCurrentWeekStart(prev => {
            const next = new Date(prev);
            next.setDate(next.getDate() + 7);
            return next;
        });
        setSelectedDetailReg(null);
    };

    const handleCurrentWeek = () => {
        setCurrentWeekStart(getStartOfWeek(new Date()));
        setSelectedDetailReg(null);
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
        return deviceSchedules.find(s => s.date === dateIso && s.session === session);
    };

    // Khi người dùng click vào một buổi
    const handleCellClick = (dateIso: string, session: 'Sáng' | 'Chiều') => {
        const existing = findRegistration(dateIso, session);
        if (existing) {
            // Đã có lịch -> Chọn làm chi tiết hiển thị bên dưới thay vì alert
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
            const success = await deleteDeviceSchedule(id);
            if (success) {
                await onRefresh();
                if (selectedDetailReg?.id === id) {
                    setSelectedDetailReg(null);
                }
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

        const scheduleData: Partial<DeviceSchedule> = {
            date: selectedDateStr,
            session: selectedSession,
            executors: registerExecutor.trim(),
            note: registerNote.trim() || null,
            created_by: currentUser.username
        };

        const success = await saveDeviceSchedule(scheduleData);
        if (success) {
            setIsRegisterOpen(false);
            await onRefresh();
        } else {
            alert('Có lỗi xảy ra khi lưu đăng ký lịch máy đo.');
        }
    };

    // Tính số tuần trong năm (ISO-8601) đại diện cho currentWeekStart
    const currentWeekNo = useMemo(() => {
        const start = currentWeekStart;
        const thursday = new Date(start);
        thursday.setDate(thursday.getDate() + 3); // Thứ Hai + 3 ngày = Thứ Năm
        
        const dateCopy = new Date(Date.UTC(thursday.getFullYear(), thursday.getMonth(), thursday.getDate()));
        const dayNum = dateCopy.getUTCDay() || 7;
        dateCopy.setUTCDate(dateCopy.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(dateCopy.getUTCFullYear(), 0, 1));
        return Math.ceil((((dateCopy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    }, [currentWeekStart]);

    // Lấy ngày Thứ Hai và Chủ Nhật để hiển thị tiêu đề Tuần kèm số thứ tự tuần trong năm (ISO-8601)
    const weekTitleStr = useMemo(() => {
        const start = currentWeekStart;
        const end = new Date(currentWeekStart);
        end.setDate(end.getDate() + 6);
        
        const fStart = `${start.getDate().toString().padStart(2, '0')}/${(start.getMonth() + 1).toString().padStart(2, '0')}/${start.getFullYear()}`;
        const fEnd = `${end.getDate().toString().padStart(2, '0')}/${(end.getMonth() + 1).toString().padStart(2, '0')}/${end.getFullYear()}`;

        return `Tuần ${currentWeekNo} (Từ ${fStart} đến ${fEnd})`;
    }, [currentWeekStart, currentWeekNo]);

    // Kiểm tra xem có đang xem tuần hiện tại chứa ngày hôm nay hay không
    const isViewingCurrentWeek = useMemo(() => {
        const todayStart = getStartOfWeek(new Date());
        todayStart.setHours(0, 0, 0, 0);
        return currentWeekStart.getTime() === todayStart.getTime();
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
                        <h3 className="font-bold text-slate-800 text-base text-left">Lịch Sử Dụng Máy Đo</h3>
                        <p className="text-xs text-slate-500 font-medium text-left">{weekTitleStr}</p>
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
                        className={`px-4 py-2 border text-xs font-bold rounded-xl transition-all active:scale-95 ${
                            isViewingCurrentWeek 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-extrabold' 
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                        title={isViewingCurrentWeek ? 'Đang xem tuần hiện tại' : 'Quay về tuần hiện tại'}
                    >
                        Tuần {currentWeekNo}
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
                                            /* Ô ĐÃ ĐĂNG KÝ (TÔ XANH THEO YÊU CẦU) - Bấm vào sẽ hiện chi tiết */
                                            <div 
                                                onClick={() => setSelectedDetailReg(morningReg)}
                                                className={`group relative cursor-pointer border rounded-xl p-3 transition-all duration-200 select-none text-left ${
                                                    selectedDetailReg?.id === morningReg.id
                                                    ? 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-500/20 shadow-sm shadow-emerald-100'
                                                    : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 hover:border-emerald-300'
                                                }`}
                                            >
                                                <div className="text-xs font-bold text-emerald-950 leading-tight break-words" title={morningReg.executors}>
                                                    {morningReg.executors}
                                                </div>
                                                
                                                {/* Nút hủy lịch nhanh cho chính chủ hoặc admin */}
                                                {(currentUser.role === 'ADMIN' || morningReg.created_by === currentUser.username) && (
                                                    <button
                                                        onClick={(e) => handleDeleteRegistration(morningReg.id, e)}
                                                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-100 hover:bg-red-200 text-red-605 flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-sm border border-red-200 transition-opacity"
                                                        title="Hủy đăng ký"
                                                    >
                                                        <Trash2 size={10} />
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            /* Ô TRỐNG CHƯA ĐĂNG KÝ */
                                            <div 
                                                onClick={() => handleCellClick(fullDateIso, 'Sáng')}
                                                className="group border border-dashed border-slate-200 hover:border-indigo-305 hover:bg-indigo-50/40 rounded-xl p-3 flex flex-col items-center justify-center min-h-[56px] cursor-pointer transition-all duration-200"
                                            >
                                                <Plus size={13} className="text-slate-300 group-hover:text-indigo-500 group-hover:scale-110 transition-all duration-200" />
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
                                            /* Ô ĐÃ ĐĂNG KÝ (TÔ XANH THEO YÊU CẦU) - Bấm vào sẽ hiện chi tiết */
                                            <div 
                                                onClick={() => setSelectedDetailReg(afternoonReg)}
                                                className={`group relative cursor-pointer border rounded-xl p-3 transition-all duration-200 select-none text-left ${
                                                    selectedDetailReg?.id === afternoonReg.id
                                                    ? 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-500/20 shadow-sm shadow-emerald-100'
                                                    : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 hover:border-emerald-300'
                                                }`}
                                            >
                                                <div className="text-xs font-bold text-emerald-950 leading-tight break-words" title={afternoonReg.executors}>
                                                    {afternoonReg.executors}
                                                </div>

                                                {/* Nút hủy lịch nhanh cho chính chủ hoặc admin */}
                                                {(currentUser.role === 'ADMIN' || afternoonReg.created_by === currentUser.username) && (
                                                    <button
                                                        onClick={(e) => handleDeleteRegistration(afternoonReg.id, e)}
                                                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-100 hover:bg-red-200 text-red-605 flex items-center justify-center opacity-0 group-hover:opacity-100 shadow-sm border border-red-200 transition-opacity"
                                                        title="Hủy đăng ký"
                                                    >
                                                        <Trash2 size={10} />
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            /* Ô TRỐNG CHƯA ĐĂNG KÝ */
                                            <div 
                                                onClick={() => handleCellClick(fullDateIso, 'Chiều')}
                                                className="group border border-dashed border-slate-200 hover:border-indigo-305 hover:bg-indigo-50/40 rounded-xl p-3 flex flex-col items-center justify-center min-h-[56px] cursor-pointer transition-all duration-200"
                                            >
                                                <Plus size={13} className="text-slate-300 group-hover:text-indigo-500 group-hover:scale-110 transition-all duration-200" />
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

            {/* PANEL CHI TIẾT ĐĂNG KÝ (KHU VỰC VẼ KHUNG ĐỎ CŨ CỦA NGƯỜI DÙNG) */}
            <div className="mt-4 mb-4 bg-slate-50 rounded-2xl border border-slate-205 p-5 min-h-[170px] flex flex-col justify-center">
                {selectedDetailReg ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in text-left">
                        {/* Cột 1: Thông tin cơ bản */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-indigo-700">
                                <Cpu size={16} />
                                <span className="text-[11px] font-extrabold uppercase tracking-wider">Thông tin đăng ký máy</span>
                            </div>
                            <div className="p-3.5 bg-white border border-slate-150 rounded-xl space-y-1.5 shadow-sm">
                                <div className="text-[10px] text-slate-400 font-bold uppercase">Ngày đăng ký</div>
                                <div className="text-xs font-black text-slate-800">
                                    Thứ {new Date(selectedDetailReg.date).getDay() === 0 ? 'Nhật' : new Date(selectedDetailReg.date).getDay() + 1} - {selectedDetailReg.date.split('-').reverse().join('/')}
                                </div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase mt-2">Buổi đăng ký</div>
                                <div className="text-xs font-bold text-indigo-600 flex items-center gap-1.5">
                                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                                    {selectedDetailReg.session === 'Chiều' ? 'Buổi Chiều' : 'Buổi Sáng'}
                                </div>
                            </div>
                        </div>

                        {/* Cột 2: Người sử dụng & Nội dung */}
                        <div className="md:col-span-2 flex flex-col justify-between gap-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nhân viên sử dụng máy</span>
                                    <div className="text-xs font-bold text-slate-800 bg-white border border-slate-150 px-3.5 py-2.5 rounded-xl shadow-sm">
                                        {selectedDetailReg.executors}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tài khoản đăng ký</span>
                                    <div className="text-xs font-semibold text-slate-600 bg-white border border-slate-150 px-3.5 py-2.5 rounded-xl shadow-sm">
                                        {selectedDetailReg.created_by || 'Hệ thống'}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nội dung công tác & Thiết bị sử dụng</span>
                                <div className="text-xs font-medium text-slate-700 bg-white border border-slate-150 px-3.5 py-3 rounded-xl min-h-[50px] whitespace-pre-line shadow-sm leading-relaxed">
                                    {selectedDetailReg.note || 'Sử dụng máy đo công trình.'}
                                </div>
                            </div>
                        </div>

                        {/* Thanh tác vụ */}
                        <div className="md:col-span-3 flex items-center justify-between pt-3 border-t border-slate-200 text-xs">
                            <button
                                type="button"
                                onClick={() => setSelectedDetailReg(null)}
                                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[11px] font-bold transition-all text-left"
                            >
                                Đóng xem chi tiết
                            </button>

                            <div className="flex items-center gap-2">
                                {/* Hủy trực tiếp nếu là admin hoặc chủ sở hữu */}
                                {(currentUser.role === 'ADMIN' || selectedDetailReg.created_by === currentUser.username) ? (
                                    <button 
                                        type="button" 
                                        onClick={async (e) => {
                                            await handleDeleteRegistration(selectedDetailReg.id, e);
                                        }}
                                        className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5 shadow-sm"
                                    >
                                        <Trash2 size={13} /> Hủy đăng ký lịch này
                                    </button>
                                ) : (
                                    <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 bg-white px-3 py-2 rounded-xl border border-slate-150 shadow-sm">
                                        <ShieldAlert size={12} className="text-amber-500 animate-bounce" /> Chỉ có người đăng ký này hoặc Admin mới có quyền hủy
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    // Trạng thái trống -> Hiển thị danh sách tổng hợp tuần cho tiện theo dõi
                    <div className="flex flex-col items-center justify-center text-center py-2 w-full">
                        {deviceSchedules.length > 0 ? (
                            <div className="w-full text-left">
                                <div className="text-xs font-extrabold text-slate-705 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="w-1.5 h-3 bg-indigo-600 rounded-full inline-block"></span>
                                    Danh sách đăng ký sử dụng máy đo trong tuần:
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[140px] overflow-y-auto pr-1">
                                    {deviceSchedules.map((item) => {
                                        const sessionLabel = item.session;
                                        const displayDate = item.date.split('-').reverse().join('/');
                                        return (
                                            <div 
                                                key={item.id}
                                                onClick={() => setSelectedDetailReg(item)}
                                                className="bg-white border border-slate-150 hover:border-indigo-400 rounded-xl p-3 flex flex-col justify-between transition-all duration-200 cursor-pointer shadow-sm text-left group"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[11px] font-extrabold text-slate-800 truncate">{item.executors}</span>
                                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-black rounded-md shrink-0">{sessionLabel} • {displayDate}</span>
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-medium truncate mt-1.5">
                                                    {item.note || 'Sử dụng máy đo'}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1.5 py-4">
                                <div className="text-slate-350 flex justify-center"><Calendar size={28} /></div>
                                <h4 className="font-bold text-slate-500 text-xs text-center">Phần thông tin chi tiết & danh sách máy đo</h4>
                                <p className="text-[10px] text-slate-400 max-w-sm text-center">Chọn một buổi đã đăng ký có tên nhân viên ở trên để xem chi tiết lịch trình, nội dung công tác đê hoặc tiến hành hủy đăng ký lịch đo.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Chú dẫn */}
            <div className="flex flex-wrap items-center gap-4 bg-slate-50 border border-slate-100 p-3 rounded-2xl text-[11px] text-slate-600 font-medium">
                <span className="font-bold text-slate-700 flex items-center gap-1.5"><Calendar size={13} className="text-indigo-600"/> Ghi chú lịch:</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-6 bg-emerald-50 border border-emerald-200 rounded"></span> Đã đăng ký sử dụng máy</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-6 bg-white border border-dashed border-slate-200 rounded"></span> Còn trống và có thể đăng ký</span>
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
                                    <div className="text-xs font-extrabold text-slate-800 mt-0.5 text-left">
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

                            <div className="space-y-1.5 text-left">
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

                            <div className="space-y-1.5 text-left">
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
                                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-705 rounded-xl text-xs font-bold transition-all active:scale-95"
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
