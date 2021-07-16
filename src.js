const { ipcRenderer } = require('electron');
const fs = require('fs');
const { KkutuHandler } = require('./lib/kkutu/kkutu-handler');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const WordModeEnum = {
  ADD: 0,
  DELETE: 1,
};

let kkutuHandler;

let isOptimizationMode = false;
let isAutoPlay = false;
let isLogging = true;
let isResending = false;
let checkPushWords = true;
let isCheckingWords = false;
let isCalledAbortChecking = false;

let lastGetWords = [];
let invalidWords = [];
let overlapWords = [];

let wordEditMode = WordModeEnum.ADD;

$(document).ready(jqueryMain);

function load() {
  window.webview.addEventListener(
    'dom-ready',
    () => {
      log('[DOM Ready] start main thread...');
      kkutuHandler = new KkutuHandler(window.webview);
      startMain();
    },
    { once: true },
  );
}

async function startMain() {
  kkutuHandler.on('turn_changed', async (isMyturn, startWord) => {
    if (isMyturn) {
      log(`[myTurn] word: ${startWord}`);

      let mission = await kkutuHandler.getMission();
      let value =
        startWord.length == 1 ? [startWord] : splitTwoSoundWord(startWord);

      log(`[단어 조회] 단어: ${value}, 미션: ${mission}`);

      let data = await IPCRequest('lookup_words', {
        startWords: value,
        overlaps: overlapWords,
        mission: mission,
      });

      log(`[단어 조회] Done! (${data.elapsed}ms)`);
      if (data.result.length === 0) log('입력 가능한 단어가 없습니다.');
      else {
        if (isAutoPlay) {
          overlapWords.push(data.result[0].value);
          sendText(data.result[0].value);
          lastGetWords = data.result.map((x) => x.value);
          lastGetWords.shift();
        }
      }
      isResending = false;

      if (!isOptimizationMode) setRows(data.result, data.elapsed);
    }
    $('#turn').text(`myTurn: ${isMyTurn}`);
  });

  kkutuHandler.on('invalid_word', (isMyTurn, startWord, word) => {
    log(
      `[invalidWord] myTurn: ${isMyTurn}, startWord: ${startWord}, word: ${word}`,
    );
    if (!invalidWords.includes(word) && !word.includes(':'))
      invalidWords.push(word);

    if (isMyTurn && !isResending && isAutoPlay) {
      isResending = true;
      if (lastGetWords.length > 0) {
        sendText(lastGetWords[0]);
        lastGetWords.shift();
      } else log(`입력 가능한 단어가 없습니다.`);
      isResending = false;
    }
  });

  kkutuHandler.on('latest_word', (word) => {
    overlapWords.push(word);
    log(`[latestWord] word: ${word}`);
  });

  kkutuHandler.on('start_word', async (startWord, isMyTurn) => {
    log(`[startWord] startWord: ${startWord}`);
    if (isOptimizationMode || isMyTurn) return;

    let mission = await kkutuHandler.getMission();
    let value;
    if (startWord.length == 1) value = [startWord];
    else value = splitTwoSoundWord(startWord);

    searchWord(value, overlapWords, mission);
  });

  kkutuHandler.on('new_round', () => {
    IPCRequest('detected_words', { words: overlapWords.slice() }).then((x) => {
      log(
        `${x.success}개의 신규단어 추가, ${x.exists}개의 중복등록 감지(${x.elapsedTime}ms)`,
      );
    });

    IPCRequest('invalid_words', { words: invalidWords.slice() }).then((x) => {
      log(
        `${x.success}개의 올바르지 않은 단어 추가, ${x.exists}개의 중복등록 감지(${x.elapsedTime}ms)`,
      );
    });

    overlapWords = [];
    invalidWords = [];
    isResending = false;
    log(`Round Reset`);
  });
}

