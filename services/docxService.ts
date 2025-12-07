
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';

// Khóa lưu trữ trong LocalStorage
export const STORAGE_KEYS = {
    RECEIPT_TEMPLATE: 'docx_template_receipt',
    CONTRACT_TEMPLATE: 'docx_template_contract'
};

// Hàm chuyển File -> Base64 để lưu vào LocalStorage
export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

// Hàm chuyển Base64 -> ArrayBuffer để thư viện xử lý
const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64.split(',')[1]);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

// Hàm lưu template
export const saveTemplate = async (key: string, file: File) => {
    try {
        const base64 = await fileToBase64(file);
        
        // Kiểm tra dung lượng (Base64 lớn hơn binary ~33%)
        if (base64.length > 5 * 1024 * 1024) {
             alert("File mẫu quá lớn (>3MB). Trình duyệt không thể lưu trữ. Vui lòng nén nhỏ file (xóa ảnh thừa) rồi thử lại.");
             return false;
        }

        localStorage.setItem(key, base64);
        return true;
    } catch (e: any) {
        console.error("Lỗi lưu template:", e);
        if (e.name === 'QuotaExceededError' || e.code === 22) {
             alert("Bộ nhớ trình duyệt đã đầy! Vui lòng xóa bớt các mẫu cũ không dùng đến.");
        }
        return false;
    }
};

// Hàm kiểm tra template có tồn tại không
export const hasTemplate = (key: string): boolean => {
    return !!localStorage.getItem(key);
};

// Hàm xóa template
export const removeTemplate = (key: string) => {
    localStorage.removeItem(key);
};

// Helper function để render Docxtemplater
const createDoc = (templateKey: string, data: any) => {
    const base64Template = localStorage.getItem(templateKey);
    if (!base64Template) {
        throw new Error("Chưa có file mẫu nào được tải lên.");
    }

    const content = base64ToArrayBuffer(base64Template);
    const zip = new PizZip(content);
    
    // Cấu hình delimiters {{ và }}
    // Thêm nullGetter để xử lý trường hợp thiếu dữ liệu -> trả về chuỗi rỗng thay vì lỗi
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: { start: '{{', end: '}}' },
        // QUAN TRỌNG: nullGetter giúp thay thế undefined/null thành chuỗi rỗng
        // Ngăn chặn lỗi khi biến chưa được truyền vào
        nullGetter: (part) => {
            if (!part.module) return "";
            if (part.module === "rawxml") return "";
            return "";
        }
    });

    // Render dữ liệu
    doc.render(data);
    return doc;
};

// Hàm cũ: Tạo và tải xuống ngay
export const generateDocx = (templateKey: string, data: any, outputName: string) => {
    try {
        const doc = createDoc(templateKey, data);
        const out = doc.getZip().generate({
            type: 'blob',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        saveAs(out, outputName.endsWith('.docx') ? outputName : `${outputName}.docx`);
    } catch (error: any) {
        handleDocxError(error);
    }
};

// Hàm mới: Tạo Blob để xem trước
export const generateDocxBlob = (templateKey: string, data: any): Blob | null => {
    try {
        const doc = createDoc(templateKey, data);
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

const handleDocxError = (error: any) => {
    console.error("Lỗi tạo file Word:", error);
    if (error.properties && error.properties.errors instanceof Array) {
        const errorMessages = error.properties.errors.map((e: any) => e.message).join("\n");
        alert(`Lỗi khi điền dữ liệu vào mẫu Word (Template Error):\n${errorMessages}\n\nHãy kiểm tra lại file mẫu xem có từ khóa nào bị sai cú pháp không.\n\nMẹo: Copy từ khóa ra Notepad rồi paste lại vào Word.`);
    } else {
        alert("Có lỗi xảy ra khi tạo file Word: " + error.message);
    }
};
