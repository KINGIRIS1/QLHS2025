
const { app, BrowserWindow, ipcMain, desktopCapturer, shell, dialog, Notification } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Cấu hình Logger
log.transports.file.level = 'info';
autoUpdater.logger = log;

// Tắt tự động tải về (để người dùng bấm nút mới tải)
autoUpdater.autoDownload = false;
autoUpdater.allowDowngrade = false;

let serverProcess;
let mainWindow;
let initialAdminPassword = null;
const allowedOutputFolders = new Set();
const allowedSavedFiles = new Set();

const isPathInside = (parentPath, targetPath) => {
  const relative = path.relative(path.resolve(parentPath), path.resolve(targetPath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const openSafeExternalUrl = async (rawUrl) => {
  const parsed = new URL(rawUrl);
  if (!['https:', 'http:', 'mailto:'].includes(parsed.protocol)) {
    throw new Error('Giao thức liên kết không được phép.');
  }
  return shell.openExternal(parsed.toString());
};

function startServer() {
  const serverPath = app.isPackaged
    ? path.join(app.getAppPath(), 'server', 'runtime.cjs')
    : path.join(__dirname, '../server/index.js');

  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'db.json');
  const jwtSecretPath = path.join(userDataPath, '.jwt-secret');
  let jwtSecret = '';
  try {
    jwtSecret = fs.readFileSync(jwtSecretPath, 'utf8').trim();
  } catch (_) {}
  if (jwtSecret.length < 64) {
    jwtSecret = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(jwtSecretPath, jwtSecret, { encoding: 'utf8', mode: 0o600 });
  }
  if (!fs.existsSync(dbPath)) initialAdminPassword = crypto.randomBytes(12).toString('base64url');

  serverProcess = fork(serverPath, [], {
    env: {
      ...process.env,
      DB_PATH: dbPath,
      JWT_SECRET: jwtSecret,
      NODE_ENV: 'production',
      PORT: '3005',
      ...(initialAdminPassword ? { INITIAL_ADMIN_PASSWORD: initialAdminPassword } : {})
    },
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
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true,
  });

  // Đặt App User Model ID để thông báo hiển thị đúng trên Windows
  app.setAppUserModelId("com.quanlyhoso.app");

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  if (initialAdminPassword) {
    mainWindow.webContents.once('did-finish-load', () => {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Mật khẩu quản trị ban đầu',
        message: 'Cơ sở dữ liệu cục bộ vừa được tạo.',
        detail: `Tài khoản: admin\nMật khẩu tạm thời: ${initialAdminPassword}\n\nHãy đổi mật khẩu ngay sau lần đăng nhập đầu tiên.`,
        buttons: ['Đã sao chép/ghi lại']
      });
    });
  }
  
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openSafeExternalUrl(url).catch(error => log.warn('Blocked external URL:', error.message));
    return { action: 'deny' };
  });
}

// --- IPC Handlers ---

// Chọn thư mục lưu
ipcMain.handle('select-folder', async (event) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Chọn thư mục lưu file xuất',
        buttonLabel: 'Chọn thư mục này'
    });
    if (!result.canceled && result.filePaths.length > 0) {
        const selectedFolder = path.resolve(result.filePaths[0]);
        allowedOutputFolders.add(selectedFolder);
        return selectedFolder;
    }
    return null;
});

// Lưu file và trả về đường dẫn để mở (Dùng cho tính năng Xuất & Mở ngay)
// Cập nhật: Chấp nhận outputFolder
ipcMain.handle('save-and-open-file', async (event, { fileName, base64Data, outputFolder }) => {
    try {
        if (!fileName || path.basename(fileName) !== fileName) {
          throw new Error('Tên tệp không hợp lệ.');
        }
        const downloadsFolder = path.resolve(app.getPath('downloads'));
        allowedOutputFolders.add(downloadsFolder);
        const folder = path.resolve(outputFolder || downloadsFolder);
        if (!allowedOutputFolders.has(folder)) {
          throw new Error('Thư mục lưu chưa được người dùng cho phép.');
        }
        const filePath = path.resolve(folder, fileName);
        if (!isPathInside(folder, filePath)) throw new Error('Đường dẫn tệp không hợp lệ.');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);
        allowedSavedFiles.add(filePath);
        // Tự động mở file sau khi lưu
        shell.openPath(filePath);
        return { success: true, path: filePath };
    } catch (error) {
        log.error('Save and open error:', error);
        return { success: false, message: error.message };
    }
});

