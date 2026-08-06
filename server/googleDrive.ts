import { Request, Response } from 'express';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOKENS_FILE = path.join(__dirname, 'google_drive_tokens.json');

// Helper to construct dynamic OAuth redirect URI
export function getRedirectUri(req: Request): string {
  const host = req.get('host');
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
  return `${protocol}://${host}/api/oauth/google/callback`;
}

// Get initialized OAuth2 client
export function getOAuth2Client(req?: Request) {
  const clientId = process.env.OAUTH_CLIENT_ID;
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;
  
  let redirectUri = '';
  if (req) {
    redirectUri = getRedirectUri(req);
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );

  // Load existing tokens if available
  const tokens = loadSavedTokens();
  if (tokens) {
    oauth2Client.setCredentials(tokens);
  }

  return oauth2Client;
}

export function loadSavedTokens() {
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      const data = fs.readFileSync(TOKENS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading saved Google Drive tokens:", err);
  }
  return null;
}

export function saveTokens(tokens: any) {
  try {
    const existing = loadSavedTokens() || {};
    const merged = { ...existing, ...tokens };
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(merged, null, 2));
    return merged;
  } catch (err) {
    console.error("Error saving Google Drive tokens:", err);
    throw err;
  }
}

export function clearTokens() {
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      fs.unlinkSync(TOKENS_FILE);
    }
  } catch (err) {
    console.error("Error clearing Google Drive tokens:", err);
  }
}

// API Route Handlers
export function handleGetAuthUrl(req: Request, res: Response) {
  try {
    const oauth2Client = getOAuth2Client(req);
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/userinfo.email']
    });
    res.json({ url, success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Không thể tạo liên kết đăng nhập Google." });
  }
}

export async function handleOAuthCallback(req: Request, res: Response) {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send("Thiếu mã xác thực (code).");
    }

    const oauth2Client = getOAuth2Client(req);
    const { tokens } = await oauth2Client.getToken(code as string);
    saveTokens(tokens);

    // Render HTML page to notify client and close popup
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Kết nối Google Drive thành công</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
            .card { background: white; padding: 2.5rem; border-radius: 1.5rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); text-align: center; max-width: 420px; border: 1px solid #e2e8f0; }
            .icon { width: 56px; height: 56px; background: #dcfce7; color: #15803d; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem; font-size: 28px; font-weight: bold; }
            h2 { margin: 0 0 0.5rem; color: #0f172a; font-size: 1.25rem; }
            p { font-size: 0.875rem; color: #64748b; margin-bottom: 1.5rem; line-height: 1.5; }
            button { background: #2563eb; color: white; border: none; padding: 0.625rem 1.5rem; border-radius: 0.75rem; font-weight: 700; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✓</div>
            <h2>Đã kết nối Google Drive thành công!</h2>
            <p>Hệ thống Quản lý Hồ sơ đã liên kết an toàn với tài khoản Google Drive của bạn để tự động sao lưu dữ liệu hàng ngày.</p>
            <button onclick="window.close()">Đóng cửa sổ này</button>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GDRIVE_CONNECTED' }, '*');
              setTimeout(() => { window.close(); }, 1500);
            } else {
              setTimeout(() => { window.location.href = '/?gdrive=connected'; }, 2000);
            }
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("Lỗi OAuth callback:", err);
    res.status(500).send(`Lỗi kết nối Google Drive: ${err.message || err}`);
  }
}

export async function handleGetStatus(req: Request, res: Response) {
  try {
    const tokens = loadSavedTokens();
    if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
      return res.json({ connected: false });
    }

    const oauth2Client = getOAuth2Client(req);
    
    // Try getting user profile
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      return res.json({
        connected: true,
        email: userInfo.data.email,
        name: userInfo.data.name,
        picture: userInfo.data.picture
      });
    } catch (e) {
      // Fallback
      return res.json({ connected: true });
    }
  } catch (err: any) {
    return res.json({ connected: false, error: err.message });
  }
}

