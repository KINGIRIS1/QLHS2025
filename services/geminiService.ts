
import { GoogleGenAI } from "@google/genai";
import { RecordFile, RecordStatus } from "../types";
import { STATUS_LABELS, getNormalizedWard, getShortRecordType } from "../constants";

// Key lưu trong LocalStorage
export const LS_API_KEY = 'GEMINI_API_KEY_CUSTOM';

// Định nghĩa kiểu dữ liệu nội bộ
interface OverdueRecord {
  date: string;
  code: string;
}

// Helper function để lấy client AI khi cần
// Ưu tiên lấy từ LocalStorage (người dùng cài đặt), sau đó mới đến biến môi trường
const getAiClient = (): GoogleGenAI | null => {
  let apiKey = '';
  
  // 1. Thử lấy từ cài đặt người dùng
  try {
    const customKey = localStorage.getItem(LS_API_KEY);
    if (customKey) apiKey = customKey;
  } catch (e) {
    console.warn("Không thể đọc LocalStorage");
  }

  // 2. Nếu không có, lấy từ biến môi trường (Mặc định)
  if (!apiKey && typeof process !== 'undefined' && process.env.API_KEY) {
    apiKey = process.env.API_KEY;
  }
  
  if (!apiKey) {
    console.warn("Gemini API Key is missing.");
    return null;
  }
  
  return new GoogleGenAI({ apiKey: apiKey });
};

export const testApiConnection = async (): Promise<boolean> => {
  try {
    const ai = getAiClient();
    if (!ai) return false;

    // Sử dụng model nhẹ để test kết nối nhanh
    const model = 'gemini-2.5-flash';
    await ai.models.generateContent({
      model: model,
      contents: 'Ping',
    });
    return true;
  } catch (error) {
    console.error("Lỗi kết nối Gemini API:", error);
    return false;
  }
};

