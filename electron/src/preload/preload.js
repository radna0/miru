/* eslint n/no-callback-literal: 0 */
import { contextBridge, ipcRenderer } from 'electron';

// Expose IPC communication methods
contextBridge.exposeInMainWorld('IPC', {
  emit: (event, data) => {
    ipcRenderer.send(event, data);
  },
  on: (event, callback) => {
    ipcRenderer.on(event, (event, ...args) => callback(...args));
  },
  once: (event, callback) => {
    ipcRenderer.once(event, (event, ...args) => callback(...args));
  },
  off: (event) => {
    ipcRenderer.removeAllListeners(event);
  },
  // Expose the file existence check function
  checkFileExistence: (filePath) =>
    ipcRenderer.invoke('check-file-existence', filePath),

  // Expose the download function
  downloadMedia: (url, filename, savePath) =>
    ipcRenderer.send('download-media', { url, filename, savePath }),

  checkUrl: (url) => ipcRenderer.invoke('check-url', url),
});

contextBridge.exposeInMainWorld('version', {
  arch: process.arch,
  platform: process.platform,
});

ipcRenderer.once('port', ({ ports }) => {
  contextBridge.exposeInMainWorld('port', {
    onmessage: (cb) => {
      ports[0].onmessage = ({ type, data }) => cb({ type, data });
    },
    postMessage: (a, b) => {
      ports[0].postMessage(a, b);
    },
  });
});
