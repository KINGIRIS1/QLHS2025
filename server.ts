import express from 'express';
import type { Request, Response, NextFunction } from 'express';
// @ts-ignore
import jsonServer from 'json-server';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { GoogleGenAI, Type } from '@google/genai';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const rootDir = process.cwd();

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');

if (!process.env.JWT_SECRET) {
    console.warn('[BAO MAT] JWT_SECRET chưa được cấu hình. Khóa ngẫu nhiên chỉ phù hợp cho môi trường phát triển.');
}

const hashPassword = (password: string): string => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt$${salt}$${hash}`;
};

const verifyPassword = (password: string, storedPassword: string): boolean => {
    if (!storedPassword.startsWith('scrypt$')) {
        const actual = Buffer.from(String(password));
        const expected = Buffer.from(String(storedPassword));
        return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    }

    const [, salt, expectedHex] = storedPassword.split('$');
    if (!salt || !expectedHex) return false;
    const actual = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

const getGoogleGenAIClient = (req: Request) => {
  let apiKey = (req.headers['x-gemini-key'] as string) || '';
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
const dbFile = process.env.DB_PATH || path.join(rootDir, 'server/db.json');
if (!fs.existsSync(dbFile)) {
    const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD;
    if (!initialAdminPassword) {
        throw new Error('INITIAL_ADMIN_PASSWORD bắt buộc khi khởi tạo cơ sở dữ liệu mới.');
    }
    const initialData = {
        records: [],
        audit_logs: [],
        excerpt_history: [],
        excerpt_counters: { "Chơn Thành": 0, "Minh Hưng": 0, "Nha Bích": 0 },
        employees: [],
        users: [{ username: 'admin', password: hashPassword(initialAdminPassword), name: 'Administrator', role: 'ADMIN' }]
    };
    console.log("Khoi tao co so du lieu ban dau...");
    const dir = path.dirname(dbFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dbFile, JSON.stringify(initialData, null, 2));
}
const router = jsonServer.router(dbFile);
const middlewares = jsonServer.defaults();

// --- TỐI ƯU HÓA TỐC ĐỘ CẬP NHẬT ---
let releaseDir = path.join(rootDir, 'release');
if (!fs.existsSync(releaseDir)) {
    // Thử tìm ở thư mục gốc project (khi chạy dev)
    releaseDir = path.join(rootDir, 'release');
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

        const files = fs.readdirSync(backupDir)
            .filter(file => file.startsWith('db-') && file.endsWith('.json'));
        if (files.length > 20) {
            files.sort((a, b) => {
                return fs.statSync(path.join(backupDir, b)).mtime.getTime() - 
                       fs.statSync(path.join(backupDir, a)).mtime.getTime();
            });
            files.slice(20).forEach(file => {
                const fileToDelete = path.join(backupDir, file);
                fs.unlinkSync(fileToDelete);
                console.log(`[DON DEP] Da xoa ban sao luu cu: ${fileToDelete}`);
            });
        }
    }
} catch (err) {
    console.error("[LOI] Khong the sao luu du lieu tu dong:", err);
}
// -------------------------------------

// Use default middlewares (logger, static, cors and no-cache)
server.use(cors());
server.use(middlewares);
server.use(express.json({ limit: '100mb' }));
server.use(express.urlencoded({ limit: '100mb', extended: true }));
// Do NOT use jsonServer.bodyParser because we already use express.json and express.urlencoded which handle parsing with larger limits
// jsonServer.bodyParser is redundant and causes "stream is not readable" conflicts with express.json.

// Xử lý lỗi từ body-parser (ví dụ: Payload quá lớn)
server.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err && (err.type === 'entity.too.large' || err.status === 413)) {
        res.status(413).jsonp({ error: "Kích thước tệp tin tải lên quá lớn. Vui lòng giảm dung lượng hình ảnh hoặc tệp PDF." });
    } else {
        next(err);
    }
});

// Middleware hiển thị log (Chỉ log các request API, không log file tĩnh nữa do đã khai báo static ở trên)
server.use((req: Request, res: Response, next: NextFunction) => {
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        console.log(`${new Date().toLocaleTimeString()} - ${req.method} request received`);
    }
    next();
});

// --- API LOGIN PUBLIC ENDPOINT ---
server.get('/api/health', (_req: Request, res: Response) => {
    res.jsonp({ ok: true });
});

server.post('/custom/login', (req: Request, res: Response) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).jsonp({ error: "Vui lòng nhập tên đăng nhập và mật khẩu." });
        }
        const db = router.db;
        const localUsers = db.get('users').value() || [];
        
        const authenticatedUser = localUsers.find((u: any) =>
            u.username &&
            u.username.toLowerCase().trim() === String(username).toLowerCase().trim() &&
            verifyPassword(String(password), String(u.password || ''))
        );

        if (!authenticatedUser) {
            return res.status(401).jsonp({ error: "Tên đăng nhập hoặc mật khẩu không chính xác." });
        }

        // Tự động nâng cấp mật khẩu cũ dạng rõ sang scrypt sau lần đăng nhập hợp lệ đầu tiên.
        if (!String(authenticatedUser.password || '').startsWith('scrypt$')) {
            authenticatedUser.password = hashPassword(String(password));
            db.write();
        }

        const token = jwt.sign(
            { 
                username: authenticatedUser.username, 
                role: 'authenticated',
                appRole: authenticatedUser.role,
                name: authenticatedUser.name, 
                id: authenticatedUser.id || authenticatedUser.username 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        const { password: _, ...userWithoutPassword } = authenticatedUser;
        return res.jsonp({ success: true, token, user: userWithoutPassword });
    } catch (error: any) {
        console.error("Lỗi khi xử lý đăng nhập:", error);
        return res.status(500).jsonp({ error: "Lỗi máy chủ khi xác thực đăng nhập." });
    }
});

// --- MIDDLEWARE NÂNG CAO BẢO MẬT API (AUTHENTICATION & AUTHORIZATION) ---
// Danh sách các tài nguyên dữ liệu / API cần bảo vệ nghiêm ngặt bằng JWT Token:
server.use((req: Request, res: Response, next: NextFunction) => {
    // 0. Bỏ qua các yêu cầu OPTIONS (CORS preflight) hoặc HEAD
    if (req.method === 'OPTIONS' || req.method === 'HEAD') {
        return next();
    }

    // 1. Cho phép các yêu cầu truy cập công khai (Public):
    const isExplicitPublic = req.path === '/custom/login' ||
                             req.path === '/api/health' || 
                             req.path.startsWith('/updates');

    if (isExplicitPublic) {
        return next();
    }

    // Chỉ tài nguyên giao diện mới được phép GET công khai. Mọi collection/API còn lại
    // đều phải xác thực, kể cả collection mới được thêm về sau.
    const isFrontendAsset = req.method === 'GET' && (
        req.path === '/' ||
        req.path === '/index.html' ||
        req.path.startsWith('/assets/') ||
        req.path.startsWith('/src/') ||
        req.path.startsWith('/@vite/') ||
        req.path.startsWith('/node_modules/') ||
        /\.(?:tsx?|jsx?|css|map|png|jpe?g|gif|svg|ico|woff2?|ttf)$/i.test(req.path)
    );
    if (isFrontendAsset) {
        return next();
    }

    // 4. Đối với các truy vấn Dữ liệu (API) hoặc thao tác ghi/sửa/xóa: BẮT BUỘC có Token xác thực
    const authHeader = req.headers['authorization'] || req.headers['x-access-token'];
    let token = '';

    if (authHeader && typeof authHeader === 'string') {
        if (authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7).trim();
        } else {
            token = authHeader.trim();
        }
    }

    // Nếu không có Token -> Trả về lỗi 401 Unauthorized
    if (!token) {
        return res.status(401).jsonp({ 
            error: "Yêu cầu bị từ chối: Thiếu Token xác thực. Vui lòng đăng nhập để truy cập dữ liệu." 
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        (req as any).user = decoded;

        const isAdmin = decoded.appRole === 'ADMIN';
        const isSubAdmin = decoded.appRole === 'SUBADMIN';
        if ((req.path === '/system/reset' || req.path === '/users' || req.path.startsWith('/users/')) && !isAdmin) {
            return res.status(403).jsonp({ 
                error: "Quyền hạn không đủ. Chỉ Quản trị viên (ADMIN) được phép thực hiện thao tác này." 
            });
        }
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
            (req.path === '/employees' || req.path.startsWith('/employees/')) &&
            !isAdmin && !isSubAdmin) {
            return res.status(403).jsonp({ error: 'Không có quyền thay đổi dữ liệu nhân sự.' });
        }

        return next();
    } catch (err: any) {
        return res.status(401).jsonp({ 
            error: "Xác thực không hợp lệ hoặc đã hết hạn phiên làm việc. Vui lòng đăng nhập lại." 
        });
    }
});

server.get('/custom/session', (req: Request, res: Response) => {
    const decoded = (req as any).user;
    const dbUser = (router.db.get('users').value() || []).find(
        (user: any) => user.username === decoded?.username
    );
    if (!dbUser) return res.status(401).jsonp({ error: 'Tài khoản không còn tồn tại.' });
    const { password: _, ...safeUser } = dbUser;
    return res.jsonp({ user: safeUser });
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

server.post('/custom/compare-docs', async (req: Request, res: Response) => {
    try {
        const { gcnBase64, gcnMime, trichLucBase64, trichLucMime } = req.body;
        if (!gcnBase64 || !trichLucBase64) {
            return res.status(400).jsonp({ error: "Thiếu dữ liệu file Giấy chứng nhận (GCN) hoặc file Trích lục / Trích đo." });
        }

        const ai = getGoogleGenAIClient(req);

        // Chuẩn hóa base64 data
        const cleanBase64 = (base64Str: string) => {
            const match = base64Str.match(/^data:(.+);base64,(.+)$/);
            return match ? match[2] : base64Str;
        };

        const gcnCleanData = cleanBase64(gcnBase64);
        const trichLucCleanData = cleanBase64(trichLucBase64);

        const gcnPart = {
            inlineData: {
                data: gcnCleanData,
                mimeType: gcnMime || 'application/pdf'
            }
        };

        const trichLucPart = {
            inlineData: {
                data: trichLucCleanData,
                mimeType: trichLucMime || 'application/pdf'
            }
        };

        const responseSchema = {
            type: Type.OBJECT,
            properties: {
                summary: {
                    type: Type.STRING,
                    description: "Tóm tắt tổng quan về việc so sánh đối chiếu giữa 2 tài liệu."
                },
                comparisons: {
                    type: Type.ARRAY,
                    description: "Danh sách các hạng mục đối chiếu chi tiết.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            field: {
                                type: Type.STRING,
                                description: "Tên trường thông tin đối chiếu (Ví dụ: Chủ sử dụng đất, Thửa đất số, Tờ bản đồ số, Diện tích, Mục đích sử dụng, Địa chỉ thửa đất, Số hiệu GCN, Cơ quan ký duyệt, Kích thước ranh giới)."
                            },
                            gcnValue: {
                                type: Type.STRING,
                                description: "Giá trị đọc được trên tài liệu GCN (Giấy chứng nhận)."
                            },
                            trichLucValue: {
                                type: Type.STRING,
                                description: "Giá trị đọc được trên tài liệu Trích lục / Trích đo."
                            },
                            status: {
                                type: Type.STRING,
                                description: "Trạng thái đối chiếu: 'match' (khớp hoàn toàn), 'warning' (lệch số liệu đo đạc/có giải trình hoặc thay đổi hành chính hợp lệ), 'error' (lệch nghiêm trọng/sai lỗi kỹ thuật/copy-paste nhầm)."
                            },
                            notes: {
                                type: Type.STRING,
                                description: "Giải thích chi tiết về sự trùng khớp hoặc sai lệch."
                            }
                        },
                        required: ["field", "gcnValue", "trichLucValue", "status", "notes"]
                    }
                },
                technicalErrors: {
                    type: Type.ARRAY,
                    description: "Các lỗi kỹ thuật hoặc hành chính cụ thể phát hiện được trên bản vẽ hoặc nội dung trích lục.",
                    items: {
                        type: Type.STRING
                    }
                },
                suggestions: {
                    type: Type.ARRAY,
                    description: "Các kiến nghị hoặc đề xuất khắc phục cho cán bộ thẩm định.",
                    items: {
                        type: Type.STRING
                    }
                }
            },
            required: ["summary", "comparisons", "technicalErrors", "suggestions"]
        };

        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: [
                gcnPart,
                trichLucPart,
                {
                    text: `Bạn là một Cán bộ kiểm tra kỹ thuật bản vẽ và thẩm định hồ sơ đất đai chuyên nghiệp tại Chi nhánh Văn phòng Đăng ký Đất đai.