export const generateReport = async (
  records: RecordFile[], 
  timeLabel: string, // Ví dụ: "Từ 01/01 đến 05/01"
  scope: 'general' | 'personal' = 'general', // general: Toàn hệ thống, personal: Cá nhân
  userName?: string
): Promise<string> => {
  try {
    const ai = getAiClient();
    if (!ai) return "<div class='text-red-600 p-4 border border-red-200 bg-red-50 rounded'>Chưa cấu hình API Key. Vui lòng vào Cấu hình hệ thống -> Gemini AI để nhập Key.</div>";

    const model = 'gemini-2.5-flash';
    
    // --- 1. TÍNH TOÁN SỐ LIỆU THỐNG KÊ (PRE-CALCULATION) ---
    // Tính toán trước để AI chỉ việc văn phong hóa, tránh sai sót số liệu
    const total = records.length;
    let completedCount = 0;
    let processingCount = 0;
    let overdueCount = 0;
    let pendingSignCount = 0;
    
    // Khai báo biến với kiểu union rõ ràng hoặc null
    let nearestOverdue: OverdueRecord | null = null;
    
    // Thống kê chi tiết theo phường: Tổng, Xong, Đang xử lý, Chờ ký, Trễ hạn, VÀ CHI TIẾT LOẠI HỒ SƠ
    const wardStats: Record<string, { 
        total: number, 
        completed: number, 
        processing: number, 
        pendingSign: number, 
        overdue: number,
        types: Record<string, number> // Thống kê loại hồ sơ trong phường này
    }> = {};
    
    // Thống kê theo loại hồ sơ (Toàn cục)
    const typeStats: Record<string, number> = {};

    const today = new Date();
    today.setHours(0,0,0,0);

    records.forEach(r => {
        // 1. Thống kê Tổng quan
        if (r.status === RecordStatus.HANDOVER) completedCount++;
        else if (r.status === RecordStatus.PENDING_SIGN) pendingSignCount++;
        else processingCount++;
        
        // 2. Kiểm tra quá hạn (Chỉ tính nếu chưa hoàn thành)
        let isItemOverdue = false;
        if (r.status !== RecordStatus.HANDOVER && r.deadline) {
            const d = new Date(r.deadline);
            d.setHours(0,0,0,0);
            if (d < today) {
                overdueCount++;
                isItemOverdue = true;
                
                // Tìm ngày trễ gần nhất (xa nhất trong quá khứ)
                // Ép kiểu (as any) khi truy cập thuộc tính trong điều kiện so sánh để tránh lỗi TS
                if (!nearestOverdue || d < new Date((nearestOverdue as any).date)) {
                    nearestOverdue = { date: r.deadline, code: r.code };
                }
            }
        }

        // 3. Thống kê theo Loại hồ sơ (Toàn cục)
        const typeName = getShortRecordType(r.recordType) || 'Khác';
        if (!typeStats[typeName]) typeStats[typeName] = 0;
        typeStats[typeName]++;

        // 4. Thống kê Chi tiết theo Phường
        const wardName = getNormalizedWard(r.ward) || 'Khác';
        if (!wardStats[wardName]) {
            wardStats[wardName] = { 
                total: 0, 
                completed: 0, 
                processing: 0, 
                pendingSign: 0, 
                overdue: 0,
                types: {} // Init object types cho phường này
            };
        }
        
        const ws = wardStats[wardName];
        ws.total++;
        
        if (r.status === RecordStatus.HANDOVER) ws.completed++;
        else if (r.status === RecordStatus.PENDING_SIGN) ws.pendingSign++;
        else ws.processing++;

        if (isItemOverdue) {
            ws.overdue++;
        }

        // Đếm loại hồ sơ trong phường này
        if (!ws.types[typeName]) ws.types[typeName] = 0;
        ws.types[typeName]++;
    });

    // Chuẩn bị dữ liệu tinh gọn để gửi cho AI
    const reportData = {
        thoi_gian: timeLabel,
        nguoi_bao_cao: userName || 'Hệ thống',
        tong_so_ho_so: total,
        tinh_hinh_xu_ly_chung: {
            da_hoan_thanh: completedCount,
            dang_xu_ly: processingCount,
            cho_ky: pendingSignCount,
            tre_han: overdueCount
        },
        phan_loai_ho_so_toan_cuc: typeStats,
        canh_bao_tre_han: {
            so_luong: overdueCount,
            // FIX LỖI TS2339: Sử dụng ép kiểu (as any) để đảm bảo không lỗi biên dịch
            ho_so_lau_nhat: nearestOverdue ? `Ngày ${(nearestOverdue as any).date} (Mã: ${(nearestOverdue as any).code})` : "Không có"
        },
        chi_tiet_tung_phuong: wardStats
    };

    // --- 2. TẠO PROMPT (SYSTEM INSTRUCTION) ---
    const prompt = `
      Bạn là một chuyên gia thiết kế báo cáo và phân tích dữ liệu. Nhiệm vụ của bạn là tạo một báo cáo HTML đẹp mắt, chuyên nghiệp dựa trên dữ liệu JSON được cung cấp.

      YÊU CẦU ĐỊNH DẠNG (QUAN TRỌNG):
      - Trả về mã **HTML** thuần túy (không bọc trong thẻ markdown \`\`\`html).
      - Sử dụng **Tailwind CSS classes** (hoặc inline style) để trang trí.
      - Giao diện: Sạch sẽ, hiện đại, dễ đọc (Clean & Modern UI).

      CẤU TRÚC BÁO CÁO:

      1. **TIÊU ĐỀ**:
         - Tiêu đề lớn: "BÁO CÁO TÌNH HÌNH HỒ SƠ" (Màu xanh đậm, căn giữa).
         - Thời gian: ${timeLabel} (Chữ nhỏ, màu xám, căn giữa).
         - Người báo cáo: ${userName} (In nghiêng).

      2. **THẺ TỔNG QUAN (Dạng Dashboard Cards)**:
         - Tạo 4 thẻ (Cards) nằm ngang hàng (dùng Flexbox hoặc Grid) hiển thị các con số quan trọng:
           - Tổng hồ sơ (Màu xanh dương)
           - Đã hoàn thành (Màu xanh lá)
           - Đang xử lý (Màu vàng)
           - Trễ hạn (Màu đỏ - Nếu > 0 thì tô đậm cảnh báo).

      3. **PHÂN LOẠI HỒ SƠ TOÀN CỤC (Dạng Bảng)**:
         - **YÊU CẦU BẮT BUỘC:** Hiển thị dưới dạng **Bảng (Table)** có kẻ khung (border) rõ ràng.
         - Sử dụng thẻ \`<thead>\` chứa các thẻ \`<th>\` cho dòng tiêu đề.
         - **Nội dung Header**: "Loại Hồ Sơ", "Số Lượng", "Tỷ Lệ %".
         - Style Header: Nền màu xám đậm (#374151), chữ trắng (text-white), in đậm.
         - Các dòng dữ liệu (\`<tr>\`) phải có border-bottom để dễ nhìn.

      4. **CHI TIẾT THEO ĐỊA BÀN (BẢNG DỮ LIỆU CHÍNH)**:
         - Tạo một **HTML Table** thật đẹp và chi tiết.
         - **QUAN TRỌNG: BẮT BUỘC PHẢI CÓ DÒNG TIÊU ĐỀ (Header Row) RÕ RÀNG.**
         - Sử dụng thẻ \`<thead>\` chứa các thẻ \`<th>\` cho dòng tiêu đề.
         - **Nội dung Header**: "Địa bàn", "Tổng HS", "Đã Xong", "Đang Xử Lý", "Trễ Hạn", "Chi Tiết Loại".
         - Style Header: Nền màu xanh dương đậm (#1e40af), chữ trắng (text-white), in đậm (font-bold), padding lớn.
         - Rows: Nền trắng, xen kẽ màu (zebra striping). Border bao quanh các ô (\`border border-gray-300\`).
         - Cột "Trễ Hạn": Nếu số lượng > 0, hãy tô màu đỏ đậm số liệu đó để cảnh báo.
         - Cột "Chi Tiết Loại": Liệt kê ngắn gọn các loại (VD: Trích lục: 2, Tách thửa: 1...).

      5. **NHẬN XÉT**:
         - Viết một đoạn văn ngắn đánh giá tình hình. Nếu tỷ lệ trễ hạn cao (> 10%), hãy đưa ra cảnh báo gắt gao. Nếu tốt, hãy khen ngợi.

      DỮ LIỆU ĐẦU VÀO (JSON):
      ${JSON.stringify(reportData)}
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "<p class='text-red-500'>Không thể tạo báo cáo.</p>";
  } catch (error) {
    console.error("Lỗi khi gọi Gemini API:", error);
    return "<div class='p-4 bg-red-100 text-red-700 border border-red-300 rounded'>Đã xảy ra lỗi khi kết nối với AI. Vui lòng kiểm tra API Key.</div>";
  }
};