async function submitWords() {
  let words = $('#editWord')
    .val()
    .split('\n')
    .map((x) => x.trim())
    .filter((x) => x);

  if (words.length == 0) log('1개 이상의 단어를 입력해주세요.');
  else {
    if (checkPushWords) {
      if (isCheckingWords) {
        log('이미 단어를 검증중입니다!');
        return;
      }
      await checkingCommitWords(words, wordEditMode);
    } else {
      if (wordEditMode == WordModeEnum.ADD) {
        await IPCRequest('add_words', { words: words }).then((x) => {
          log(`[단어장 커밋] 추가(${x.elapsedTime}ms)`);
        });
      } else {
        let deleteWords = nowWords.filter((x) => !verifiedWords.includes(x));
        await IPCRequest('remove_words', { words: words }).then((x) => {
          log(`[단어장 커밋] 삭제(${x.elapsedTime}ms)`);
        });
      }
    }

    $('#editWord').val('');
  }
}

function lookupPendingWords() {
  IPCRequest('lookup_pending_words', { mode: wordEditMode }).then((x) => {
    $('#editWord').val(x.map((x) => x.value).join('\n'));
  });
}

function setLoading(min, max) {
  $('#loadingBar').val((min / max) * 100);
  $('#loadingText').text(`[${min} / ${max}]`);
}

function setVisibleLoading(visible) {
  if (visible) $('#loadingConatainer').show();
  else $('#loadingConatainer').hide();
}

async function checkingCommitWords(
  words,
  mode,
  verificationFunction = () => true,
) {
  let verifiedWords = [];
  const rng = 100;

  if (isCheckingWords) {
    log('이미 검증중입니다.');
    return;
  }

  isCheckingWords = true;
  setVisibleLoading(true);

  for (let i = 0, len = words.length / rng; i < len; i++) {
    let nowWords = words.slice(i * rng, i * rng + rng);

    for (let j in nowWords) {
      let response = await requestWord(nowWords[j]);

      if (response.word && !response.error && verificationFunction(response))
        verifiedWords.push(nowWords[j]);
      setLoading(i * rng + j * 1 + 1, words.length);

      if (isCalledAbortChecking) {
        log('단어 검증이 중지되었습니다.');
        isCalledAbortChecking = false;
        isCheckingWords = false;
        setVisibleLoading(false);
        return;
      }
    }

    if (mode == WordModeEnum.ADD) {
      let ipcRes = await IPCRequest('add_words', { words: verifiedWords });
      log(
        `[단어장 커밋] 추가(${ipcRes.elapsedTime}ms), ${
          verifiedWords.length
        }개, 올바르지않은 단어 ${nowWords.length - verifiedWords.length}개`,
      );
    } else {
      let deleteWords = nowWords.filter((x) => !verifiedWords.includes(x));
      let ipcRes = await IPCRequest('remove_words', { words: deleteWords });

      log(
        `[단어장 커밋] 삭제(${ipcRes.elapsedTime}ms), ${deleteWords.length}개`,
      );
    }
    verifiedWords = [];
  }
  isCheckingWords = false;
  setVisibleLoading(false);

  log('검증이 완료되었습니다.');
}

function splitTwoSoundWord(str) {
  return [str[0], str.slice(2, 3)];
}

async function sendText(text) {
  try {
    await execute(
      `document.querySelectorAll('[maxlength=\"${config.input.maxlength}\"]')[${config.input.index}].value = '${text}'`,
    );
    await execute(
      `document.querySelector(\"#${config.send.clsName}\").click();`,
    );
  } catch (e) {
    log(String(e));
  }
}

function execute(str) {
  return window.webview.executeJavaScript(str);
}

async function requestWord(word) {
  let lang = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/g.test(word) ? 'ko' : 'en';

  let res = new Promise((resolve) => {
    window.webview.addEventListener(
      'ipc-message',
      (event) => {
        resolve(event.args[0]);
      },
      { once: true },
    );
  });

  window.webview.send('lookup', word, lang);

  return await res;
}

async function validateAllWords() {
  let words = await IPCRequest('get_all_words');
  let mapped = [];

  for (let i of words.result) mapped.push(i.value);

  await checkingCommitWords(
    mapped,
    WordModeEnum.DELETE,
    (v) => v.type != '5' && v.type != '6',
  );
}

function preventCheckWords() {
  isCalledAbortChecking = true;
}

