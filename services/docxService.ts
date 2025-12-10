
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import saveAs from 'file-saver';
import { saveSystemSetting, getSystemSetting } from './api';
import { supabase } from './supabaseClient';

// Khóa lưu trữ trong LocalStorage
export const STORAGE_KEYS = {
    RECEIPT_TEMPLATE: 'docx_template_receipt',
    CONTRACT_TEMPLATE_DODAC: 'docx_template_contract_dodac', 
    CONTRACT_TEMPLATE_CAMMOC: 'docx_template_contract_cammoc', 
    // Tách riêng 2 loại thanh lý
    CONTRACT_TEMPLATE_LIQ_DODAC: 'docx_template_liquidation_dodac', 
    CONTRACT_TEMPLATE_LIQ_CAMMOC: 'docx_template_liquidation_cammoc',
    CONTRACT_TEMPLATE: 'docx_template_contract' 
};

// --- HELPERS ---

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64.split(',')[1]);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

// --- STORAGE MANAGEMENT ---

// Lưu File Upload (Base64) - CHỈ LƯU LOCALSTORAGE (Vì base64 nặng, không nên tống vào bảng settings)
export const saveTemplate = async (key: string, file: File) => {
    try {
        const base64 = await fileToBase64(file);
        if (base64.length > 5 * 1024 * 1024) {
             alert("File mẫu quá lớn (>5MB). Trình duyệt không thể lưu trữ. Vui lòng nén nhỏ file hoặc dùng Link Google Docs.");
             return false;
        }
        localStorage.setItem(key, base64);
        return true;
    } catch (e: any) {
        console.error("Lỗi lưu template:", e);
        if (e.name === 'QuotaExceededError' || e.code === 22) {
             alert("Bộ nhớ trình duyệt đã đầy! Vui lòng xóa bớt các mẫu cũ hoặc dùng Link Google Docs.");
        }
        return false;
    }
};

// Lưu URL Google Docs - LƯU CẢ LOCAL VÀ CLOUD (System Settings)
export const saveTemplateUrl = async (key: string, url: string): Promise<boolean> => {
    try {
        // Chuyển đổi link View/Edit thành link Export
        let exportUrl = url;
        const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
            exportUrl = `https://docs.google.com/document/d/${match[1]}/export?format=docx`;
        }
        
        const value = `URL_MODE:${exportUrl}`;
        
        // 1. Lưu Local
        localStorage.setItem(key, value);
        
        // 2. Lưu Cloud (Để đồng bộ cho mọi user)
        const success = await saveSystemSetting(key, value);
        if (!success) console.warn("Không thể lưu cấu hình mẫu in lên Cloud.");
        
        return true;
    } catch (e) {
        console.error("Lỗi lưu URL template:", e);
        return false;
    }
};

export const hasTemplate = (key: string): boolean => {
    return !!localStorage.getItem(key);
};

export const getTemplateSourceType = (key: string): 'FILE' | 'URL' | 'NONE' => {
    const val = localStorage.getItem(key);
    if (!val) return 'NONE';
    if (val.startsWith('URL_MODE:')) return 'URL';
    return 'FILE';
};

export const removeTemplate = (key: string) => {
    localStorage.removeItem(key);
    // Cố gắng xóa trên Cloud (nếu là URL) - nhưng để đơn giản ta chỉ xóa local 
    // hoặc set value rỗng trên cloud nếu cần thiết.
    // Tạm thời chỉ xóa local để tránh xóa nhầm của người khác nếu không phải admin.
};

// --- SYNC TEMPLATES FROM CLOUD ---
// Hàm này sẽ được gọi khi App khởi động để lấy các link Google Docs mới nhất về
export const syncTemplatesFromCloud = async () => {
    try {
        const keys = [
            STORAGE_KEYS.RECEIPT_TEMPLATE,
            STORAGE_KEYS.CONTRACT_TEMPLATE_DODAC,
            STORAGE_KEYS.CONTRACT_TEMPLATE_CAMMOC,
            STORAGE_KEYS.CONTRACT_TEMPLATE_LIQ_DODAC,  // Mới
            STORAGE_KEYS.CONTRACT_TEMPLATE_LIQ_CAMMOC  // Mới
        ];

        // Lấy tất cả settings 1 lần để tối ưu
        const { data, error } = await supabase
            .from('system_settings')
            .select('key, value')
            .in('key', keys);

        if (error) throw error;

        if (data) {
            data.forEach((setting: any) => {
                if (setting.value) {
                    // Cập nhật LocalStorage nếu Cloud có dữ liệu
                    console.log(`[Sync] Updated template ${setting.key} from Cloud.`);
                    localStorage.setItem(setting.key, setting.value);
                }
            });
        }
    } catch (e) {
        console.warn("Lỗi đồng bộ mẫu in từ Cloud:", e);
    }
};

// --- CORE GENERATION LOGIC ---

// Hàm lấy nội dung Template (File hoặc URL)
const getTemplateArrayBuffer = async (templateKey: string): Promise<ArrayBuffer> => {
    const storedValue = localStorage.getItem(templateKey);
    if (!storedValue) {
        throw new Error("Chưa có mẫu nào được cấu hình cho loại này.");
    }

    // Trường hợp 1: Dùng Link Google Docs
    if (storedValue.startsWith('URL_MODE:')) {
        const url = storedValue.replace('URL_MODE:', '');
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Không thể tải mẫu từ Google Docs (Lỗi ${response.status}). Vui lòng kiểm tra quyền chia sẻ (Share: Anyone with the link).`);
            }
            return await response.arrayBuffer();
        } catch (error: any) {
            throw new Error("Lỗi kết nối Google Docs: " + error.message);
        }
    }

    // Trường hợp 2: Dùng File Base64 lưu sẵn
    return base64ToArrayBuffer(storedValue);
};

// Hàm render Docxtemplater bất đồng bộ (Async)
const createDocAsync = async (templateKey: string, data: any) => {
    const content = await getTemplateArrayBuffer(templateKey);
    const zip = new PizZip(content);
    
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '{{', end: '}}' },
        nullGetter: (part) => {
            if (!part.module) return "";
            if (part.module === "rawxml") return "";
            return "";
        }
    });

    doc.render(data);
    return doc;
};

// API Mới: Generate Async (để hỗ trợ fetch URL)
export const generateDocxBlobAsync = async (templateKey: string, data: any): Promise<Blob | null> => {
    try {
        const doc = await createDocAsync(templateKey, data);
        const out = doc.getZip().generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        return out;
    } catch (error: any) {
        handleDocxError(error);
        return null;
    }
};

// Giữ lại hàm cũ (deprecated) nhưng redirect để tránh lỗi compile nếu còn chỗ dùng
export const generateDocxBlob = (templateKey: string, data: any): Blob | null => {
    console.warn("generateDocxBlob is deprecated. Use generateDocxBlobAsync instead.");
    return null; 
};

const handleDocxError = (error: any) => {
    console.error("Lỗi tạo file Word:", error);
    if (error.properties && error.properties.errors instanceof Array) {
        const errorMessages = error.properties.errors.map((e: any) => e.message).join("\n");
        alert(`Lỗi Template Word:\n${errorMessages}\n\nHãy kiểm tra lại file mẫu (hoặc file trên Google Docs).`);
    } else {
        alert("Lỗi tạo văn bản: " + error.message);
    }
};
