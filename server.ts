import express from 'express';
import type { Request, Response, NextFunction } from 'express';
// @ts-ignore
import jsonServer from 'json-server';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getGoogleGenAIClient = (req: Request) => {
  let apiKey = (req.headers['x-gemini-key'] as string) || '';
  if (!apiKey) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }
  }
  if (!apiKey) {
    apiKey = process.env.GEMINI_API_KEY || '';
  }
  
  if (!apiKey || apiKey.trim() === '') {
    throw new Error("Chưa cấu hình API Key cho Gemini AI. Vui lòng vào mục 'Báo cáo tuần/tháng' -> chọn 'Cấu hình AI' để nhập API Key của bạn.");
  }
  
  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

const server = jsonServer.create();
const dbFile = process.env.DB_PATH || path.join(__dirname, 'server/db.json');
const router = jsonServer.router(dbFile);
const middlewares = jsonServer.defaults();

// --- TỐI ƯU HÓA TỐC ĐỘ CẬP NHẬT ---
let releaseDir = path.join(__dirname, 'release');
if (!fs.existsSync(releaseDir)) {
    // Thử tìm ở thư mục gốc project (khi chạy dev)
    releaseDir = path.join(__dirname, 'release');
}
console.log(`Update Server path: ${releaseDir}`);
server.use('/updates', express.static(releaseDir));
// ------------------------------------

// --- TỰ ĐỘNG SAO LƯU (AUTO BACKUP) ---
try {
    if (fs.existsSync(dbFile)) {
        const backupDir = path.join(path.dirname(dbFile), 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        const now = new Date();
        const timeStr = now.toISOString().replace(/T/, '-').replace(/:/g, '-').split('.')[0];
        const backupFile = path.join(backupDir, `db-${timeStr}.json`);
        
        fs.copyFileSync(dbFile, backupFile);
        console.log(`[AN TOAN] Da tu dong sao luu du lieu tai: backups/db-${timeStr}.json`);

        const files = fs.readdirSync(backupDir);
        if (files.length > 20) {
            files.sort((a, b) => {
                return fs.statSync(path.join(backupDir, b)).mtime.getTime() - 
                       fs.statSync(path.join(backupDir, a)).mtime.getTime();
            });
            const fileToDelete = path.join(backupDir, files[files.length - 1]);
            fs.unlinkSync(fileToDelete);
            console.log(`[DON DEP] Da xoa ban sao luu cu: ${fileToDelete}`);
        }
    }
} catch (err) {
    console.error("[LOI] Khong the sao luu du lieu tu dong:", err);
}
// -------------------------------------

// Dữ liệu mặc định
const DEFAULT_DATA = {
    records: [], 
    excerpt_history: [],
    excerpt_counters: { "Chơn Thành": 0, "Minh Hưng": 0, "Nha Bích": 0 },
    employees: [],
    users: [{ username: 'admin', password: '123', name: 'Administrator', role: 'ADMIN' }]
};

if (!fs.existsSync(dbFile)) {
    console.log("Khoi tao co so du lieu ban dau...");
    const dir = path.dirname(dbFile);
    if (!fs.existsSync(dir)){ fs.mkdirSync(dir, { recursive: true }); }
    fs.writeFileSync(dbFile, JSON.stringify(DEFAULT_DATA, null, 2));
}

// Use default middlewares (logger, static, cors and no-cache)
server.use(middlewares);
server.use(jsonServer.bodyParser);

// Middleware hiển thị log (Chỉ log các request API, không log file tĩnh nữa do đã khai báo static ở trên)
server.use((req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        console.log(`${new Date().toLocaleTimeString()} - ${req.method} request received`);
    }
    next();
});

