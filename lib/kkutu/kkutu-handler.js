const events = require('events');

class KkutuHandler extends events {
  constructor(webview) {
    super();
    this.browser = webview;
    this.isMyTurn = false;
    this.currentChain = 0;
    this.lastUseWord = '';
    this.lastStartWord = '';
    this.startListen();
  }

  async execute(str) {
    return this.browser.executeJavaScript(str);
  }

  async getIsMyTurn() {
    let gameInput = await this.execute(
      `document.getElementsByClassName("game-input")[0]?.style?.display`,
    );

    return gameInput == 'block';
  }

  async getStartWord() {
    let startWord = await this.execute(
      `document.getElementsByClassName("jjo-display ellipse")[0]?.innerText`,
    );

    if (startWord && this.isValidStartWord(startWord)) {
      return startWord;
    }
    return '';
  }

  async getFailText() {
    let failText = await this.execute(
      `document.getElementsByClassName("game-fail-text")[0]?.innerText`,
    );

    return failText || '';
  }

  isValidStartWord(str) {
    if (str.length == 1) return true;
    return /[가-힣a-z]\([가-힣a-z]\)/.test(str);
  }

  async getLatestWord() {
    let lastWord = await this.execute(
      `document.getElementsByClassName("ellipse history-item expl-mother")[0]?.innerHTML`,
    );

    if (lastWord) return lastWord.split('<')[0];
    return null;
  }

  async getChain() {
    let chain = await this.execute(
      `document.getElementsByClassName("chain")[0]?.innerText`,
    );

    return Number(chain);
  }

  async getMission() {
    let mission = await this.execute(
      `document.getElementsByClassName("items")[0]?.innerText`,
    );

    return mission || '';
  }

  async startListen() {
    while (true) {
      this.getIsMyTurn()
        .then(async (result) => {
          if (result != this.isMyTurn) {
            this.isMyTurn = result;
            let startWord = await this.getStartWord();
            this.emit('turn_changed', this.isMyTurn, startWord);
          }
        })
        .then(() => {
          this.getStartWord().then((result) => {
            if (
              result &&
              this.lastStartWord != result &&
              !this.lastStartWord.includes(result)
            ) {
              this.lastStartWord = result;
              this.emit('start_word', result, this.isMyTurn);
            }
          });
        });

      this.getFailText().then((result) => {
        if (result)
          this.emit('invalid_word', this.isMyTurn, this.lastStartWord, result);
      });

      this.getLatestWord().then((result) => {
        if (result && result != this.lastUseWord) {
          this.lastUseWord = result;
          this.emit('latest_word', result);
        }
      });

      this.getChain().then((chain) => {
        if (!isNaN(chain) && this.currentChain != chain) {
          this.currentChain = chain;
          if (chain === 0) this.emit('new_round');
        }
      });

      await this.delay(60);
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

exports.KkutuHandler = KkutuHandler;
