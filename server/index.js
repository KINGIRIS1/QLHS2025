
const jsonServer = require('json-server');
const path = require('path');
const fs = require('fs');

// Lấy đường dẫn DB từ biến môi trường (do Electron truyền vào) hoặc mặc định tại thư mục hiện tại
// DB_PATH được Electron set vào thư mục AppData của người dùng để có quyền Ghi
const dbFile = process.env.DB_PATH || path.join(__dirname, 'db.json');

console.log(`Dang su dung Database tai: ${dbFile}`);

// --- TỰ ĐỘNG SAO LƯU (AUTO BACKUP) ---
// Chức năng này giúp bảo vệ dữ liệu trước khi Server can thiệp
try {
    if (fs.existsSync(dbFile)) {
        const backupDir = path.join(path.dirname(dbFile), 'backups');
        // Tạo thư mục backups nếu chưa có
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        // Tạo tên file backup theo thời gian: db-YYYY-MM-DD-HH-mm.json
        const now = new Date();
        const timeStr = now.toISOString().replace(/T/, '-').replace(/:/g, '-').split('.')[0];
        const backupFile = path.join(backupDir, `db-${timeStr}.json`);
        
        fs.copyFileSync(dbFile, backupFile);
        console.log(`[AN TOAN] Da tu dong sao luu du lieu tai: backups/db-${timeStr}.json`);

        // Dọn dẹp bớt backup cũ nếu quá nhiều (giữ lại 20 file mới nhất)
        const files = fs.readdirSync(backupDir);
        if (files.length > 20) {
            files.sort((a, b) => {
                return fs.statSync(path.join(backupDir, a)).mtime.getTime() - 
                       fs.statSync(path.join(backupDir, b)).mtime.getTime();
            });
            // Xóa file cũ nhất
            const fileToDelete = path.join(backupDir, files[0]);
            fs.unlinkSync(fileToDelete);
            console.log(`[DON DEP] Da xoa ban sao luu cu: ${files[0]}`);
        }
    }
} catch (err) {
    console.error("[LOI] Khong the sao luu du lieu tu dong:", err);
}
// -------------------------------------

// Dữ liệu mặc định để khởi tạo hoặc nâng cấp
const DEFAULT_DATA = {
    records: [], 
    excerpt_history: [],
    excerpt_counters: {
        "Chơn Thành": 0,
        "Minh Hưng": 0,
        "Nha Bích": 0
    },
    employees: [
        { id: 'emp1', name: 'Nguyễn Văn A', department: 'Phòng Kỹ thuật', managedWards: ['Minh Hưng'] },
        { id: 'emp2', name: 'Trần Thị B', department: 'Phòng Pháp chế', managedWards: ['Nha Bích', 'Chơn Thành'] },
        { id: 'emp3', name: 'Lê Văn C', department: 'Ban Lãnh đạo', managedWards: [] }
    ],
    users: [
        { username: 'admin', password: '123', name: 'Administrator', role: 'ADMIN' },
        { username: 'manager', password: '123', name: 'Phó Giám Đốc', role: 'SUBADMIN' },
        { username: 'nv_a', password: '123', name: 'Nguyễn Văn A', role: 'EMPLOYEE', employeeId: 'emp1' },
        { username: 'nv_b', password: '123', name: 'Trần Thị B', role: 'EMPLOYEE', employeeId: 'emp2' }
    ]
};