// Custom Routes
server.post('/custom/bulk', (req: Request, res: Response) => {
    const db = router.db;
    const data = req.body;
    if (Array.isArray(data)) {
        try {
            const records = db.get('records').value();
            const newRecords = records.concat(data);
            db.set('records', newRecords).write();
            res.jsonp({ success: true, count: data.length });
        } catch (error) {
            res.status(500).jsonp({ error: "Lỗi Server." });
        }
    } else {
        res.status(400).jsonp({ error: "Dữ liệu sai." });
    }
});

server.post('/custom/update-missing', (req: Request, res: Response) => {
    const db = router.db;
    const incomingData = req.body;
    if (Array.isArray(incomingData)) {
        try {
            const dbRecords = db.get('records').value();
            let updatedCount = 0;
            dbRecords.forEach((dbRecord: any) => {
                const match = incomingData.find((i: any) => i.code && dbRecord.code && i.code.toString().trim() === dbRecord.code.toString().trim());
                if (match) {
                    let changed = false;
                    Object.keys(match).forEach(key => {
                        if (key === 'id' || key === 'status') return;
                        const dbVal = dbRecord[key];
                        const matchVal = match[key];
                        const isDbEmpty = dbVal === null || dbVal === undefined || dbVal === '' || dbVal === 'Nhập từ Excel';
                        const isMatchHasData = matchVal !== null && matchVal !== undefined && matchVal !== '';
                        if (isDbEmpty && isMatchHasData) {
                            dbRecord[key] = matchVal;
                            changed = true;
                        }
                    });
                    if (changed) updatedCount++;
                }
            });
            if (updatedCount > 0) db.write();
            res.jsonp({ success: true, count: updatedCount });
        } catch (error) {
            res.status(500).jsonp({ error: "Lỗi Server." });
        }
    } else {
        res.status(400).jsonp({ error: "Dữ liệu sai." });
    }
});

server.post('/system/reset', (req: Request, res: Response) => {
    try {
        const db = router.db;
        const currentEmployees = db.get('employees').value();
        const currentUsers = db.get('users').value();
        const currentCounters = db.get('excerpt_counters').value();
        const initialData = { records: [], excerpt_history: [], excerpt_counters: currentCounters, employees: currentEmployees, users: currentUsers };
        db.setState(initialData).write();
        res.jsonp({ success: true });
    } catch (error) {
        res.status(500).jsonp({ error: "Lỗi Server." });
    }
});

server.post('/custom/counters', (req: Request, res: Response) => {
    try {
        const db = router.db;
        db.set('excerpt_counters', req.body).write();
        res.jsonp(req.body);
    } catch (error) {
        res.status(500).jsonp({ error: "Lỗi." });
    }
});

