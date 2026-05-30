
import { RecordFile, RecordStatus, Holiday } from '../types';

// --- HÀM TIỆN ÍCH XỬ LÝ CHUỖI TIẾNG VIỆT ---
export function removeVietnameseTones(str: string): string {
    if (!str) return '';
    str = str.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); 
    str = str.replace(/\u02C6|\u0306|\u031B/g, ""); 
    str = str.replace(/ + /g, " ");
    str = str.trim();
    return str;
}

// Hàm chuyển đổi Title Case (Nguyễn Văn A)
export function toTitleCase(str: string | null | undefined): string {
    if (!str) return '';
    let result = str.toLowerCase().replace(/(?:^|[\s,.\-(/])\S/g, function(a) { return a.toUpperCase(); });
    
    const lowerWords = ['Khu Phố', 'Xã', 'Phường', 'Tỉnh', 'Thành Phố', 'Thị Xã', 'Thị Trấn', 'Quận', 'Huyện', 'Ấp', 'Khóm', 'Tổ'];
    
    lowerWords.forEach(word => {
        const regex = new RegExp(`(^|[\\s,.\\-(/])(${word})(?=[\\s,.\\-(/]|$)`, 'g');
        result = result.replace(regex, (match, p1, p2) => p1 + p2.toLowerCase());
    });
    
    return result;
}

// --- CONFIRM ACTION WRAPPER ---
// Sử dụng Native Dialog của Electron nếu có, ngược lại dùng window.confirm
export const confirmAction = async (message: string, title: string = 'Xác nhận'): Promise<boolean> => {
    if ((window as any).electronAPI && (window as any).electronAPI.showConfirmDialog) {
        // Chờ kết quả từ Main Process (không block renderer)
        return await (window as any).electronAPI.showConfirmDialog(message, title);
    }
    // Fallback cho trình duyệt web
    return window.confirm(message);
};

// --- ĐỊNH NGHĨA CÁC CỘT HIỂN THỊ ---
// Updated: Căn giữa tiêu đề và điều chỉnh độ rộng theo yêu cầu
// Updated: Gộp cột Đợt vào cột Hoàn thành
export const COLUMN_DEFS = [
  { key: 'code', label: 'Mã Hồ Sơ', sortKey: 'code', className: 'w-44 text-center' },
  { key: 'customer', label: 'Thông tin chủ sử dụng', sortKey: 'customerName', className: 'w-64 text-center' }, 
  { key: 'deadline', label: 'Thời hạn xử lý', sortKey: 'deadline', className: 'w-48 text-center' },
  { key: 'ward', label: 'Xã Phường', sortKey: 'ward', className: 'w-32 text-center' },
  { key: 'mapSheet', label: 'Tờ', sortKey: 'mapSheet', className: 'w-16 text-center' }, 
  { key: 'landPlot', label: 'Thửa', sortKey: 'landPlot', className: 'w-16 text-center' }, 
  { key: 'assigned', label: 'Giao nhân viên', sortKey: 'assignedDate', className: 'w-48 text-center' },
  { key: 'completed', label: 'Hoàn thành / Đợt', sortKey: 'completedDate', className: 'w-32 text-center' },
  { key: 'type', label: 'Loại Hồ Sơ', sortKey: 'recordType', className: 'w-[5.5rem] text-center' },
  { key: 'tech', label: 'TĐ / TL', sortKey: 'measurementNumber', className: 'w-20 text-center' },
  { key: 'receipt', label: 'Biên Lai', sortKey: 'receiptNumber', className: 'w-20 text-center' },
  { key: 'status', label: 'Trạng Thái', sortKey: 'status', className: 'w-32 text-center' },
];

export const DEFAULT_VISIBLE_COLUMNS = {
    code: true, 
    customer: true, 
    deadline: true,
    ward: true, 
    mapSheet: true, 
    landPlot: true, 
    assigned: true, 
    completed: true, // Mặc định hiện cột gộp này
    type: true, 
    tech: false, 
    receipt: true, 
    status: true
};

// --- CÁC HÀM CHECK LOGIC ---
export const isRecordOverdue = (record: RecordFile): boolean => {
  // 1. Kiểm tra trạng thái "Đã xong"
  const completedStatuses = [
      RecordStatus.HANDOVER,
      RecordStatus.RETURNED,
      RecordStatus.WITHDRAWN,
      RecordStatus.SIGNED
  ];

  if (completedStatuses.includes(record.status)) return false;
  
  // 2. [QUAN TRỌNG] Kiểm tra dữ liệu thực tế (Fix lỗi trạng thái chưa cập nhật)
  // Nếu đã có ngày xuất (đã giao 1 cửa) hoặc đã có ngày trả kết quả -> Coi như đã xong -> Không quá hạn
  if (record.exportDate || record.exportBatch || record.resultReturnedDate) {
      return false;
  }
  
  if (!record.deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(record.deadline);
  deadline.setHours(0, 0, 0, 0);
  return deadline < today;
};

export const isRecordApproaching = (record: RecordFile): boolean => {
  const completedStatuses = [
      RecordStatus.HANDOVER,
      RecordStatus.RETURNED,
      RecordStatus.WITHDRAWN,
      RecordStatus.SIGNED
  ];

  if (completedStatuses.includes(record.status)) return false;
  
  // Kiểm tra dữ liệu thực tế: Nếu đã xong thì không báo sắp đến hạn
  if (record.exportDate || record.exportBatch || record.resultReturnedDate) {
      return false;
  }

  if (isRecordOverdue(record)) return false;
  
  if (!record.deadline) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(record.deadline);
  deadline.setHours(0, 0, 0, 0);
  const diffTime = deadline.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 3;
};

// Hàm chuyển đổi Âm lịch sang Dương lịch (Cố định cho các ngày lễ chính 2024-2026)
export const getSolarDateFromLunar = (lunarDay: number, lunarMonth: number, year: number): Date | null => {
    const lunarMapping: Record<number, Record<string, string>> = {
        2024: { 
            "1/1": "2024-02-10", "2/1": "2024-02-11", "3/1": "2024-02-12", // Tết
            "10/3": "2024-04-18" // Giỗ tổ
        },
        2025: { 
            "1/1": "2025-01-29", "2/1": "2025-01-30", "3/1": "2025-01-31",
            "10/3": "2025-04-07"
        },
        2026: { 
            "1/1": "2026-02-17", "2/1": "2026-02-18", "3/1": "2026-02-19", 
            "10/3": "2026-04-26"
        }
    };

    const key = `${lunarDay}/${lunarMonth}`;
    if (lunarMapping[year] && lunarMapping[year][key]) {
        return new Date(lunarMapping[year][key]);
    }
    return null;
};

// Hàm định dạng ngày chuẩn YYYY-MM-DD theo giờ địa phương (tránh lệch múi giờ)
export const formatDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Hàm tính hạn trả toàn cục (chỉ trừ ngày nghỉ lễ hệ thống và CHỦ NHẬT, THỨ BẢY VẪN LÀ NGÀY LÀM VIỆC)
export const calculateDeadlineHelper = (type: string, receivedDateStr: string, holidays: Holiday[]): string => {
    if (!receivedDateStr) return '';
    let daysToAdd = 30; 
    const lowerType = (type || '').toLowerCase();

    if (lowerType.includes('cung cấp thông tin') || lowerType.includes('sao lục') || lowerType.includes('trích lục')) {
        daysToAdd = 10; 
    } else if (lowerType.includes('trích đo chỉnh lý')) {
        daysToAdd = 15; 
    } else if (lowerType.includes('trích đo') || lowerType.includes('đo đạc') || lowerType.includes('cắm mốc')) {
        daysToAdd = 30; 
    }
    
    const startDate = new Date(receivedDateStr);
    let count = 0;
    let currentDate = new Date(startDate);
    
    // Tạo Set chứa chuỗi ngày nghỉ (YYYY-MM-DD) để tra cứu nhanh và chính xác
    const holidaySet = new Set<string>();
    const currentYear = startDate.getFullYear();
    // Check cả năm hiện tại và năm sau (trường hợp cuối năm)
    const yearsToCheck = [currentYear, currentYear + 1];

    holidays.forEach(h => {
        yearsToCheck.forEach(year => {
            if (h.isLunar) {
                const solarDate = getSolarDateFromLunar(h.day, h.month, year);
                if (solarDate) holidaySet.add(formatDateKey(solarDate));
            } else {
                const solarDate = new Date(year, h.month - 1, h.day);
                holidaySet.add(formatDateKey(solarDate));
            }
        });
    });

    while (count < daysToAdd) {
        // Tăng 1 ngày
        currentDate.setDate(currentDate.getDate() + 1);
        
        const dayOfWeek = currentDate.getDay(); // 0 là Chủ Nhật, 6 là Thứ Bảy
        const dateString = formatDateKey(currentDate);
        
        // CHỈ TRỪ CHỦ NHẬT (Không trừ Thứ 7)
        const isWeekend = dayOfWeek === 0;
        const isHoliday = holidaySet.has(dateString);

        // Nếu không phải Chủ Nhật và không phải ngày lễ thì mới tính là 1 ngày làm việc
        if (!isWeekend && !isHoliday) {
            count++;
        }
    }
    
    return formatDateKey(currentDate);
};