// Kiểm tra và khởi tạo/nâng cấp Database
if (!fs.existsSync(dbFile)) {
    console.log("Khoi tao co so du lieu ban dau...");
    // Đảm bảo thư mục tồn tại
    const dir = path.dirname(dbFile);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dbFile, JSON.stringify(DEFAULT_DATA, null, 2));
} else {
    // MIGRATION LOGIC: Nếu file đã tồn tại, kiểm tra xem có thiếu bảng nào không
    try {
        const rawData = fs.readFileSync(dbFile, 'utf-8');
        let data = {};
        try {
            data = JSON.parse(rawData);
        } catch (e) {
            console.error("Lỗi đọc file DB cũ, sẽ reset lại cấu trúc.");
            data = {};
        }

        let isModified = false;

        // Kiểm tra từng bảng quan trọng, nếu thiếu thì thêm vào
        if (!data.employees) {
            console.log("-> Phat hien thieu bang Employees. Dang bo sung...");
            data.employees = DEFAULT_DATA.employees;
            isModified = true;
        }
        if (!data.users) {
            console.log("-> Phat hien thieu bang Users. Dang bo sung...");
            data.users = DEFAULT_DATA.users;
            isModified = true;
        }
        if (!data.excerpt_counters) {
            console.log("-> Phat hien thieu bang Excerpt Counters. Dang bo sung...");
            data.excerpt_counters = DEFAULT_DATA.excerpt_counters;
            isModified = true;
        }
        if (!data.excerpt_history) {
            data.excerpt_history = [];
            isModified = true;
        }
        if (!data.records) {
            data.records = [];
            isModified = true;
        }

        if (isModified) {
            fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
            console.log("Cap nhat Database thanh cong (Migration).");
        }
    } catch (err) {
        console.error("Lỗi khi kiểm tra nâng cấp DB:", err);
    }
}

const server = jsonServer.create();
const router = jsonServer.router(dbFile);
const middlewares = jsonServer.defaults();

server.use(middlewares);
server.use(jsonServer.bodyParser);

// Middleware hiển thị log
server.use((req, res, next) => {
    if (['POST', 'PUT', 'DELETE'].includes(req.method) && !req.url.includes('/bulk') && !req.url.includes('/reset')) {
        console.log(`${new Date().toLocaleTimeString()} - ${req.method} request received`);
    }
    next();
});

// --- CUSTOM ROUTES ---

// API Bulk Insert
server.post('/records/bulk', (req, res) => {
    const db = router.db;
    const data = req.body;
    if (Array.isArray(data)) {
        try {
            const records = db.get('records').value();
            const newRecords = records.concat(data);
            db.set('records', newRecords).write();
            res.jsonp({ success: true, count: data.length });
        } catch (error) {
            res.status(500).jsonp({ error: "Lỗi Server khi ghi dữ liệu bulk." });
        }
    } else {
        res.status(400).jsonp({ error: "Dữ liệu phải là mảng." });
    }
});

// API System Reset
server.post('/system/reset', (req, res) => {
    try {
        console.log("Dang thuc hien RESET TOAN BO DU LIEU...");
        const db = router.db;
        
        // GIỮ LẠI CÁC CẤU HÌNH QUAN TRỌNG
        const currentEmployees = db.get('employees').value() || DEFAULT_DATA.employees;
        const currentUsers = db.get('users').value() || DEFAULT_DATA.users;
        const currentCounters = db.get('excerpt_counters').value() || DEFAULT_DATA.excerpt_counters;

        const initialData = { 
            records: [],
            excerpt_history: [], 
            excerpt_counters: currentCounters, 
            employees: currentEmployees,
            users: currentUsers
        };
        
        db.setState(initialData).write();
        res.jsonp({ success: true });
    } catch (error) {
        res.status(500).jsonp({ error: "Lỗi Server khi reset dữ liệu." });
    }
});

// API Custom: Cập nhật counters
server.post('/custom/counters', (req, res) => {
    try {
        const db = router.db;
        const newCounters = req.body;
        db.set('excerpt_counters', newCounters).write();
        res.jsonp(newCounters);
    } catch (error) {
        res.status(500).jsonp({ error: "Lỗi lưu số trích lục." });
    }
});

server.use(router);

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n==================================================');
  console.log(`  HE THONG DA KHOI DONG THANH CONG!`);
  console.log(`  Database Path: ${dbFile}`);
  console.log(`  Trang thai: DA BAT CHE DO TU DONG SAO LUU (BACKUP)`);
  console.log(`  Cong ket noi: ${PORT}`);
  console.log('--------------------------------------------------');
  if (process.send) {
      process.send('ready');
  }
});