server.post('/custom/ocr-record', async (req: Request, res: Response) => {
    try {
        const { imageBase64 } = req.body;
        if (!imageBase64) {
            return res.status(400).jsonp({ error: "Thiếu dữ liệu hình ảnh (imageBase64)." });
        }

        const ai = getGoogleGenAIClient(req);

        const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
        let mimeType = 'image/jpeg';
        let base64Data = imageBase64;
        
        if (match) {
            mimeType = match[1];
            base64Data = match[2];
        }

        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType: mimeType
            }
        };

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                records: {
                    type: Type.ARRAY,
                    description: "Danh sách các hồ sơ nhận diện được từ bảng danh sách trong hình ảnh",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            customerName: {
                                type: Type.STRING,
                                description: "Họ và tên của Chủ sử dụng (Cột Chủ sử dụng). ví dụ: Lê Đức Thành, Hoàng Thị Lan, Trương Thị Quang"
                            },
                            landPlot: {
                                type: Type.STRING,
                                description: "Số thửa đất (Cột Số thửa) - Trả về chuỗi số, hoặc để trống nếu không có"
                            },
                            mapSheet: {
                                type: Type.STRING,
                                description: "Tờ bản đồ (Cột Tờ BĐ) - Trả về chuỗi số, hoặc để trống"
                            },
                            area: {
                                type: Type.NUMBER,
                                description: "Diện tích đất cần trích lục / đo đạc (Cột Diện tích) - giá trị số thực"
                            },
                            ward: {
                                type: Type.STRING,
                                description: "Địa danh hoặc xã phường (Cột Địa danh / Khu phố). Ví dụ: Khu phố 6, Khu phố 2, Khu phố 7"
                            },
                            recordType: {
                                type: Type.STRING,
                                description: "Loại hồ sơ (Cột Loại hồ sơ). Hãy biến đổi phù hợp sang một trong các loại chính sau đây: 'CMD', 'Trích lục bản đồ địa chính', 'Trích đo bản đồ địa chính', 'Trích đo chỉnh lý bản đồ địa chính', 'Đo đạc theo yêu cầu', 'Cắm mốc', 'Thuế chính quy', 'Tòa án', 'Thi hành án', 'Khác' dựa vào nội dung viết tắt hoặc viết rõ trong ảnh. (Ví dụ: CMĐ thành 'CMD', Tặng cho QSDĐ thành 'Khác' hoặc loại hồ sơ tương ứng)"
                            }
                        },
                        required: ["customerName"]
                    }
                }
            },
            required: ["records"]
        };

        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: [
                imagePart,
                {
                    text: `Phân tích hình ảnh bảng bàn giao hoặc tiếp nhận hồ sơ hành chính đất đai này. Hãy trích xuất danh sách tất cả các hồ sơ có trong bảng đúng theo các cột dữ liệu.
Chú ý một số từ viết tắt phổ biến:
- "CMĐ" hoặc "CMĐ (SKC)": Chuyển thành loại hồ sơ "CMD".
- "Tặng cho QSDĐ" hoặc "Tặng cho": Chuyển thành loại hồ sơ "Khác".
- "Trích lục" hoặc "TL": Chuyển thành "Trích lục bản đồ địa chính".
- "Trích đo" hoặc "TĐ": Chuyển thành "Trích đo bản đồ địa chính".
- "Chỉnh lý" hoặc "CL": Chuyển thành "Trích đo chỉnh lý bản đồ địa chính".
- "ĐĐ" hoặc "Đo đạc": Chuyển thành "Đo đạc theo yêu cầu".
- "Thuế" hoặc "TCQ": Chuyển thành "Thuế chính quy".
- "TA" hoặc "Tòa án": Chuyển thành "Tòa án".
- "THA" hoặc "Thi hành án": Chuyển thành "Thi hành án".

Đối với Cột 'Địa danh' (như Khu phố 6, Khu phố 2, Khu phố 7...), giữ nguyên nội dung đại diện cho khu phố / ấp / xã tương ứng.
Hãy trả về kết quả dưới định dạng JSON khớp hoàn hảo với responseSchema yêu cầu.`
                }
            ],
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.1,
            }
        });

        const textOutput = response.text;
        if (!textOutput) {
            throw new Error("Không nhận được dữ liệu phản hồi từ Gemini.");
        }

        const resultJson = JSON.parse(textOutput.trim());
        res.jsonp({ success: true, records: resultJson.records });

    } catch (error: any) {
        console.error("Lỗi khi gọi Gemini OCR:", error);
        res.status(500).jsonp({ error: error.message || "Lỗi xử lý hình ảnh OCR từ Gemini AI." });
    }
});

// Vite middleware setup
const startServer = async () => {
    if (process.env.NODE_ENV !== 'production') {
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        server.use(vite.middlewares);
    } else {
        const distPath = path.join(__dirname, 'dist');
        server.use(express.static(distPath));
    }

    // Use router AFTER custom routes and Vite middleware (for API fallback)
    // Ideally, API should be under /api prefix, but current frontend expects root.
    // json-server router handles requests matching db.json keys.
    server.use(router);

    if (process.env.NODE_ENV === 'production') {
        const distPath = path.join(__dirname, 'dist');
        server.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    const PORT = 3000;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
};

startServer();
