
const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');

// Biến lưu trữ process của Server
let serverProcess;

function startServer() {
  // Xác định đường dẫn tới file server/index.js
  // Khi đóng gói (isPackaged), server sẽ nằm trong resources/server
  const serverPath = app.isPackaged
    ? path.join(process.resourcesPath, 'server', 'index.js')
    : path.join(__dirname, '../server/index.js');

  // Xác định nơi lưu file db.json (AppData/Roaming/TenApp) để có quyền GHI
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'db.json');

  console.log('Starting server at:', serverPath);
  console.log('Database location:', dbPath);

  // Khởi chạy Server dưới dạng tiến trình con (Child Process)
  // Truyền biến môi trường DB_PATH để Server biết nơi lưu dữ liệu
  serverProcess = fork(serverPath, [], {
    env: { ...process.env, DB_PATH: dbPath },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
  });

  serverProcess.on('message', (msg) => {
    if (msg === 'ready') {
      console.log('Internal Server is ready!');
    }
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });
}

function createWindow() {
  // Tạo cửa sổ trình duyệt chính
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, '../public/vite.svg'), 
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Lưu ý: Giữ false để tương thích code cũ, nhưng khuyến khích true trong tương lai
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js') // Đăng ký Preload Script
    },
    autoHideMenuBar: true,
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// --- IPC HANDLERS (Xử lý sự kiện từ React) ---

// Handler chụp màn hình
ipcMain.handle('capture-screenshot', async () => {
  try {
    const sources = await desktopCapturer.getSources({ 
      types: ['screen'], 
      thumbnailSize: { width: 1920, height: 1080 } // Chất lượng Full HD
    });
    
    if (sources.length > 0) {
      // Lấy màn hình chính (đầu tiên) và trả về DataURL (Base64)
      return sources[0].thumbnail.toDataURL();
    }
    return null;
  } catch (error) {
    console.error('Lỗi chụp màn hình tại Main Process:', error);
    throw error;
  }
});

// ---------------------------------------------

app.whenReady().then(() => {
  // 1. Khởi động Server nội bộ trước
  startServer();
  // 2. Sau đó mở giao diện
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Khi tắt ứng dụng -> Diệt luôn Server con
app.on('before-quit', () => {
  if (serverProcess) {
    console.log('Killing internal server...');
    serverProcess.kill();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