async function IPCRequest(eventName, ...args) {
  let res = new Promise((resolve) => {
    ipcRenderer.once(eventName, (event, data) => {
      resolve(data);
    });
  });

  ipcRenderer.send(eventName, ...args);

  return await res;
}

function log(text) {
  if (!isLogging) return;
  let logElement = document.getElementById('logbox');
  logElement.value += `${getFormatTimeStamp()} ${text}\n`;
  logElement.scrollTop = logElement.scrollHeight;
}

function getTimeStamp() {
  let day = new Date();
  return `${day.getFullYear()}-${
    day.getMonth() + 1
  }-${day.getDate()}T${day.getHours()}:${day.getMinutes()}:${day.getSeconds()}`;
}

function getFormatTimeStamp() {
  return `[${getTimeStamp()}]`;
}

function clearRowData() {
  $('#passList > tbody:last').empty();
}

function setRows(wordStruct, elapsed) {
  clearRowData();
  addRow(wordStruct);
}

function addRow(array) {
  let res = '';
  for (let i = 0; i < array.length; i++)
    res += `<tr><td>${array[i].id}</td><td>${array[i].value}</td></tr>`;

  $('#passList > tbody:last').append(res);
}

async function searchWord(strs, overlaps, mission) {
  log(`[단어 조회] 단어: ${strs}, 미션: ${mission}`);
  let data = await IPCRequest('lookup_words', {
    startWords: strs,
    overlaps: overlaps,
    mission: mission,
  });

  $('#elapsed').text(`소요시간: ${data.elapsed}ms`);
  log(`Done! (${data.elapsed}ms)`);

  setRows(data.result, data.elapsed);
}

function jqueryMain() {
  $(() => {
    $('#textarea').on('keydown', (event) => {
      if (event.keyCode == 13) {
        $('#textarea').submit();
        event.preventDefault();
      }
    });

    $('#textarea').on('submit', () => {
      sendText($('#textarea').val());
      $('#textarea').val('');
    });

    $('#searchWordInput').on('keydown', (event) => {
      if (event.keyCode == 13) {
        $('#searchWordInput').submit();
        event.preventDefault();
      }
    });

    $('#searchWordInput').on('submit', () => {
      searchWord([$('#searchWordInput').val()]);
      $('#searchWordInput').val('');
    });

    $('#verificationWord').on('keydown', (event) => {
      if (event.keyCode == 13) {
        $('#verificationWord').submit();
        event.preventDefault();
      }
    });

    $('#verificationWord').on('submit', async () => {
      let res = await requestWord([$('#verificationWord').val()]);
      $('#verificationWord').val('');

      log(JSON.stringify(res));
    });

    $('#chkOptimization').change(() => {
      isOptimizationMode = $('#chkOptimization').is(':checked');

      if (isOptimizationMode) $('#passList').hide();
      else $('#passList').show();

      log(`최적화모드 ${onOff(isOptimizationMode)}`);
    });

    $('#checkingWord').change(() => {
      checkPushWords = $('#checkingWord').is(':checked');
    });

    $('#chkAutoRun').change(() => {
      isAutoPlay = $('#chkAutoRun').is(':checked');
      log(`자동입력 ${onOff(isAutoPlay)}`);
    });

    $('#chkLog').change(() => {
      let _isLogging = $('#chkLog').is(':checked');
      if (isLogging) {
        log(`로그 ${onOff(_isLogging)}`);
        isLogging = _isLogging;
      } else {
        isLogging = _isLogging;
        log(`로그 ${onOff(_isLogging)}`);
      }
      isLogging = $('#chkLog').is(':checked');
    });

    $('#passList > tbody').delegate('tr', 'click', function () {
      let value = $(this).children('td').eq(1).text();
      log(`[단어 전송] ${value}`);
      sendText(value);
    });

    $('input[name=wordMode]').change(() => {
      if ($('#addWord').is(':checked')) wordEditMode = WordModeEnum.ADD;
      else wordEditMode = WordModeEnum.DELETE;

      $('#editWord').val('');
    });
  });
}

function onOff(value) {
  return value ? 'On' : 'Off';
}
