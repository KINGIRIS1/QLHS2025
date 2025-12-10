
const { ipcRenderer } = require('electron');

window.electronAPI = {
  captureScreenshot: (options) => ipcRenderer.invoke('capture-screenshot', options),
  openExternal: (url) => ipcRenderer.invoke('open-external-link', url),
  
  // API Update
  checkForUpdate: (serverUrl) => ipcRenderer.invoke('check-for-update', serverUrl),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, value) => callback(value)),
  removeUpdateListener: () => ipcRenderer.removeAllListeners('update-status')
};
