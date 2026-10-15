const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bb', {
  loadWeek: (file) => ipcRenderer.invoke('week:load', file),
  chooseWeek: () => ipcRenderer.invoke('week:choose'),
  onOpen: (fn) => ipcRenderer.on('week:open', (_e, file) => fn(file)),
  onZoom: (fn) => ipcRenderer.on('view:zoom', (_e, factor) => fn(factor)),
});
