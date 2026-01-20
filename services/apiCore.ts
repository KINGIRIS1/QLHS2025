
import { supabase, isConfigured } from './supabaseClient';
import { Contract, PriceItem, Employee } from '../types';
import { API_BASE_URL } from '../constants'; 

// --- CACHE KEYS ---
export const CACHE_KEYS = {
    RECORDS: 'offline_records',
    EMPLOYEES: 'offline_employees',
    USERS: 'offline_users',
    CONTRACTS: 'offline_contracts',
    EXCERPT_HISTORY: 'offline_excerpt_history',
    EXCERPT_COUNTERS: 'offline_excerpt_counters',
    PRICE_LIST: 'offline_price_list',
    HOLIDAYS: 'offline_holidays',
    SYSTEM_CONFIG: 'offline_system_config'
};

// --- HELPERS ---
export const saveToCache = (key: string, data: any) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn('LocalStorage full or error:', e);
    }
};

export const getFromCache = <T>(key: string, fallback: T): T => {
    try {
        const cached = localStorage.getItem(key);
        if (cached) {
            console.log(`[Offline Mode] Loaded data from cache: ${key}`);
            return JSON.parse(cached);
        }
    } catch (e) {
        console.warn('Error reading cache:', e);
    }
    return fallback;
};

// Hàm chuẩn hóa chuỗi để so sánh mã (Code) chính xác hơn
export const normalizeCode = (code: any): string => {
    if (!code) return '';
    let str = String(code).trim().toLowerCase();
    // Loại bỏ các ký tự ẩn không in được (zero width space...)
    // eslint-disable-next-line no-control-regex
    str = str.replace(/[\u200B-\u200D\uFEFF]/g, '');
    // Loại bỏ toàn bộ khoảng trắng để so sánh tuyệt đối (Ví dụ: "HS - 001" sẽ bằng "hs-001")
    str = str.replace(/\s+/g, '');
    return str;
};

export const logError = (context: string, error: any) => {
    // 1. Log Raw Error object để debug trong Console
    // console.error(`[Raw Error] ${context}:`, error);

    let msg = 'Lỗi không xác định';
    let code = '';
    let details = '';

    if (error instanceof Error) {
        msg = error.message;
    }
    else if (typeof error === 'object' && error !== null) {
        // Cố gắng lấy message từ các cấu trúc lỗi phổ biến
        msg = error.message || error.error_description || error.msg || (error.error ? error.error.message : '');
        code = error.code || error.status || '';
        details = error.details || error.hint || '';
        
        // Nếu vẫn không có message, stringify toàn bộ object
        if (!msg) {
            try {
                msg = JSON.stringify(error);
            } catch (e) {
                msg = '[Circular or Unserializable Object]';
            }
        }
    } 
    else if (typeof error === 'string') {
        msg = error;
    }

    if (typeof msg === 'string' && (msg.includes('<!DOCTYPE html>') || msg.includes('500 Internal Server Error') || msg.includes('<html>'))) {
         console.warn(`⚠️ [Server Error] ${context}: Máy chủ Cloud đang tạm dừng hoặc gặp sự cố (Lỗi 500). Hệ thống sẽ sử dụng dữ liệu Cache/Offline.`);
         return; 
    }

    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('configuration') || msg.includes('Load failed')) {
        console.warn(`⚠️ [Offline Mode] ${context}: Không thể kết nối Cloud. Sử dụng dữ liệu Cache/Offline.`);
    } else if (code === '42P01') {
        console.error(`❌ Lỗi tại ${context}: Bảng dữ liệu chưa tồn tại trên Supabase! (Code: 42P01)`);
    } else if (code === '22P02') {
         console.error(`❌ Lỗi tại ${context}: Sai định dạng dữ liệu (Lỗi 22P02). Kiểm tra các trường Số hoặc Ngày tháng.`);
         alert(`LỖI DỮ LIỆU: Có trường dữ liệu không đúng định dạng (Ví dụ: Diện tích phải là số).\nHệ thống đã cố gắng tự sửa nhưng vẫn thất bại.`);
    } else if (code === 'PGRST204') {
         console.error(`❌ Lỗi tại ${context}: Cột không tồn tại (Lỗi PGRST204).`);
         // Cập nhật thông báo lỗi hướng dẫn cụ thể SQL
         alert(`LỖI CẤU TRÚC DATABASE (Thiếu cột):\nDatabase trên Cloud đang thiếu các cột mới (Thanh lý hợp đồng).\n\nVui lòng vào SQL Editor trên Supabase và chạy lệnh sau:\n\nALTER TABLE contracts ADD COLUMN liquidation_area numeric;\nALTER TABLE contracts ADD COLUMN liquidation_amount numeric;`);
    } else if (code === '406') {
         console.warn(`⚠️ [Info] ${context}: Không tìm thấy dữ liệu (406).`);
    } else if (code === '22007' || code === '22008') {
         console.error(`❌ Lỗi tại ${context}: Dữ liệu ngày tháng không hợp lệ (Lỗi ${code}).`);
         alert(`LỖI DỮ LIỆU: Dữ liệu chứa ngày tháng không hợp lệ hoặc sai định dạng (Ví dụ: 30/02).\nHệ thống đã cố gắng xử lý nhưng Server từ chối.`);
    } else if (code === '21000') {
         console.error(`❌ Lỗi tại ${context}: Dữ liệu trùng lặp trong cùng một yêu cầu (Lỗi ${code}).`);
         alert(`LỖI TRÙNG LẶP: File Excel có chứa nhiều dòng cùng Mã Hồ Sơ. Hệ thống đã cố gắng xử lý nhưng Server từ chối.\nVui lòng kiểm tra file Excel và xóa các dòng trùng lặp mã.`);
    } else {
        console.error(`❌ [Chi tiết] ${context}: ${msg} ${code ? `(Code: ${code})` : ''} ${details ? `Details: ${details}` : ''}`);
    }
};

