const { ipcRenderer } = require('electron');

ipcRenderer.on('lookup', async (event, word, lang) => {
  let data = await fetch(`https://kkutu.co.kr/o/dict/${word}?lang=${lang}`);

  ipcRenderer.sendToHost('lookup', await data.json());
});
