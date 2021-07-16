import { DataBaseManager, WordSchema } from './database';

export class WordManager {
  db: DataBaseManager;

  constructor(dbPath: string) {
    this.db = new DataBaseManager(dbPath);
  }

  addDetectedWords(words: string[]) {
    return this.db.addToNewWordList(words);
  }

  addInvalidWords(words: string[]) {
    return this.db.addToFailWordList(words);
  }
}

class WordStore {
  wordMap: Map<string, WordSchema[]>;
  lastKey: string;

  constructor() {
    this.wordMap = new Map<string, WordSchema[]>();
    this.lastKey = '';
  }

  addWord(startKey: string, words: WordSchema[]) {
    this.lastKey = startKey;
  }

  removeWord(startKey: string, word: string) {
    const words = this.wordMap.get(startKey);

    if (words)
      this.wordMap.set(
        startKey,
        words.filter((x) => x.value != word),
      );
  }

  getWords(startKey: string, mission: string, maxLength: number = 100) {}

  lastWords() {
    return this.wordMap.get(this.lastKey);
  }
}
