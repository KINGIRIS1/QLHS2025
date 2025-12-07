
const { ipcRenderer } = require('electron');

// Expose API ra window object
// Do main.js đang để contextIsolation: false, ta gán trực tiếp vào window.
// Nếu contextIsolation: true, phải dùng contextBridge.exposeInMainWorld
window.electronAPI = {
  captureScreenshot: (options) => ipcRenderer.invoke('capture-screenshot', options),
};