import { app, BrowserWindow, ipcMain, nativeImage, dialog } from 'electron';
import path from 'path';
import url from 'url';
import { WordManager } from './lib/kkutu/word-manager';
import axios, { AxiosResponse } from 'axios';
import { machineId } from 'node-machine-id';
import {
  DBWordReq,
  LookupPendingReq,
  LookupReq,
  WordMode,
} from './lib/interface';

const wordManager = new WordManager('./kkutu.db');

let win: BrowserWindow | null;

/*
(async () => {
  try {
    const instance = axios.create({ timeout: 3000 });
    const myHwid = await machineId();
    const result = await instance.get<
      any,
      AxiosResponse<{ status: number; message: string }>
    >(`http://sv.steins.kr/api/hwid?hwid=${myHwid}&n=1`);

    if (result.data.status != 200) process.exit(0);
    else
      dialog.showMessageBox({
        title: '디바이스 체크',
        icon: undefined,
        message: result.data.message,
      });
  } catch (e) {
    app.quit();
    win = null;
    process.exit(0);
  }
})();
*/

function createWindow() {
  const image = nativeImage.createFromPath(__dirname + '/icon/icon.png');
  image.setTemplateImage(true);

  win = new BrowserWindow({
    width: 1700,
    height: 900,
    icon: image,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      allowRunningInsecureContent: true,
      webviewTag: true,
      devTools: true,
    },
  });

  win.removeMenu();

  win.loadURL(
    url.format({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file:',
      slashes: true,
    }),
  );

  // F12
  // win.webContents.openDevTools({ mode: 'undocked' });

  win.on('closed', () => {
    win = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // macOS에서 독 아이콘이 클릭되고 다른 창은 열리지 않는다.
  if (!win) {
    createWindow();
  }
});

ipcMain.on('lookup_words', async (event, data: LookupReq) => {
  const queryResult = await wordManager.db.getWord(
    data.startWords.map((x) => x + '%'),
    data.overlaps,
    data.mission,
    100,
  );

  event.sender.send('lookup_words', {
    result: queryResult.result,
    elapsed: queryResult.elapsedTime,
  });
});

ipcMain.on('detected_words', async (event, data: DBWordReq) => {
  const queryResult = await wordManager.addDetectedWords(data.words);
  event.sender.send('detected_words', queryResult);
});

ipcMain.on('invalid_words', async (event, data: DBWordReq) => {
  const queryResult = await wordManager.addInvalidWords(data.words);

  event.sender.send('invalid_words', queryResult);
});

ipcMain.on('add_words', async (event, data: DBWordReq) => {
  const queryResult = await wordManager.db.addWord(data.words);

  wordManager.db.resetPendingNewWords();
  event.sender.send('add_words', queryResult);
});

ipcMain.on('remove_words', async (event, data: DBWordReq) => {
  const queryResult = await wordManager.db.removeWord(data.words);

  wordManager.db.resetPendingInvalidWords();
  event.sender.send('remove_words', queryResult);
});

ipcMain.on('lookup_pending_words', async (event, data: LookupPendingReq) => {
  let queryResult;

  if (data.mode == WordMode.ADD)
    queryResult = await wordManager.db.getPendingNewWords();
  else queryResult = await wordManager.db.getPendingInvalidWords();

  event.sender.send('lookup_pending_words', queryResult);
});

ipcMain.on('get_all_words', async (event) => {
  event.sender.send(
    'get_all_words',
    await wordManager.db.getWord('%', [], undefined, 1000000000),
  );
});
