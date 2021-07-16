"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WordManager = void 0;
const database_1 = require("./database");
class WordManager {
    constructor(dbPath) {
        this.db = new database_1.DataBaseManager(dbPath);
    }
    addDetectedWords(words) {
        return this.db.addToNewWordList(words);
    }
    addInvalidWords(words) {
        return this.db.addToFailWordList(words);
    }
}
exports.WordManager = WordManager;
class WordStore {
    constructor() {
        this.wordMap = new Map();
        this.lastKey = '';
    }
    addWord(startKey, words) {
        this.lastKey = startKey;
    }
    removeWord(startKey, word) {
        const words = this.wordMap.get(startKey);
        if (words)
            this.wordMap.set(startKey, words.filter((x) => x.value != word));
    }
    getWords(startKey, mission, maxLength = 100) { }
    lastWords() {
        return this.wordMap.get(this.lastKey);
    }
}