Hãy đối chiếu chi tiết giữa tài liệu thứ nhất (Giấy chứng nhận quyền sử dụng đất - GCN) và tài liệu thứ hai (Bản vẽ Trích lục / Trích đo bản đồ địa chính).

Các nội dung cần đối chiếu và thẩm định gồm:
1. Thông tin Chủ sử dụng đất (Họ tên, năm sinh, CCCD/CMND nếu có). Lưu ý kiểm tra trang bổ sung biến động ở trang 4 của GCN để xem có cập nhật chuyển nhượng/tặng cho hay không.
2. Thửa đất số, Tờ bản đồ số.
3. Diện tích thửa đất (kiểm tra xem có giảm/tăng diện tích không, nếu có thì xem Trích lục có ghi lý do biến động ranh giới do sai số hai lần đo không).
4. Cơ cấu mục đích sử dụng đất (ví dụ: Đất ở ONT/ODT, Đất trồng cây lâu năm CLN).
5. Địa chỉ thửa đất (Khu phố, Ấp, Xã, Phường, Thị xã, Tỉnh). Lưu ý lỗi copy-paste template từ các tỉnh khác như 'Đồng Nai' thay vì 'Bình Phước'.
6. Số hiệu Giấy chứng nhận (GCN) và ngày cấp.
7. Cơ quan ký duyệt / Ban hành trích lục.
8. Kích thước các cạnh ranh giới thửa đất (so sánh kích thước ranh giới trên bản vẽ GCN và Trích lục).

