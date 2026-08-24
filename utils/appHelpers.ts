
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

// Hàm tính hạn trả toàn cục (trừ ngày nghỉ lễ hệ thống, Thứ Bảy và Chủ Nhật)
export const calculateDeadlineHelper = (type: string, receivedDateStr: string, holidays: Holiday[]): string => {
    if (!receivedDateStr) return '';
    let daysToAdd = 30; 
    const lowerType = (type || '').toLowerCase();

    if (lowerType.includes('hiến đất') || lowerType.includes('hien dat')) {
        daysToAdd = 8;
    } else if (lowerType.includes('xin số thửa')) {
        daysToAdd = 5;
    } else if (lowerType.includes('thuế chính quy')) {
        daysToAdd = 15;
    } else if (lowerType.includes('cung cấp thông tin') || lowerType.includes('sao lục') || lowerType.includes('trích lục')) {
        daysToAdd = 10; 
    } else if (lowerType.includes('trích đo chỉnh lý')) {
        daysToAdd = 15; 
    } else if (lowerType.includes('thẩm định') || lowerType.includes('trích đo') || lowerType.includes('đo đạc') || lowerType.includes('cắm mốc') || lowerType.includes('thu hồi giấy chứng nhận')) {
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
        
        // Trừ Thứ Bảy (6) và Chủ Nhật (0)
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = holidaySet.has(dateString);

        // Nếu không phải Thứ Bảy, Chủ Nhật và không phải ngày lễ thì mới tính là 1 ngày làm việc
        if (!isWeekend && !isHoliday) {
            count++;
        }
    }
    
    return formatDateKey(currentDate);
};

// --- HÀM TOAST NOTIFICATION TOÀN CỤC ---
export function showToast(message: string, type: 'success' | 'error' = 'success') {
    window.dispatchEvent(new CustomEvent('app_toast', {
        detail: { type, message }
    }));
}

// --- HÀM TRÍCH XUẤT SUFFIX VÀ PHƯỜNG TIẾP NHẬN HỒ SƠ ---
export function getRecordSuffix(code: string): string {
    if (!code) return '';
    const clean = code.trim().toUpperCase();
    const parts = clean.split('-');
    if (parts.length > 0) {
        return parts[parts.length - 1];
    }
    return '';
}

export function getReceivingWardBySuffix(suffix: string, defaultWard: string = ''): string {
    const s = (suffix || '').trim().toUpperCase();
    if (s === 'MH') return 'Minh Hưng';
    if (s === 'CT') return 'Chơn Thành';
    if (s === 'NB') return 'Nha Bích';
    if (s === 'ML') return 'Minh Lập';
    if (s === 'MT') return 'Minh Thắng';
    if (s === 'QM') return 'Quang Minh';
    if (s === 'TT') return 'Thành Tâm';
    if (s === 'MLO') return 'Minh Long';
    return defaultWard;
}

export function getReceivingWard(record: RecordFile): string {
    if (!record) return '';
    if (record.receivingWard) return record.receivingWard;
    if (!record.code) return record?.ward || '';
    const suffix = getRecordSuffix(record.code);
    return getReceivingWardBySuffix(suffix, record.ward || '');
}

// --- HÀM XÁC ĐỊNH MÃ VIẾT TẮT ĐỊA BÀN VÀ SINH MÃ HỒ SƠ TỰ ĐỘNG ---
export function getWardShortCode(ward: string): string {
    if (!ward) return 'CT';
    const normalized = ward.toLowerCase().trim();
    const cleanName = normalized
        .replace(/^(xã|phường|thị trấn|tt\.|p\.|x\.)\s+/g, '')
        .replace(/\s+(xã|phường|thị trấn)\s+/g, ' ');

    if (cleanName.includes('minh hưng') || cleanName.includes('minhhung')) return 'MH';
    if (cleanName.includes('chơn thành') || cleanName.includes('chonthanh') || cleanName.includes('hưng long')) return 'CT';
    if (cleanName.includes('nha bích') || cleanName.includes('nhabich')) return 'NB';
    if (cleanName.includes('minh lập') || cleanName.includes('minhlap')) return 'ML';
    if (cleanName.includes('minh thắng') || cleanName.includes('minhthang')) return 'MT';
    if (cleanName.includes('quang minh') || cleanName.includes('quangminh')) return 'QM';
    if (cleanName.includes('thành tâm') || cleanName.includes('thanhtam')) return 'TT';
    if (cleanName.includes('minh long') || cleanName.includes('minhlong')) return 'MLO';
    
    return 'CT';
}