export function sanitizeFileName(fileName: string): string {
    let str = fileName.toLowerCase();
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/[^a-z0-9\.\-\_]/g, '_');
    if (str.length > 50) {
        const ext = str.split('.').pop();
        str = str.substring(0, 40) + '.' + ext;
    }
    return str;
}

export const sanitizeData = (data: any, allowedColumns: string[]) => {
    const clean: any = { ...data };
    const numberFields = [
        'area', 'exportBatch', 'unitPrice', 'vatRate', 'vatAmount', 'totalAmount', 
        'deposit', 'quantity', 'excerptNumber', 'plotCount', 'markerCount', 
        'minArea', 'maxArea', 'price',
        'liquidationArea', 'liquidationAmount' // MỚI
    ];
    numberFields.forEach(field => {
        if (clean[field] === '' || clean[field] === undefined || (typeof clean[field] === 'number' && isNaN(clean[field]))) {
            clean[field] = null;
        }
    });
    
    // CẬP NHẬT: Thêm đầy đủ các trường ngày tháng để tránh lỗi 22007
    const dateFields = [
        'receivedDate', 'deadline', 'assignedDate', 
        'submissionDate', 'approvalDate', 'completedDate', 
        'createdDate', 'exportDate',
        'resultReturnedDate', 'reminderDate', 'lastRemindedAt'
    ];
    
    dateFields.forEach(field => {
        // Chuyển chuỗi rỗng, undefined, hoặc chuỗi không hợp lệ thành NULL
        if (clean[field] === '' || clean[field] === undefined || clean[field] === null) {
            clean[field] = null;
        }
    });
    
    const sanitized: any = {};
    allowedColumns.forEach(col => {
        if (clean.hasOwnProperty(col)) {
            sanitized[col] = clean[col];
        }
    });
    return sanitized;
};

// --- MAPPERS ---
export const mapContractToDb = (c: Contract) => ({
    id: c.id,
    code: c.code,
    customer_name: c.customerName,
    phone_number: c.phoneNumber,
    ward: c.ward,
    address: c.address,
    land_plot: c.landPlot,
    map_sheet: c.mapSheet,
    area: c.area,
    contract_type: c.contractType,
    service_type: c.serviceType,
    area_type: c.areaType,
    plot_count: c.plotCount,
    marker_count: c.markerCount,
    split_items: c.splitItems,
    quantity: c.quantity,
    unit_price: c.unitPrice,
    vat_rate: c.vatRate,
    vat_amount: c.vatAmount,
    total_amount: c.totalAmount,
    deposit: c.deposit,
    content: c.content,
    created_date: c.createdDate,
    status: c.status,
    liquidation_area: c.liquidationArea,
    liquidation_amount: c.liquidationAmount
});

export const mapContractFromDb = (c: any): Contract => ({
    id: c.id,
    code: c.code,
    customerName: c.customer_name || c.customerName, 
    phoneNumber: c.phone_number || c.phoneNumber,
    ward: c.ward,
    address: c.address,
    landPlot: c.land_plot || c.landPlot,
    mapSheet: c.map_sheet || c.mapSheet,
    area: c.area,
    contractType: c.contract_type || c.contractType,
    serviceType: c.service_type || c.serviceType,
    areaType: c.area_type || c.areaType,
    plotCount: c.plot_count || c.plotCount,
    markerCount: c.marker_count || c.markerCount,
    splitItems: c.split_items || c.splitItems,
    quantity: c.quantity,
    unitPrice: c.unit_price || c.unitPrice,
    vatRate: c.vat_rate || c.vatRate,
    vatAmount: c.vat_amount || c.vatAmount,
    totalAmount: c.total_amount || c.totalAmount,
    deposit: c.deposit,
    content: c.content,
    createdDate: c.created_date || c.createdDate,
    status: c.status,
    liquidationArea: c.liquidation_area || c.liquidationArea,
    liquidationAmount: c.liquidation_amount || c.liquidationAmount
});

export const mapEmployeeToDb = (e: Employee) => ({
    id: e.id,
    name: e.name,
    department: e.department,
    position: e.position,
    managed_wards: e.managedWards // Map camel to snake case for DB
});

export const mapEmployeeFromDb = (e: any): Employee => ({
    id: e.id,
    name: e.name,
    department: e.department,
    position: e.position,
    managedWards: e.managed_wards || e.managedWards || []
});

export const mapPriceFromDb = (item: any): PriceItem => ({
    id: item.id,
    serviceGroup: item.service_group || item.serviceGroup,
    areaType: item.area_type || item.areaType,
    serviceName: item.service_name || item.serviceName,
    minArea: item.min_area !== undefined ? item.min_area : item.minArea,
    maxArea: item.max_area !== undefined ? item.max_area : item.maxArea,
    unit: item.unit,
    price: item.price,
    vatRate: item.vat_rate !== undefined ? item.vat_rate : item.vatRate,
    vatIsPercent: item.vat_is_percent !== undefined ? item.vat_is_percent : item.vatIsPercent
});

export const mapPriceToDb = (item: PriceItem) => ({
    id: item.id,
    service_group: item.serviceGroup,
    area_type: item.areaType,
    service_name: item.serviceName,
    min_area: item.minArea,
    max_area: item.maxArea,
    unit: item.unit,
    price: item.price,
    vat_rate: item.vatRate,
    vat_is_percent: item.vatIsPercent
});
