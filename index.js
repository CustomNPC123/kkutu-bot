"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const url_1 = __importDefault(require("url"));
const word_manager_1 = require("./lib/kkutu/word-manager");
const interface_1 = require("./lib/interface");
const wordManager = new word_manager_1.WordManager('./kkutu.db');
let win;
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
    const image = electron_1.nativeImage.createFromPath(__dirname + '/icon/icon.png');
    image.setTemplateImage(true);
    win = new electron_1.BrowserWindow({
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
    win.loadURL(url_1.default.format({
        pathname: path_1.default.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true,
    }));
    // F12
    // win.webContents.openDevTools({ mode: 'undocked' });
    win.on('closed', () => {
        win = null;
    });
}
electron_1.app.on('ready', createWindow);
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    // macOS에서 독 아이콘이 클릭되고 다른 창은 열리지 않는다.
    if (!win) {
        createWindow();
    }
});
electron_1.ipcMain.on('lookup_words', (event, data) => __awaiter(void 0, void 0, void 0, function* () {
    const queryResult = yield wordManager.db.getWord(data.startWords.map((x) => x + '%'), data.overlaps, data.mission, 100);
    event.sender.send('lookup_words', {
        result: queryResult.result,
        elapsed: queryResult.elapsedTime,
    });
}));
electron_1.ipcMain.on('detected_words', (event, data) => __awaiter(void 0, void 0, void 0, function* () {
    const queryResult = yield wordManager.addDetectedWords(data.words);
    event.sender.send('detected_words', queryResult);
}));
electron_1.ipcMain.on('invalid_words', (event, data) => __awaiter(void 0, void 0, void 0, function* () {
    const queryResult = yield wordManager.addInvalidWords(data.words);
    event.sender.send('invalid_words', queryResult);
}));
electron_1.ipcMain.on('add_words', (event, data) => __awaiter(void 0, void 0, void 0, function* () {
    const queryResult = yield wordManager.db.addWord(data.words);
    wordManager.db.resetPendingNewWords();
    event.sender.send('add_words', queryResult);
}));
electron_1.ipcMain.on('remove_words', (event, data) => __awaiter(void 0, void 0, void 0, function* () {
    const queryResult = yield wordManager.db.removeWord(data.words);
    wordManager.db.resetPendingInvalidWords();
    event.sender.send('remove_words', queryResult);
}));
electron_1.ipcMain.on('lookup_pending_words', (event, data) => __awaiter(void 0, void 0, void 0, function* () {
    let queryResult;
    if (data.mode == interface_1.WordMode.ADD)
        queryResult = yield wordManager.db.getPendingNewWords();
    else
        queryResult = yield wordManager.db.getPendingInvalidWords();
    event.sender.send('lookup_pending_words', queryResult);
}));
electron_1.ipcMain.on('get_all_words', (event) => __awaiter(void 0, void 0, void 0, function* () {
    event.sender.send('get_all_words', yield wordManager.db.getWord('%', [], undefined, 1000000000));
}));