Hãy trả về kết quả dưới định dạng JSON khớp hoàn hảo với responseSchema yêu cầu. Toàn bộ nội dung trả về bằng tiếng Việt chuyên nghiệp, khách quan.`
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
            throw new Error("Không nhận được dữ liệu phản hồi so sánh từ Gemini.");
        }

        const resultJson = JSON.parse(textOutput.trim());
        res.jsonp({ success: true, result: resultJson });

    } catch (error: any) {
        console.error("Lỗi khi gọi Gemini đối chiếu tài liệu:", error);
        res.status(500).jsonp({ error: error.message || "Lỗi xử lý đối chiếu tài liệu từ Gemini AI." });
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
        const distPath = path.join(rootDir, 'dist');
        server.use(express.static(distPath));
    }

    router.render = (req: Request, res: Response) => {
        if (req.path === '/users' || req.path.startsWith('/users/')) {
            const redact = (user: any) => {
                if (!user || typeof user !== 'object') return user;
                const { password: _, ...safeUser } = user;
                return safeUser;
            };
            res.jsonp(Array.isArray(res.locals.data) ? res.locals.data.map(redact) : redact(res.locals.data));
            return;
        }
        res.jsonp(res.locals.data);
    };

    // Use router AFTER custom routes and Vite middleware (for API fallback)
    // Ideally, API should be under /api prefix, but current frontend expects root.
    // json-server router handles requests matching db.json keys.
    server.use(router);

    if (process.env.NODE_ENV === 'production') {
        const distPath = path.join(rootDir, 'dist');
        server.get('*all', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    const PORT = Number(process.env.PORT || 3000);
    const HOST = process.env.SERVER_HOST || '127.0.0.1';
    server.listen(PORT, HOST, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      if (typeof process.send === 'function') process.send('ready');
    });
};

startServer();
