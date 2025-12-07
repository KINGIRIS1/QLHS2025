
import { GoogleGenAI } from "@google/genai";
import { RecordFile, RecordStatus } from "../types";
import { STATUS_LABELS } from "../constants";

// Key lưu trong LocalStorage
export const LS_API_KEY = 'GEMINI_API_KEY_CUSTOM';

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
  timeLabel: string, // Ví dụ: "Tuần 42", "Tháng 10/2023", "Năm 2023", "Từ 01/01 đến 05/01"
  scope: 'general' | 'personal' = 'general', // general: Toàn hệ thống, personal: Cá nhân
  userName?: string
): Promise<string> => {
  try {
    const ai = getAiClient();
    if (!ai) return "Chưa cấu hình API Key. Vui lòng vào Cấu hình hệ thống -> Gemini AI để nhập Key.";

    const model = 'gemini-2.5-flash';
    
    // Chuẩn bị dữ liệu tóm tắt để gửi cho AI
    const summaryData = records.map(r => ({
      code: r.code,
      customer: r.customerName,
      status: STATUS_LABELS[r.status],
      deadline: r.deadline,
      assignedTo: r.assignedTo,
      receivedDate: r.receivedDate,
      isOverdue: new Date(r.deadline) < new Date() && r.status !== RecordStatus.HANDOVER
    }));

    const scopeContext = scope === 'personal' 
      ? `Đây là báo cáo hiệu suất cá nhân của nhân viên ${userName || ''}.` 
      : 'Đây là báo cáo tổng hợp toàn bộ hệ thống của đơn vị.';

    const prompt = `
      Bạn là một trợ lý hành chính ảo chuyên nghiệp. Hãy viết một báo cáo hành chính dựa trên dữ liệu JSON các hồ sơ dưới đây.
      
      Thời gian báo cáo: ${timeLabel}
      Ngữ cảnh: ${scopeContext}

      Yêu cầu báo cáo:
      1. Tiêu đề báo cáo phải rõ ràng, bao gồm thời gian (${timeLabel}).
      2. Viết bằng Tiếng Việt, văn phong trang trọng, hành chính.
      3. Tóm tắt tổng số lượng hồ sơ trong giai đoạn này.
      4. Phân tích chi tiết tiến độ: Số lượng đã hoàn thành, đang xử lý, và danh sách các hồ sơ trễ hạn (nếu có).
      5. So sánh sơ bộ hiệu suất (nếu có dữ liệu đa dạng).
      6. ${scope === 'personal' ? 'Đưa ra nhận xét về hiệu suất làm việc và nhắc nhở công việc.' : 'Nêu bật các vấn đề chung và kiến nghị quản lý.'}
      7. Định dạng Markdown đẹp mắt, sử dụng bullet points, bảng biểu nhỏ nếu cần thiết.

      Dữ liệu hồ sơ trong giai đoạn này:
      ${JSON.stringify(summaryData)}
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "Không thể tạo báo cáo lúc này.";
  } catch (error) {
    console.error("Lỗi khi gọi Gemini API:", error);
    return "Đã xảy ra lỗi khi kết nối với AI để tạo báo cáo. Vui lòng kiểm tra lại API Key hoặc thử lại sau.";
  }
};
