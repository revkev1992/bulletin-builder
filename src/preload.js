const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bb', {
  loadWeek: (file) => ipcRenderer.invoke('week:load', file),
  chooseWeek: () => ipcRenderer.invoke('week:choose'),
  onOpen: (fn) => ipcRenderer.on('week:open', (_e, file) => fn(file)),
  onZoom: (fn) => ipcRenderer.on('view:zoom', (_e, factor) => fn(factor)),
  onCommand: (fn) => ipcRenderer.on('cmd', (_e, name) => fn(name)),
  claim: (file, half, force) => ipcRenderer.invoke('session:claim', file, half, !!force),
  release: () => ipcRenderer.invoke('session:release'),
  save: (data) => ipcRenderer.invoke('session:save', data),
  setDirty: (flag) => ipcRenderer.send('doc:dirty', flag),
  closeWindow: () => ipcRenderer.send('app:close-window'),
  importPicture: (weekFile) => ipcRenderer.invoke('asset:import', weekFile),
  importPicturePath: (weekFile, src) => ipcRenderer.invoke('asset:import-path', weekFile, src),
});
