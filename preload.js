'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const ON = new Set(['mini:poke', 'visibility', 'cmd', 'settings:external', 'mini:status', 'mini:motion', 'mini:settings', 'mini:avatar']);

contextBridge.exposeInMainWorld('haru', {
  init: () => ipcRenderer.invoke('init'),
  saveSettings: (s) => ipcRenderer.invoke('settings:save', s),
  saveState: (s) => ipcRenderer.invoke('state:save', s),
  applyWindowSettings: (s) => ipcRenderer.invoke('win:apply', s),
  toMini: () => ipcRenderer.invoke('win:toMini'),
  fetchText: (url) => ipcRenderer.invoke('net:fetch', url),
  saveWork: (folder, files) => ipcRenderer.invoke('works:save', { folder, files }),
  listWorks: () => ipcRenderer.invoke('works:list'),
  openPath: (p) => ipcRenderer.invoke('open:path', p),
  showItem: (p) => ipcRenderer.invoke('open:item', p),
  openOutput: () => ipcRenderer.invoke('open:output'),
  openData: () => ipcRenderer.invoke('open:data'),
  chooseDir: () => ipcRenderer.invoke('dialog:dir'),
  notify: (title, body) => ipcRenderer.invoke('notify', { title, body }),
  setApiKey: (k) => ipcRenderer.invoke('ai:setKey', k),
  aiDiary: (payload) => ipcRenderer.invoke('ai:diary', payload),
  aiTest: (model) => ipcRenderer.invoke('ai:test', model),
  miniStatus: (s) => ipcRenderer.send('mini:status', s),
  readAsset: (rel) => ipcRenderer.invoke('asset:read', rel),
  saveAvatar: (bytes) => ipcRenderer.invoke('avatar:save', bytes),
  readAvatar: () => ipcRenderer.invoke('avatar:read'),
  clearAvatar: () => ipcRenderer.invoke('avatar:clear'),
  mini: {
    poke: () => ipcRenderer.send('mini:poke'),
    open: () => ipcRenderer.send('mini:open'),
    hover: (v) => ipcRenderer.send('mini:hover', v),
    dragStart: () => ipcRenderer.send('mini:dragStart'),
    dragEnd: () => ipcRenderer.send('mini:dragEnd'),
    menu: () => ipcRenderer.send('mini:menu'),
  },
  on: (ch, fn) => { if (ON.has(ch)) ipcRenderer.on(ch, (e, d) => fn(d)); },
});
