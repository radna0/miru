import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs/promises'; // Use fs/promises for promise-based file operations
import App from './app.js';
import { download, CancelError } from 'electron-dl';
// Keep a global reference of the window object
let main;

function createWindow() {
  main = new App();
}

// Handle file existence check requests
ipcMain.handle('check-file-existence', async (event, filePath) => {
  const possible_formats = ['.mp4', '.avi', '.mov', '.mkv'];

  for (let i = 0; i < possible_formats.length; i++) {
    try {
      const file = filePath + possible_formats[i];
      await fs.access(file);
      return true;
    } catch (error) {
      console.error(error);
    }
  }
  return false;
});

const MAX_RETRIES = 3; // Number of retries

// Handle media download requests
ipcMain.on('download-media', async (event, { url, filename, savePath }) => {
  const win = BrowserWindow.getFocusedWindow();

  try {
    const result = await download(win, url, {
      directory: savePath,
      filename: filename,
      onProgress: (progress) =>
        console.log(`Progress: ${progress.percent * 100}%`),
    });
    event.reply('download-complete');
    console.log('Download complete:', result);
  } catch (error) {
    event.reply('download-error');
    console.error('Download error:', error);
  }
});

app.on('ready', createWindow);

app.on('activate', () => {
  if (main === null) createWindow();
});