// Chỉ mở file theo đường dẫn
ipcMain.handle('open-file-path', async (event, filePath) => {
    if (filePath) {
        const resolvedPath = path.resolve(filePath);
        const isAllowed = allowedSavedFiles.has(resolvedPath) ||
          [...allowedOutputFolders].some(folder => isPathInside(folder, resolvedPath));
        if (!isAllowed) return false;
        await shell.openPath(resolvedPath);
        return true;
    }
    return false;
});

ipcMain.handle('check-for-update', async (event, serverUrl) => {
  if (!app.isPackaged) return { status: 'dev-mode', message: 'Đang chạy chế độ Dev (Không update)' };
  
  try {
    // LOGIC THÔNG MINH:
    // 1. Nếu serverUrl chứa "github.com" hoặc rỗng -> Sử dụng cấu hình mặc định trong package.json (GitHub Releases)
    // 2. Nếu serverUrl là IP hoặc tên miền riêng (LAN) -> Sử dụng chế độ Custom Server
    
    if (serverUrl && !serverUrl.includes('github.com') && serverUrl.trim() !== '') {
        const parsedServerUrl = new URL(serverUrl);
        if (!['http:', 'https:'].includes(parsedServerUrl.protocol)) {
          throw new Error('Địa chỉ máy chủ cập nhật không hợp lệ.');
        }
        const feedUrl = `${parsedServerUrl.toString().replace(/\/$/, '')}/updates`;
        log.info(`Checking updates from Custom Server: ${feedUrl}`);
        autoUpdater.setFeedURL(feedUrl);
    } else {
        log.info('Checking updates from GitHub Releases (using package.json config)');
        // Không gọi setFeedURL, để electron-updater tự dùng "publish" trong package.json
    }

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

// FIX LỖI: "Please check update first"
ipcMain.handle('download-update', async () => {
  log.info("User requested download update...");
  try {
    // Cố gắng tải ngay lập tức
    return await autoUpdater.downloadUpdate();
  } catch (e) {
    log.warn("Direct download failed, attempting to re-check update first...", e.message);
    
    // Nếu lỗi do chưa có state update, ta thực hiện check lại rồi mới download
    if (e.message.includes('check update first')) {
        try {
            // Check lại (sử dụng feedURL đã set trước đó hoặc mặc định)
            const checkResult = await autoUpdater.checkForUpdates();
            if (checkResult && checkResult.updateInfo) {
                // Sau khi check xong, gọi download lại
                return await autoUpdater.downloadUpdate();
            } else {
                throw new Error("Không tìm thấy bản cập nhật khi thử lại.");
            }
        } catch (retryError) {
            log.error("Retry download failed:", retryError);
            throw retryError;
        }
    }
    
    throw e;
  }
});

ipcMain.handle('quit-and-install', () => {
  log.info("Quitting and installing...");
  autoUpdater.quitAndInstall();
});

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
  await openSafeExternalUrl(url);
});

ipcMain.handle('show-notification', async (event, { title, body }) => {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: title,
      body: body,
      icon: path.join(__dirname, '../public/icon.ico'),
      silent: false 
    });
    notification.show();
    notification.on('click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
        mainWindow.webContents.send('navigate-to-view', 'internal_chat');
      }
    });
    return true;
  }
  return false;
});

ipcMain.handle('show-confirm-dialog', async (event, { message, title }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showMessageBox(win, {
    type: 'question',
    buttons: ['Không', 'Có'], 
    defaultId: 1,
    cancelId: 0,
    title: title || 'Xác nhận',
    message: message,
    icon: path.join(__dirname, '../public/icon.ico')
  });
  return result.response === 1; 
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
