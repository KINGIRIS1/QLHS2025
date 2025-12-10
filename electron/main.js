
const { app, BrowserWindow, ipcMain, desktopCapturer, shell, dialog } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Cấu hình Logger
log.transports.file.level = 'info';
autoUpdater.logger = log;

// Cấu hình AutoUpdater cho GitHub
autoUpdater.autoDownload = false;
autoUpdater.allowDowngrade = false;

let serverProcess;
let mainWindow;

function startServer() {
  const serverPath = app.isPackaged
    ? path.join(process.resourcesPath, 'server', 'index.js')
    : path.join(__dirname, '../server/index.js');

  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'db.json');

  serverProcess = fork(serverPath, [], {
    env: { ...process.env, DB_PATH: dbPath },
    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
  });

  serverProcess.on('message', (msg) => {
    if (msg === 'ready') console.log('Internal Server is ready!');
  });
  
  // Log lỗi từ server ra file log của electron
  serverProcess.stderr?.on('data', (data) => {
      log.error(`Server Error: ${data}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, '../public/icon.ico'), 
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
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
  
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// --- IPC Update Handlers (GitHub Mode) ---

// 1. Kiểm tra cập nhật (Không cần tham số URL nữa vì lấy từ package.json)
ipcMain.handle('check-for-update', async () => {
  if (!app.isPackaged) return { status: 'dev-mode', message: 'Đang chạy chế độ Dev (Không update)' };
  
  try {
    log.info('Checking for updates via GitHub...');
    // autoUpdater sẽ tự đọc cấu hình "publish" trong package.json
    const result = await autoUpdater.checkForUpdates();
    
    if (result && result.updateInfo) {
       return { status: 'available', version: result.updateInfo.version, info: result.updateInfo };
    }
    return { status: 'not-available' };
  } catch (error) {
    log.error('Update Check Error:', error);
    return { status: 'error', message: error.message };
  }
});

// 2. Bắt đầu tải bản cập nhật
ipcMain.handle('download-update', async () => {
  log.info("User requested download update...");
  autoUpdater.downloadUpdate();
});

// 3. Cài đặt và khởi động lại
ipcMain.handle('quit-and-install', () => {
  log.info("Quitting and installing...");
  autoUpdater.quitAndInstall();
});

// --- AutoUpdater Events ---
autoUpdater.on('update-available', (info) => {
  log.info('Update available:', info);
  if(mainWindow) mainWindow.webContents.send('update-status', { status: 'available', info });
});

autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available.');
  if(mainWindow) mainWindow.webContents.send('update-status', { status: 'not-available', info });
});

autoUpdater.on('error', (err) => {
  log.error("Update error:", err);
  if(mainWindow) mainWindow.webContents.send('update-status', { status: 'error', message: err.message });
});

autoUpdater.on('download-progress', (progressObj) => {
  if(mainWindow) mainWindow.webContents.send('update-status', { 
    status: 'downloading', 
    progress: progressObj.percent,
    bytesPerSecond: progressObj.bytesPerSecond,
    total: progressObj.total,
    transferred: progressObj.transferred
  });
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded');
  if(mainWindow) mainWindow.webContents.send('update-status', { status: 'downloaded', info });
});

// --- Other Handlers ---
ipcMain.handle('capture-screenshot', async (event, { hideWindow = true } = {}) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (hideWindow && win) {
      win.minimize(); 
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1920, height: 1080 } });
    if (hideWindow && win) { win.restore(); win.focus(); }
    if (sources.length > 0) return sources[0].thumbnail.toDataURL();
    return null;
  } catch (error) {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) { win.restore(); win.focus(); }
    throw error;
  }
});

ipcMain.handle('open-external-link', async (event, url) => {
  await shell.openExternal(url);
});

app.whenReady().then(() => {
  startServer();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
