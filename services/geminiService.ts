
import { GoogleGenAI } from "@google/genai";
import { RecordFile, RecordStatus } from "../types";
import { STATUS_LABELS, getNormalizedWard, getShortRecordType } from "../constants";

interface OverdueRecord {
  date: string;
  code: string;
}

const getAiClient = (): GoogleGenAI | null => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    console.warn("API Key not found in environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey: apiKey });
};

export const testApiConnection = async (): Promise<boolean> => {
  try {
    const ai = getAiClient();
    if (!ai) return false;
    await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'Ping',
    });
    return true;
  } catch (error) {
    console.error("AI Connection Test Failed:", error);
    return false;
  }
};

export const generateReport = async (
  records: RecordFile[], 
  timeLabel: string, 
  scope: 'general' | 'personal' = 'general', 
  userName?: string
): Promise<string> => {
  try {
    const ai = getAiClient();
    if (!ai) return "<div class='text-red-600 p-4 border border-red-200 bg-red-50 rounded'>Chưa cấu hình API Key trong hệ thống (process.env.API_KEY).</div>";

    const total = records.length;
    let completedCount = 0;
    let processingCount = 0;
    let overdueCount = 0;
    let pendingSignCount = 0;
    let withdrawnCount = 0;
    
    const wardStats: Record<string, any> = {};
    const typeStats: Record<string, number> = {};
    const today = new Date();
    today.setHours(0,0,0,0);

    records.forEach(r => {
        // Cập nhật: Tính cả RETURNED vào completedCount
        if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED) completedCount++;
        else if (r.status === RecordStatus.PENDING_SIGN) pendingSignCount++;
        else if (r.status === RecordStatus.WITHDRAWN) withdrawnCount++;
        else processingCount++;
        
        if (r.status !== RecordStatus.HANDOVER && r.status !== RecordStatus.RETURNED && r.status !== RecordStatus.WITHDRAWN && r.deadline) {
            if (new Date(r.deadline) < today) overdueCount++;
        }

        const typeName = getShortRecordType(r.recordType) || 'Khác';
        typeStats[typeName] = (typeStats[typeName] || 0) + 1;

        const wardName = getNormalizedWard(r.ward) || 'Khác';
        if (!wardStats[wardName]) {
            wardStats[wardName] = { total: 0, done: 0, pending: 0, overdue: 0 };
        }
        wardStats[wardName].total++;
        if (r.status === RecordStatus.HANDOVER || r.status === RecordStatus.RETURNED) wardStats[wardName].done++;
        else wardStats[wardName].pending++;
    });

    const reportData = {
        time: timeLabel,
        author: userName,
        summary: { total, done: completedCount, processing: processingCount, pendingSign: pendingSignCount, overdue: overdueCount, withdrawn: withdrawnCount },
        types: typeStats,
        wards: wardStats
    };

    const prompt = `
      Bạn là thư ký chuyên nghiệp. Hãy tạo một BÁO CÁO CÔNG VIỆC CÔ ĐỌNG nằm gọn trong 01 TRANG A4 (khổ đứng).
      
      DỮ LIỆU JSON: ${JSON.stringify(reportData)}

      YÊU CẦU TRÌNH BÀY (HTML thuần, CSS Tailwind):
      1. TIÊU ĐỀ: "BÁO CÁO KẾT QUẢ CÔNG TÁC ĐO ĐẠC" (In đậm, trung tâm).
      2. THỜI GIAN: ${timeLabel}.
      3. BẢNG TỔNG HỢP: Tạo 1 bảng nhỏ 2 cột hiển thị các chỉ số Tổng HS, Đã xong, Đang xử lý, Trễ hạn.
      4. THỐNG KÊ CHI TIẾT ĐỊA BÀN: Tạo 1 bảng HTML (Border đen mỏng 1px) các cột: STT, Địa bàn, Tổng số, Đã xong, Tỷ lệ %.
      5. NHẬN XÉT (Tối đa 3 câu): Nhận xét ngắn gọn về tiến độ. Nếu có trễ hạn thì yêu cầu đôn đốc.
      6. CHỮ KÝ: Căn phải "Người lập biểu", để trống khoảng trắng để ký.

      LƯU Ý QUAN TRỌNG: 
      - Không sử dụng các thẻ <html> <body>. 
      - Sử dụng font-serif (giả lập Times New Roman).
      - Đảm bảo toàn bộ nội dung không quá dài để tránh bị nhảy sang trang 2.
      - Sử dụng bảng (table) thay vì thẻ div cho các danh sách để trông giống văn bản hành chính.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { temperature: 0.2 } // Giảm sáng tạo để AI bám sát định dạng
    });

    return response.text || "Lỗi tạo nội dung.";
  } catch (error) {
    return "<div class='p-4 bg-red-50 text-red-700'>Lỗi kết nối AI hoặc quota đã hết.</div>";
  }
};