export async function handleDisconnect(req: Request, res: Response) {
  clearTokens();
  res.json({ success: true, message: "Đã hủy kết nối Google Drive." });
}

// Find or create 'Sao Luu Quan Ly Ho So' folder in Google Drive
async function getOrCreateBackupFolder(drive: any) {
  const folderName = 'Sao Luu Quan Ly Ho So';
  const q = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
  
  const res = await drive.files.list({
    q,
    fields: 'files(id, name)',
    spaces: 'drive'
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  // Create folder
  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };

  const folder = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id'
  });

  return folder.data.id;
}

export async function handleUploadBackup(req: Request, res: Response) {
  try {
    const tokens = loadSavedTokens();
    if (!tokens) {
      return res.status(401).json({ error: "Chưa kết nối Google Drive. Vui lòng kết nối tài khoản Google trước." });
    }

    const oauth2Client = getOAuth2Client(req);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const folderId = await getOrCreateBackupFolder(drive);

    const { backupContent, fileName } = req.body;
    let fileDataString = '';

    if (backupContent) {
      fileDataString = typeof backupContent === 'string' ? backupContent : JSON.stringify(backupContent, null, 2);
    } else {
      // Default to database file
      const dbFile = process.env.DB_PATH || path.join(__dirname, 'db.json');
      if (fs.existsSync(dbFile)) {
        fileDataString = fs.readFileSync(dbFile, 'utf-8');
      } else {
        return res.status(400).json({ error: "Không tìm thấy dữ liệu sao lưu." });
      }
    }

    const now = new Date();
    const timeStr = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    const uploadFileName = fileName || `SaoLuu_QLHS_${timeStr}.json`;

    const fileMetadata = {
      name: uploadFileName,
      parents: [folderId]
    };

    const media = {
      mimeType: 'application/json',
      body: fileDataString
    };

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, createdTime, size'
    });

    res.json({
      success: true,
      file: file.data,
      message: `Đã tự động đẩy bản sao lưu "${uploadFileName}" lên Google Drive thành công!`
    });
  } catch (err: any) {
    console.error("Lỗi khi tải bản sao lưu lên Google Drive:", err);
    res.status(500).json({ error: err.message || "Lỗi khi đẩy sao lưu lên Google Drive." });
  }
}

export async function handleListDriveFiles(req: Request, res: Response) {
  try {
    const tokens = loadSavedTokens();
    if (!tokens) {
      return res.status(401).json({ error: "Chưa kết nối Google Drive." });
    }

    const oauth2Client = getOAuth2Client(req);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const folderId = await getOrCreateBackupFolder(drive);

    const driveRes = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, webViewLink, createdTime, size)',
      orderBy: 'createdTime desc',
      pageSize: 20
    });

    res.json({
      success: true,
      files: driveRes.data.files || []
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Không thể lấy danh sách file trên Google Drive." });
  }
}

// Background auto backup routine to Google Drive
export async function performAutoGoogleDriveBackup() {
  try {
    const tokens = loadSavedTokens();
    if (!tokens) return;

    const oauth2Client = getOAuth2Client();
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const folderId = await getOrCreateBackupFolder(drive);

    const dbFile = process.env.DB_PATH || path.join(__dirname, 'db.json');
    if (!fs.existsSync(dbFile)) return;

    const fileDataString = fs.readFileSync(dbFile, 'utf-8');
    const now = new Date();
    const timeStr = now.toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    const uploadFileName = `Auto_Backup_QLHS_${timeStr}.json`;

    await drive.files.create({
      requestBody: {
        name: uploadFileName,
        parents: [folderId]
      },
      media: {
        mimeType: 'application/json',
        body: fileDataString
      },
      fields: 'id'
    });

    console.log(`[GOOGLE DRIVE] Da tu dong day ban sao luu len Google Drive: ${uploadFileName}`);
  } catch (err) {
    console.error("[GOOGLE DRIVE] Loi khi tu dong day sao luu:", err);
  }
}
