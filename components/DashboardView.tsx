
import React, { useMemo, useState, useEffect } from 'react';
import { RecordFile, RecordStatus, WorkSchedule, User, UserRole } from '../types';
import { getNormalizedWard, getShortRecordType } from '../constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { 
  FileText, RotateCcw, CheckCircle, ArchiveX, MapPin, Layers, 
  CalendarRange, CalendarDays, Calendar, 
  Clock, Activity, CloudSun, CloudRain, Sun, Wind, Droplets, User as UserIcon, Settings
} from 'lucide-react';
import { fetchWorkSchedules } from '../services/apiWorkSchedule';
import { getSystemSetting, saveSystemSetting } from '../services/apiSystem';

interface DashboardViewProps {
    records: RecordFile[];
    currentUser?: User;
}

interface WeatherData {
    temp: number;
    weatherCode: number;
    description: string;
    humidity: number;
    windSpeed: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

const STATUS_LABELS: Record<RecordStatus, string> = {
  [RecordStatus.RECEIVED]: 'Tiếp nhận',
  [RecordStatus.ASSIGNED]: 'Giao việc',
  [RecordStatus.IN_PROGRESS]: 'Đang làm',
  [RecordStatus.COMPLETED_WORK]: 'Xong việc',
  [RecordStatus.PENDING_SIGN]: 'Chờ ký',
  [RecordStatus.SIGNED]: 'Đã ký',
  [RecordStatus.HANDOVER]: 'Giao 1 cửa',
  [RecordStatus.RETURNED]: 'Đã trả dân',
  [RecordStatus.WITHDRAWN]: 'Đã rút'
};

const PRESET_LOCATIONS = [
    { name: 'Phường Chơn Thành', latitude: 11.4153, longitude: 106.646 },
    { name: 'Thành phố Bà Rịa', latitude: 10.4963, longitude: 107.1691 },
    { name: 'Thành phố Vũng Tàu', latitude: 10.3460, longitude: 107.0812 },
    { name: 'Thị xã Phú Mỹ', latitude: 10.5847, longitude: 107.0700 },
    { name: 'Huyện Long Điền', latitude: 10.4554, longitude: 107.2185 },
    { name: 'Huyện Đất Đỏ', latitude: 10.4859, longitude: 107.2917 },
    { name: 'Huyện Châu Đức', latitude: 10.5961, longitude: 107.2341 },
    { name: 'Huyện Xuyên Mộc', latitude: 10.5833, longitude: 107.4167 },
    { name: 'Côn Đảo', latitude: 8.6833, longitude: 106.6000 },
    { name: 'Thành phố Hồ Chí Minh', latitude: 10.8231, longitude: 106.6297 },
    { name: 'Hà Nội', latitude: 21.0285, longitude: 105.8542 }
];

const DashboardView: React.FC<DashboardViewProps> = ({ records, currentUser }) => {
    // State chọn chế độ xem: Năm, Tháng, Tuần
    const [viewMode, setViewMode] = useState<'year' | 'month' | 'week'>('year');
    
    // State chọn năm (cho chế độ Year)
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    // Weather location state (defaults to Phường Chơn Thành)
    const [location, setLocation] = useState(() => {
        try {
            const saved = localStorage.getItem('weather_location');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error("Lỗi đọc weather_location từ localStorage:", e);
        }
        return {
            name: 'Phường Chơn Thành',
            latitude: 11.4153,
            longitude: 106.646
        };
    });

    // Inline edit states for weather location
    const [isEditingLocation, setIsEditingLocation] = useState(false);
    const [editName, setEditName] = useState(location.name);
    const [editLat, setEditLat] = useState(location.latitude);
    const [editLon, setEditLon] = useState(location.longitude);

    const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUBADMIN;

    // Weather & Work Schedules state
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [weatherLoading, setWeatherLoading] = useState(true);
    const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
    const [schedulesLoading, setSchedulesLoading] = useState(true);

    // Fetch system-wide weather location on mount
    useEffect(() => {
        const fetchSystemLocation = async () => {
            try {
                const sysLocStr = await getSystemSetting('weather_location');
                if (sysLocStr) {
                    const parsed = JSON.parse(sysLocStr);
                    if (parsed && parsed.name && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
                        setLocation(parsed);
                        setEditName(parsed.name);
                        setEditLat(parsed.latitude);
                        setEditLon(parsed.longitude);
                    }
                }
            } catch (e) {
                console.error("Lỗi lấy địa điểm thời tiết hệ thống:", e);
            }
        };
        fetchSystemLocation();
    }, []);

    // Listen to real-time weather location changes from other clients/users
    useEffect(() => {
        const handleLocationChange = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail) {
                setLocation(detail);
                setEditName(detail.name);
                setEditLat(detail.latitude);
                setEditLon(detail.longitude);
            }
        };
        window.addEventListener('weather_location_changed', handleLocationChange);
        return () => window.removeEventListener('weather_location_changed', handleLocationChange);
    }, []);

    // 1. Fetch weather dynamic to the configured location coordinates
    useEffect(() => {
        const fetchWeather = async () => {
            try {
                setWeatherLoading(true);
                const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current_weather=true&timezone=Asia/Ho_Chi_Minh`);
                const data = await response.json();
                if (data && data.current_weather) {
                    const temp = data.current_weather.temperature;
                    const weatherCode = data.current_weather.weathercode;
                    const windSpeed = data.current_weather.windspeed;
                    
                    let description = 'Nắng ráo';
                    if (weatherCode === 0) description = 'Trời quang đãng';
                    else if (weatherCode >= 1 && weatherCode <= 3) description = 'Ít mây, nắng ấm';
                    else if (weatherCode >= 45 && weatherCode <= 48) description = 'Có sương mù';
                    else if (weatherCode >= 51 && weatherCode <= 55) description = 'Mưa phùn nhẹ';
                    else if (weatherCode >= 61 && weatherCode <= 65) description = 'Mưa rào nhẹ';
                    else if (weatherCode >= 80 && weatherCode <= 82) description = 'Mưa dông lớn';
                    else if (weatherCode === 95) description = 'Có sấm sét giông';
                    
                    setWeather({
                        temp,
                        weatherCode,
                        description,
                        humidity: 78,
                        windSpeed
                    });
                }
            } catch (error) {
                console.error("Lỗi tải thời tiết:", error);
                setWeather({
                    temp: 31,
                    weatherCode: 1,
                    description: 'Nắng ấm',
                    humidity: 72,
                    windSpeed: 11
                });
            } finally {
                setWeatherLoading(false);
            }
        };

        fetchWeather();
    }, [location.latitude, location.longitude]);

    // 2. Fetch work schedules on mount
    useEffect(() => {
        const loadSchedules = async () => {
            try {
                setSchedulesLoading(true);
                const data = await fetchWorkSchedules();
                // Sắp xếp lịch công tác gần nhất (mới nhất theo thời gian giảm dần)
                const sorted = data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setSchedules(sorted.slice(0, 3));
            } catch (error) {
                console.error("Lỗi tải lịch công tác:", error);
            } finally {
                setSchedulesLoading(false);
            }
        };

        loadSchedules();
    }, []);

    // 2. Tự động xác định danh sách các năm có trong dữ liệu
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        const currentYear = new Date().getFullYear();
        years.add(currentYear);

        records.forEach(r => {
            if (r.receivedDate) {
                const y = new Date(r.receivedDate).getFullYear();
                if (!isNaN(y)) years.add(y);
            }
        });
        return Array.from(years).sort((a, b) => b - a);
    }, [records]);

    // 3. Lọc dữ liệu theo chế độ xem
    const filteredRecords = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        
        return records.filter(r => {
            if (!r.receivedDate) return false;
            const rDate = new Date(r.receivedDate);
            
            if (viewMode === 'year') {
                return rDate.getFullYear() === selectedYear;
            } else if (viewMode === 'month') {
                return rDate.getFullYear() === currentYear && rDate.getMonth() === currentMonth;
            } else if (viewMode === 'week') {
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(now);
                monday.setHours(0,0,0,0);
                monday.setDate(diff);
                
                const nextSunday = new Date(monday);
                nextSunday.setDate(monday.getDate() + 6);
                nextSunday.setHours(23,59,59,999);
                
                return rDate >= monday && rDate <= nextSunday;
            }
            return false;
        });
    }, [records, selectedYear, viewMode]);

    // 4. Tính toán thống kê chung
    const total = filteredRecords.length;
    const completed = filteredRecords.filter(r => r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED).length;
    const withdrawn = filteredRecords.filter(r => r.status === RecordStatus.WITHDRAWN).length;
    const processing = total - completed - withdrawn;

    // --- Data cho Biểu đồ Địa bàn (Xã/Phường) ---
    const wardData = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredRecords.forEach(r => {
            const w = getNormalizedWard(r.ward) || 'Khác';
            counts[w] = (counts[w] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value); 
    }, [filteredRecords]);

    // --- Data cho Biểu đồ Loại hồ sơ ---
    const typeData = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredRecords.forEach(r => {
            const t = getShortRecordType(r.recordType);
            counts[t] = (counts[t] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [filteredRecords]);

    // --- Data cho Biểu đồ Trạng thái chi tiết (Item 1) ---
    const statusChartData = useMemo(() => {
        const counts: Record<RecordStatus, number> = {
            [RecordStatus.RECEIVED]: 0,
            [RecordStatus.ASSIGNED]: 0,
            [RecordStatus.IN_PROGRESS]: 0,
            [RecordStatus.COMPLETED_WORK]: 0,
            [RecordStatus.PENDING_SIGN]: 0,
            [RecordStatus.SIGNED]: 0,
            [RecordStatus.HANDOVER]: 0,
            [RecordStatus.RETURNED]: 0,
            [RecordStatus.WITHDRAWN]: 0,
        };
        
        filteredRecords.forEach(r => {
            if (counts[r.status] !== undefined) {
                counts[r.status]++;
            }
        });

        return Object.entries(counts).map(([key, value]) => ({
            name: STATUS_LABELS[key as RecordStatus] || key,
            value
        }));
    }, [filteredRecords]);

    // --- Tính toán Lịch sử hoạt động gần đây (Item 2) ---
    const recentActivities = useMemo(() => {
        interface ActivityItem {
            id: string;
            time: string;
            type: 'received' | 'assigned' | 'completed' | 'work_completed' | 'approved' | 'submitted';
            title: string;
            desc: string;
            code: string;
        }

        const events: ActivityItem[] = [];

        records.forEach(r => {
            const code = r.code || 'Hồ sơ';
            const name = r.customerName || 'Chưa rõ tên';

            if (r.completedDate) {
                events.push({
                    id: `${r.id}-completed`,
                    time: r.completedDate,
                    type: 'completed',
                    title: 'Đã trả kết quả',
                    desc: `Hồ sơ ${code} của khách hàng ${name} đã được bàn giao, hoàn tất thủ tục trả kết quả.`,
                    code
                });
            }
            if (r.approvalDate) {
                events.push({
                    id: `${r.id}-approved`,
                    time: r.approvalDate,
                    type: 'approved',
                    title: 'Đã phê duyệt',
                    desc: `Hồ sơ ${code} (${name}) đã hoàn tất ký duyệt phê duyệt bản đồ / trích lục.`,
                    code
                });
            }
            if (r.submissionDate) {
                events.push({
                    id: `${r.id}-submitted`,
                    time: r.submissionDate,
                    type: 'submitted',
                    title: 'Đã trình ký',
                    desc: `Hồ sơ ${code} (${name}) được trình ký duyệt văn phòng.`,
                    code
                });
            }
            if (r.workCompletedDate) {
                events.push({
                    id: `${r.id}-work_completed`,
                    time: r.workCompletedDate,
                    type: 'work_completed',
                    title: 'Đo đạc xong',
                    desc: `Nhân viên kỹ thuật báo cáo đã hoàn thành đo vẽ hiện trường hồ sơ ${code}.`,
                    code
                });
            }
            if (r.assignedDate) {
                events.push({
                    id: `${r.id}-assigned`,
                    time: r.assignedDate,
                    type: 'assigned',
                    title: 'Đã giao việc',
                    desc: `Đã phân công hồ sơ ${code} cho nhân viên kỹ thuật thụ lý đo vẽ.`,
                    code
                });
            }
            if (r.receivedDate) {
                events.push({
                    id: `${r.id}-received`,
                    time: r.receivedDate,
                    type: 'received',
                    title: 'Đã tiếp nhận',
                    desc: `Tiếp nhận hồ sơ ${code} (${name}) tại địa bàn ${r.ward || 'Chưa rõ xã'}.`,
                    code
                });
            }
        });

        // Sắp xếp giảm dần theo thời gian, lấy tối đa 5 sự kiện gần nhất
        return events
            .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
            .slice(0, 5);
    }, [records]);

    // --- Phân tích hồ sơ Trễ hạn / Sắp trễ hạn (Item 3) ---
    const deadlineAnalysis = useMemo(() => {
        interface DeadlineItem {
            record: RecordFile;
            days: number;
        }

        const overdue: DeadlineItem[] = [];
        const nearDeadline: DeadlineItem[] = [];
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        records.forEach(r => {
            // Không xét các hồ sơ đã hoàn thành hoặc rút
            const isClosed = r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED || r.status === RecordStatus.WITHDRAWN;
            if (isClosed || !r.deadline) return;

            const deadlineDate = new Date(r.deadline);
            deadlineDate.setHours(0, 0, 0, 0);

            const diffTime = deadlineDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                overdue.push({ record: r, days: Math.abs(diffDays) });
            } else if (diffDays <= 3) {
                nearDeadline.push({ record: r, days: diffDays });
            }
        });

        // Trễ hạn lâu nhất lên trước
        overdue.sort((a, b) => b.days - a.days);
        // Sắp hết hạn gần nhất lên trước
        nearDeadline.sort((a, b) => a.days - b.days);

        return { overdue: overdue.slice(0, 5), nearDeadline: nearDeadline.slice(0, 5) };
    }, [records]);

    const getTitle = () => {
        if (viewMode === 'week') return "Tuần này";
        if (viewMode === 'month') return `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`;
        return `Năm ${selectedYear}`;
    };

    // Hàm lấy thời gian hiển thị thân thiện (Activity timeline)
    const formatFriendlyTime = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            const today = new Date();
            if (d.toDateString() === today.toDateString()) {
                return `Hôm nay ${d.toLocaleTimeString('vi-VN', {hour: '2-digit', minute:'2-digit'})}`;
            }
            return d.toLocaleDateString('vi-VN', {day: '2-digit', month: '2-digit', year: 'numeric'});
        } catch {
            return dateStr;
        }
    };

    // Weather Tip
    const getWeatherTip = (code: number) => {
        if (code >= 51 && code <= 95) {
            return "Chú ý che chắn máy đo GPS và ký biên bản hiện trường cẩn thận tránh nước.";
        }
        return "Thời tiết thuận lợi, rất thích hợp cho công tác đo đạc thực địa ngoài thực địa.";
    };

    return (
        <div className="h-full overflow-y-auto space-y-6 p-2 flex flex-col custom-scrollbar pb-10">
            
            {/* HEADER */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 sticky top-0 z-10">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="bg-blue-600 text-white p-2 rounded-lg shadow-blue-200 shadow-md">
                        <CalendarRange size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">Tổng quan tình hình</h2>
                        <p className="text-xs text-gray-500 font-medium">Thống kê dữ liệu: <span className="text-blue-600 font-bold">{getTitle()}</span></p>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button 
                        onClick={() => setViewMode('week')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${viewMode === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <CalendarDays size={14} /> Tuần này
                    </button>
                    <button 
                        onClick={() => setViewMode('month')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${viewMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Calendar size={14} /> Tháng này
                    </button>
                    <div className="h-4 w-px bg-slate-300 mx-1"></div>
                    <div className="flex items-center gap-1 px-1">
                        <span className={`text-xs font-bold ${viewMode === 'year' ? 'text-blue-600' : 'text-slate-500'}`} onClick={() => setViewMode('year')}>Năm:</span>
                        <select 
                            value={selectedYear} 
                            onChange={(e) => { setSelectedYear(parseInt(e.target.value)); setViewMode('year'); }}
                            className="bg-transparent border-none text-xs font-bold text-slate-700 outline-none cursor-pointer hover:text-blue-600 transition-colors"
                        >
                            {availableYears.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* CARDS: THỐNG KÊ CHI TIẾT */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between relative overflow-hidden group">
                    <div className="absolute -bottom-4 -right-4 opacity-10 group-hover:opacity-20 transition-all duration-300 transform rotate-12 z-0">
                        <FileText size={80} className="text-blue-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Tổng nhận</p>
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

            {/* ITEM 5: WIDGET THỜI TIẾT / LỊCH LÀM VIỆC TÍCH HỢP */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Weather Widget */}
                <div className="lg:col-span-2 bg-gradient-to-br from-blue-500 via-indigo-600 to-indigo-700 p-6 rounded-2xl text-white shadow-md flex flex-col justify-between min-h-[220px] relative overflow-hidden">
                    <div className="absolute -right-10 -bottom-10 opacity-15 pointer-events-none transform rotate-12">
                        <CloudSun size={200} />
                    </div>
                    
                    {/* Inline Location Settings Panel */}
                    {isEditingLocation && (
                        <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-md p-5 z-20 flex flex-col justify-between text-white animate-fade-in">
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-blue-200 flex items-center gap-1.5 mb-3 border-b border-white/10 pb-2">
                                    <MapPin size={12} className="text-yellow-300" /> Thiết lập địa điểm thời tiết
                                </h4>
                                
                                <div className="space-y-2.5 text-xs">
                                    <div>
                                        <label className="block text-[10px] text-blue-200 font-bold uppercase mb-1">Chọn nhanh quận/huyện</label>
                                        <select
                                            value={PRESET_LOCATIONS.find(p => p.latitude === editLat && p.longitude === editLon)?.name || 'custom'}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val !== 'custom') {
                                                    const preset = PRESET_LOCATIONS.find(p => p.name === val);
                                                    if (preset) {
                                                        setEditName(preset.name);
                                                        setEditLat(preset.latitude);
                                                        setEditLon(preset.longitude);
                                                    }
                                                }
                                            }}
                                            className="w-full bg-white/10 border border-white/20 text-white rounded px-2 py-1.5 text-xs outline-none focus:border-white/40 cursor-pointer"
                                        >
                                            <option value="custom" className="text-slate-800">-- Tự nhập tọa độ --</option>
                                            {PRESET_LOCATIONS.map(p => (
                                                <option key={p.name} value={p.name} className="text-slate-800">{p.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] text-blue-200 font-bold uppercase mb-1">Tên hiển thị địa điểm</label>
                                        <input 
                                            type="text" 
                                            value={editName} 
                                            onChange={(e) => setEditName(e.target.value)} 
                                            placeholder="Ví dụ: Thành phố Bà Rịa..."
                                            className="w-full bg-white/10 border border-white/20 text-white rounded px-2.5 py-1 text-xs outline-none focus:border-white/40"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[10px] text-blue-200 font-bold uppercase mb-1">Vĩ độ (Latitude)</label>
                                            <input 
                                                type="number" 
                                                step="0.0001"
                                                value={editLat} 
                                                onChange={(e) => setEditLat(parseFloat(e.target.value) || 0)} 
                                                className="w-full bg-white/10 border border-white/20 text-white rounded px-2 py-1 text-xs outline-none focus:border-white/40"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] text-blue-200 font-bold uppercase mb-1">Kinh độ (Longitude)</label>
                                            <input 
                                                type="number" 
                                                step="0.0001"
                                                value={editLon} 
                                                onChange={(e) => setEditLon(parseFloat(e.target.value) || 0)} 
                                                className="w-full bg-white/10 border border-white/20 text-white rounded px-2 py-1 text-xs outline-none focus:border-white/40"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                                <button 
                                    onClick={() => {
                                        setEditName(location.name);
                                        setEditLat(location.latitude);
                                        setEditLon(location.longitude);
                                        setIsEditingLocation(false);
                                    }}
                                    className="px-2.5 py-1 text-[11px] font-bold text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded transition-colors"
                                >
                                    Hủy
                                </button>
                                <button 
                                    onClick={async () => {
                                        const newLoc = { name: editName, latitude: editLat, longitude: editLon };
                                        setLocation(newLoc);
                                        localStorage.setItem('weather_location', JSON.stringify(newLoc));
                                        setIsEditingLocation(false);
                                        try {
                                            await saveSystemSetting('weather_location', JSON.stringify(newLoc));
                                        } catch (e) {
                                            console.error("Lỗi lưu địa điểm thời tiết hệ thống:", e);
                                        }
                                    }}
                                    className="px-3 py-1 text-[11px] font-bold text-slate-800 bg-white hover:bg-slate-100 rounded shadow-md transition-colors"
                                >
                                    Lưu cấu hình
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="z-10">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-widest text-blue-100 flex items-center gap-1.5">
                                    <MapPin size={12} className="text-yellow-300" /> {location.name}
                                    {isAdmin && (
                                        <button 
                                            onClick={() => {
                                                setEditName(location.name);
                                                setEditLat(location.latitude);
                                                setEditLon(location.longitude);
                                                setIsEditingLocation(true);
                                            }}
                                            className="p-1 hover:bg-white/10 rounded-md text-yellow-200 hover:text-white transition-colors"
                                            title="Cấu hình địa điểm"
                                        >
                                            <Settings size={12} className="animate-spin-slow" />
                                        </button>
                                    )}
                                </h3>
                                <p className="text-lg font-bold mt-1">Dự báo hôm nay</p>
                            </div>
                            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm border border-white/10 text-white">
                                {weatherLoading ? (
                                    <Clock size={18} className="animate-spin" />
                                ) : weather?.weatherCode !== undefined && weather.weatherCode >= 51 && weather.weatherCode <= 95 ? (
                                    <CloudRain size={24} className="text-blue-200 animate-bounce" />
                                ) : (
                                    <Sun size={24} className="text-amber-300 animate-pulse" />
                                )}
                            </div>
                        </div>

                        {weatherLoading ? (
                            <div className="py-4 space-y-2 animate-pulse">
                                <div className="h-8 bg-white/20 w-1/3 rounded"></div>
                                <div className="h-4 bg-white/20 w-1/2 rounded"></div>
                            </div>
                        ) : weather ? (
                            <div className="mt-4 flex items-baseline gap-2">
                                <span className="text-5xl font-black tracking-tighter">{weather.temp}°C</span>
                                <span className="text-sm font-bold bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                                    {weather.description}
                                </span>
                            </div>
                        ) : null}
                    </div>

                    <div className="z-10 mt-6 pt-4 border-t border-white/10">
                        <div className="flex justify-between text-xs text-blue-100 font-medium mb-3">
                            <span className="flex items-center gap-1"><Droplets size={12} className="text-blue-300" /> Độ ẩm: {weather?.humidity || 75}%</span>
                            <span className="flex items-center gap-1"><Wind size={12} className="text-teal-300" /> Gió: {weather?.windSpeed || 12} km/h</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-blue-50/90 italic font-medium bg-white/5 p-2 rounded-lg border border-white/5">
                            📌 {getWeatherTip(weather?.weatherCode || 0)}
                        </p>
                    </div>
                </div>

                {/* Work Schedules Widget */}
                <div className="lg:col-span-3 bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between min-h-[220px]">
                    <div>
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                <CalendarDays className="text-indigo-600" size={18} /> Lịch công tác tích hợp
                            </h3>
                            <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider">Gần nhất</span>
                        </div>

                        <div className="mt-3 space-y-3">
                            {schedulesLoading ? (
                                <div className="space-y-2 animate-pulse">
                                    <div className="h-10 bg-slate-100 rounded-lg"></div>
                                    <div className="h-10 bg-slate-100 rounded-lg"></div>
                                </div>
                            ) : schedules.length > 0 ? (
                                schedules.map((sc) => (
                                    <div key={sc.id} className="flex gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                                        <div className="bg-indigo-50 text-indigo-700 p-2 rounded-lg flex flex-col items-center justify-center min-w-[52px] h-[52px] shrink-0 border border-indigo-100/30">
                                            <span className="text-[10px] font-bold uppercase">Thg {new Date(sc.date).getMonth() + 1}</span>
                                            <span className="text-lg font-black leading-none">{new Date(sc.date).getDate()}</span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-bold text-slate-700 truncate block">{sc.content}</span>
                                                {sc.partner && <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 shrink-0 font-medium">{sc.partner}</span>}
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                                <UserIcon size={10} className="text-slate-400" /> Nhân viên: <span className="font-semibold text-slate-600">{sc.executors}</span>
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-6 text-slate-400">
                                    <p className="text-xs font-medium">Không có lịch công tác sắp tới được ghi nhận.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* CHARTS SECTION (Item 1) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* CHART 1: Thống kê theo Địa bàn */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[350px]">
                    <h3 className="text-sm font-bold text-gray-800 mb-3 shrink-0 flex items-center gap-2 uppercase tracking-wide">
                        <MapPin size={18} className="text-blue-600" /> Phân bố địa bàn ({getTitle()})
                    </h3>
                    <div className="flex-1 min-h-0 w-full relative">
                        {wardData.length > 0 ? (
                            <div className="absolute inset-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={wardData} layout="vertical" margin={{ top: 5, right: 15, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                                        <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis dataKey="name" type="category" width={90} fontSize={10} tick={{fill: '#4b5563', fontWeight: 600}} tickLine={false} axisLine={false} />
                                        <Tooltip 
                                            cursor={{ fill: '#f3f4f6' }} 
                                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                                        />
                                        <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={14} name="Hồ sơ" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <p className="text-xs">Chưa có dữ liệu địa bàn {getTitle()}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* CHART 2: Phân loại Hồ sơ */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col h-[350px]">
                    <h3 className="text-sm font-bold text-gray-800 mb-3 shrink-0 flex items-center gap-2 uppercase tracking-wide">
                        <Layers size={18} className="text-purple-600" /> Loại hình hồ sơ ({getTitle()})
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
                                            innerRadius={50} 
                                            outerRadius={80} 
                                            paddingAngle={2} 
                                            dataKey="value"
                                        >
                                            {typeData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                        <Legend 
                                            layout="horizontal" 
                                            verticalAlign="bottom" 
                                            align="center"
                                            wrapperStyle={{ fontSize: '9px', fontWeight: 600, color: '#4b5563', paddingTop: '10px' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <p className="text-xs">Chưa có dữ liệu loại hồ sơ {getTitle()}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ITEM 2: LỊCH SỬ HOẠT ĐỘNG GẦN ĐÂY */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[400px]">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <Activity className="text-blue-500" size={18} /> Lịch sử hoạt động gần đây
                    </h3>
                    <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-wider">Hệ thống</span>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar mt-3 pr-1">
                    {recentActivities.length > 0 ? (
                        <div className="relative border-l border-slate-100 pl-4 py-2 space-y-5 ml-2.5">
                            {recentActivities.map((act) => {
                                // Xác định icon và màu sắc cho từng loại hoạt động
                                let iconColor = 'bg-blue-50 text-blue-600 border-blue-100';
                                let iconElement = <FileText size={12} />;

                                if (act.type === 'completed') {
                                    iconColor = 'bg-green-50 text-green-600 border-green-100';
                                    iconElement = <CheckCircle size={12} />;
                                } else if (act.type === 'work_completed') {
                                    iconColor = 'bg-emerald-50 text-emerald-600 border-emerald-100';
                                    iconElement = <RotateCcw size={12} />;
                                } else if (act.type === 'approved' || act.type === 'submitted') {
                                    iconColor = 'bg-purple-50 text-purple-600 border-purple-100';
                                    iconElement = <Clock size={12} />;
                                }

                                return (
                                    <div key={act.id} className="relative group">
                                        {/* Điểm mốc trên dòng thời gian */}
                                        <div className={`absolute -left-[27px] top-1.5 w-6 h-6 rounded-full border ${iconColor} flex items-center justify-center shadow-sm z-10 bg-white group-hover:scale-110 transition-transform`}>
                                            {iconElement}
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between gap-2">
                                                <h4 className="text-xs font-black text-slate-800">{act.title}</h4>
                                                <span className="text-[9px] text-slate-400 font-bold">{formatFriendlyTime(act.time)}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{act.desc}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10">
                            <Activity size={32} className="text-slate-300 mb-2" />
                            <p className="text-xs font-medium">Chưa có hoạt động mới ghi nhận.</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};

export default DashboardView;
