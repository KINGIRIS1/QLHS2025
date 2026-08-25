import { RecordFile } from '../types';

export const RECORD_TYPE_PREFIXES: Record<string, string> = {
  'Trích đo chỉnh lý bản đồ địa chính': 'TDCL',
  'Trích đo Chuyển mục đích': 'TDCMD',
  'Trích đo bản đồ địa chính': 'TDBD',
  'Thẩm định Trích đo': 'TDTD',
  'Trích lục bản đồ địa chính': 'TLBD',
  'Đo đạc theo yêu cầu': 'DDYC',
  'Cắm mốc': 'CM',
  'Cung cấp thông tin quy hoạch': 'QH',
  'Sao lục hồ sơ': 'SL',
  'Thuê chính quy': 'TCQ',
  'Thu hồi Giấy chứng nhận': 'THGCN',
  'Hiến đất': 'HD',
};

/**
 * Lấy tiền tố viết tắt chuẩn cho 12 loại hồ sơ trong Tab Tiếp nhận
 */
export const getRecordTypePrefix = (recordType?: string): string => {
  if (!recordType) return 'DD';
  const clean = recordType.trim();
  if (RECORD_TYPE_PREFIXES[clean]) return RECORD_TYPE_PREFIXES[clean];

  const lower = clean.toLowerCase();
  if (lower.includes('chuyển mục đích') || lower.includes('chuyen muc dich') || lower.includes('tdcmd') || lower.includes('cmd')) return 'TDCMD';
  if (lower.includes('chỉnh lý') || lower.includes('chinh ly')) return 'TDCL';
  if (lower.includes('thẩm định') || lower.includes('tham dinh')) return 'TDTD';
  if (lower.includes('trích lục') || lower.includes('trich luc')) return 'TLBD';
  if (lower.includes('trích đo') || lower.includes('trich do')) return 'TDBD';
  if (lower.includes('hiến đất') || lower.includes('hien dat')) return 'HD';
  if (lower.includes('cắm mốc') || lower.includes('cam moc')) return 'CM';
  if (lower.includes('quy hoạch') || lower.includes('quy hoach') || lower.includes('thông tin') || lower.includes('thong tin')) return 'QH';
  if (lower.includes('sao lục') || lower.includes('sao luc')) return 'SL';
  if (lower.includes('thuế') || lower.includes('thue') || lower.includes('chính quy') || lower.includes('tcq')) return 'TCQ';
  if (lower.includes('thu hồi') || lower.includes('thu hoi') || lower.includes('thgcn') || lower.includes('thg')) return 'THGCN';
  if (lower.includes('đo đạc') || lower.includes('do dac') || lower.includes('ddyc')) return 'DDYC';

  return 'DD';
};

/**
 * Lấy mã viết tắt chuẩn cho 3 xã/phường: Chơn Thành (CT), Minh Hưng (MH), Nha Bích (NB)
 */
export const getWardShortCode = (ward?: string): string => {
  if (!ward) return 'CT';
  const normalized = ward.toLowerCase().trim()
    .replace(/^(xã|phường|thị trấn|tt\.|p\.|x\.)\s+/g, '')
    .replace(/\s+(xã|phường|thị trấn)\s+/g, ' ');

  if (normalized.includes('minh hưng') || normalized.includes('minhhung') || normalized === 'mh') return 'MH';
  if (normalized.includes('nha bích') || normalized.includes('nhabich') || normalized === 'nb') return 'NB';
  if (normalized.includes('chơn thành') || normalized.includes('chonthanh') || normalized.includes('hưng long') || normalized === 'ct') return 'CT';

  return 'CT';
};

/**
 * Sinh mã hồ sơ chuẩn hóa theo cấu trúc [LOẠI]-[YYMMDD]-[XXX]-[MÃ XÃ]
 * Tự động tìm số thứ tự lớn nhất trong ngày theo phân vùng (Loại hồ sơ + Ngày + Xã)
 */
export const calculateNextRecordCode = (
  wardName: string,
  dateStr: string,
  allExistingRecords: (RecordFile | { code?: string })[] = [],
  extraCodes: string[] = [],
  recordType?: string
): string => {
  if (!wardName || !dateStr) return '';

  const d = new Date(dateStr);
  const yy = isNaN(d.getTime()) ? new Date().getFullYear().toString().slice(-2) : d.getFullYear().toString().slice(-2);
  const mm = isNaN(d.getTime()) ? ('0' + (new Date().getMonth() + 1)).slice(-2) : ('0' + (d.getMonth() + 1)).slice(-2);
  const dd = isNaN(d.getTime()) ? ('0' + d.getDate()).slice(-2) : ('0' + d.getDate()).slice(-2);
  const datePrefix = `${yy}${mm}${dd}`;

  const suffix = getWardShortCode(wardName);
  const typePrefix = getRecordTypePrefix(recordType);

  let maxSeq = 0;

  const inspectCode = (rawCode?: string | null) => {
    if (!rawCode) return;
    const clean = rawCode.trim().toUpperCase();
    const parts = clean.split('-');

    // Định dạng 4 phần: PREFIX-YYMMDD-XXX-WARD (Ví dụ: TDCL-260825-001-CT)
    if (parts.length === 4) {
      const [rPrefix, rDate, rSeq, rWard] = parts;
      const isPrefixMatch = rPrefix === typePrefix || 
        (typePrefix === 'SL' && rPrefix === 'SLHS') ||
        (typePrefix === 'THGCN' && rPrefix === 'THG');

      if (isPrefixMatch && rDate === datePrefix && rWard === suffix) {
        const num = parseInt(rSeq, 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
    // Định dạng cũ 3 phần: YYMMDD-XXX-WARD (Ví dụ: 260825-001-CT)
    else if (parts.length === 3) {
      const [rDate, rSeq, rWard] = parts;
      if (rDate === datePrefix && rWard === suffix) {
        const num = parseInt(rSeq, 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    }
  };

  allExistingRecords.forEach(r => inspectCode(r.code));
  extraCodes.forEach(c => inspectCode(c));

  const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
  return `${typePrefix}-${datePrefix}-${nextSeq}-${suffix}`;
};

/**
 * Kiểm tra và tự động giải quyết xung đột mã khi lưu (Atomic Resolver)
 */
export const resolveUniqueRecordCode = (
  desiredCode: string,
  ward: string,
  receivedDate: string,
  recordType: string,
  existingRecords: (RecordFile | { code?: string })[]
): string => {
  const existingSet = new Set(
    existingRecords
      .map(r => (r.code || '').trim().toUpperCase())
      .filter(Boolean)
  );

  const candidate = (desiredCode || '').trim().toUpperCase();
  if (candidate && !existingSet.has(candidate)) {
    return desiredCode;
  }

  // Nếu mã đã bị trùng, sinh ngay mã kế tiếp khả dụng
  return calculateNextRecordCode(ward, receivedDate, existingRecords, [], recordType);
};