export function generateNextRecordCode(
    wardName: string, 
    dateStr: string, 
    allRecords: { code?: string | null }[] = [], 
    extraCodes: string[] = [], 
    recordType?: string
): string {
    if (!wardName || !dateStr) return '';

    const d = new Date(dateStr);
    const yy = d.getFullYear().toString().slice(-2);
    const mm = ('0' + (d.getMonth() + 1)).slice(-2);
    const dd = ('0' + d.getDate()).slice(-2);
    const datePrefix = `${yy}${mm}${dd}`;
    
    const suffix = getWardShortCode(wardName);
    
    let targetPrefixType = '';
    if (recordType === 'Sao lục hồ sơ' || recordType === 'Sao lục') {
        targetPrefixType = 'SLHS';
    } else if (recordType === 'Thuế chính quy') {
        targetPrefixType = 'TCQ';
    } else if (recordType === 'Thu hồi Giấy chứng nhận') {
        targetPrefixType = 'THG';
    }

    let maxSeq = 0;

    const checkAndExtractSeq = (codeStr: string | null | undefined) => {
        if (!codeStr) return;
        const cleanCode = codeStr.trim().toUpperCase();
        const parts = cleanCode.split('-');
        
        if (targetPrefixType) {
            if (parts.length === 4) {
                const [rType, rDate, rSeq, rSuffix] = parts;
                if (rType === targetPrefixType && rDate === datePrefix && rSuffix === suffix.toUpperCase()) {
                    const seqNum = parseInt(rSeq, 10);
                    if (!isNaN(seqNum) && seqNum > maxSeq) maxSeq = seqNum;
                }
            }
        } else {
            if (parts.length === 3) {
                const [rDate, rSeq, rSuffix] = parts;
                if (rDate === datePrefix && rSuffix === suffix.toUpperCase()) {
                    const seqNum = parseInt(rSeq, 10);
                    if (!isNaN(seqNum) && seqNum > maxSeq) maxSeq = seqNum;
                }
            }
        }
    };

    allRecords.forEach(r => checkAndExtractSeq(r.code));
    extraCodes.forEach(code => checkAndExtractSeq(code));

    const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
    
    if (targetPrefixType) {
        return `${targetPrefixType}-${datePrefix}-${nextSeq}-${suffix}`;
    } else {
        return `${datePrefix}-${nextSeq}-${suffix}`;
    }
}

// --- TÍNH NĂNG CẢNH BÁO HỒ SƠ CẦN CHÚ Ý ĐÃ KÝ DUYỆT ---
export function playPriorityAlertSound() {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const now = ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.12);
            gain.gain.setValueAtTime(0.3, now + i * 0.12);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * 0.12);
            osc.stop(now + i * 0.12 + 0.35);
        });
    } catch (e) {
        console.error("Audio playback error:", e);
    }
}

export function triggerPrioritySignedAlert(record: RecordFile, newStatus: RecordStatus) {
    if (Boolean(record.isPriority) && (newStatus === RecordStatus.SIGNED || newStatus === RecordStatus.HANDOVER || newStatus === RecordStatus.RETURNED)) {
        playPriorityAlertSound();
        window.dispatchEvent(new CustomEvent('priority_signed_alert', {
            detail: { record, newStatus }
        }));
    }
}

