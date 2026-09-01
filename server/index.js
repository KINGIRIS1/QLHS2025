
const jsonServer = require('json-server');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
let express;
try {
  express = require('express');
} catch (error) {
  console.error("Error: Cannot find module 'express'.");
  console.error("Please run 'cd server && npm install' to install dependencies.");
  process.exit(1);
}

// Lấy đường dẫn DB từ biến môi trường (do Electron truyền vào) hoặc mặc định tại thư mục hiện tại
// DB_PATH được Electron set vào thư mục AppData của người dùng để có quyền Ghi
const dbFile = process.env.DB_PATH || path.join(__dirname, 'db.json');

console.log(`Dang su dung Database tai: ${dbFile}`);

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');

if (!process.env.JWT_SECRET) {
    console.warn('[BAO MAT] JWT_SECRET chưa được cấu hình. Khóa ngẫu nhiên chỉ phù hợp khi chạy cục bộ.');
}

const hashPassword = (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt$${salt}$${hash}`;
};

const verifyPassword = (password, storedPassword) => {
    const stored = String(storedPassword || '');
    if (!stored.startsWith('scrypt$')) {
        const actual = Buffer.from(String(password));
        const expected = Buffer.from(stored);
        return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    }
    const [, salt, expectedHex] = stored.split('$');
    if (!salt || !expectedHex) return false;
    const actual = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

if (!fs.existsSync(dbFile)) {
    const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD;
    if (!initialAdminPassword) {
        throw new Error('INITIAL_ADMIN_PASSWORD bat buoc khi khoi tao co so du lieu moi.');
    }
    const initialData = {
        records: [],
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

const server = jsonServer.create();
const router = jsonServer.router(dbFile);
const middlewares = jsonServer.defaults();

// --- TỐI ƯU HÓA TỐC ĐỘ CẬP NHẬT ---
// Đưa cấu hình Static File lên TRƯỚC các middleware mặc định.
// Điều này giúp việc tải file bỏ qua Logger và BodyParser, tăng tốc độ đáng kể.
let releaseDir = path.join(__dirname, '../release');
if (!fs.existsSync(releaseDir)) {
    // Thử tìm ở thư mục gốc project (khi chạy dev)
    releaseDir = path.join(__dirname, '../../release');
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

server.use(middlewares);
server.use(jsonServer.bodyParser);

// Middleware hiển thị log (Chỉ log các request API, không log file tĩnh nữa do đã khai báo static ở trên)
server.use((req, res, next) => {
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        console.log(`${new Date().toLocaleTimeString()} - ${req.method} request received`);
    }
    next();
});

server.get('/api/health', (_req, res) => {
    res.jsonp({ ok: true });
});

server.post('/custom/login', (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).jsonp({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
        }
        const db = router.db;
        const users = db.get('users').value() || [];
        const authenticatedUser = users.find(user =>
            user.username &&
            user.username.toLowerCase().trim() === String(username).toLowerCase().trim() &&
            verifyPassword(String(password), user.password)
        );
        if (!authenticatedUser) {
            return res.status(401).jsonp({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
        }
        if (!String(authenticatedUser.password || '').startsWith('scrypt$')) {
            authenticatedUser.password = hashPassword(String(password));
            db.write();
        }
        const token = jwt.sign({
            username: authenticatedUser.username,
            name: authenticatedUser.name,
            id: authenticatedUser.id || authenticatedUser.username,
            role: 'authenticated',
            appRole: authenticatedUser.role
        }, JWT_SECRET, { expiresIn: '24h' });
        const { password: _password, ...safeUser } = authenticatedUser;
        return res.jsonp({ success: true, token, user: safeUser });
    } catch (error) {
        console.error('[LOI] Dang nhap that bai:', error);
        return res.status(500).jsonp({ error: 'Lỗi máy chủ khi xác thực đăng nhập.' });
    }
});

server.use((req, res, next) => {
    if (req.method === 'OPTIONS' || req.method === 'HEAD') return next();
    if (req.path === '/custom/login' || req.path === '/api/health' || req.path.startsWith('/updates')) return next();

    const header = req.headers.authorization || req.headers['x-access-token'];
    const token = typeof header === 'string'
        ? (header.startsWith('Bearer ') ? header.slice(7).trim() : header.trim())
        : '';
    if (!token) return res.status(401).jsonp({ error: 'Thiếu Token xác thực.' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        const isAdmin = decoded.appRole === 'ADMIN';
        const isSubAdmin = decoded.appRole === 'SUBADMIN';
        if ((req.path === '/system/reset' || req.path === '/users' || req.path.startsWith('/users/')) && !isAdmin) {
            return res.status(403).jsonp({ error: 'Chỉ quản trị viên được phép đặt lại hệ thống.' });
        }
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
            (req.path === '/employees' || req.path.startsWith('/employees/')) &&
            !isAdmin && !isSubAdmin) {
            return res.status(403).jsonp({ error: 'Không có quyền thay đổi dữ liệu nhân sự.' });
        }
        return next();
    } catch (_error) {
        return res.status(401).jsonp({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
    }
});

server.get('/custom/session', (req, res) => {
    const dbUser = (router.db.get('users').value() || []).find(user => user.username === req.user?.username);
    if (!dbUser) return res.status(401).jsonp({ error: 'Tài khoản không còn tồn tại.' });
    const { password: _password, ...safeUser } = dbUser;
    return res.jsonp({ user: safeUser });
});

// Custom Routes
server.post('/custom/bulk', (req, res) => {
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

server.post('/custom/update-missing', (req, res) => {
    const db = router.db;
    const incomingData = req.body;
    if (Array.isArray(incomingData)) {
        try {
            const dbRecords = db.get('records').value();
            let updatedCount = 0;
            dbRecords.forEach(dbRecord => {
                const match = incomingData.find(i => i.code && dbRecord.code && i.code.toString().trim() === dbRecord.code.toString().trim());
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

server.post('/system/reset', (req, res) => {
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

server.post('/custom/counters', (req, res) => {
    try {
        const db = router.db;
        db.set('excerpt_counters', req.body).write();
        res.jsonp(req.body);
    } catch (error) {
        res.status(500).jsonp({ error: "Lỗi." });
    }
});

router.render = (req, res) => {
    if (req.path === '/users' || req.path.startsWith('/users/')) {
        const redact = user => {
            if (!user || typeof user !== 'object') return user;
            const { password: _password, ...safeUser } = user;
            return safeUser;
        };
        return res.jsonp(Array.isArray(res.locals.data) ? res.locals.data.map(redact) : redact(res.locals.data));
    }
    return res.jsonp(res.locals.data);
};

server.use(router);

// ĐỔI PORT TỪ 3000 -> 3005 ĐỂ TRÁNH XUNG ĐỘT
const PORT = Number(process.env.PORT || 3005);
const HOST = process.env.SERVER_HOST || '127.0.0.1';
server.listen(PORT, HOST, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Update feed available at: http://localhost:${PORT}/updates`);
  if (typeof process.send === 'function') process.send('ready');
});
