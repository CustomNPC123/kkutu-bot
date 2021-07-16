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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataBaseManager = void 0;
const sqlite3_1 = require("sqlite3");
class DataBaseManager {
    constructor(dbPath) {
        const sqlite = sqlite3_1.verbose();
        this.db = new sqlite.Database(dbPath);
    }
    getWord(formatString, overlaps = [], mission, maxLength = 100) {
        let missionQuery = '';
        let filteringQuery = '';
        let limitQuery = '';
        let whereQuery = '';
        if (mission)
            missionQuery = `LENGTH(value) - LENGTH(REPLACE(value, "${mission}", '')) DESC, `;
        if (overlaps.length > 0)
            filteringQuery = `AND value NOT IN (${this.formatValues(overlaps)})`;
        if (maxLength)
            limitQuery = `LIMIT ${maxLength}`;
        if (typeof formatString == 'object')
            whereQuery = `(${formatString
                .map((x) => `value LIKE "${x}"`)
                .join(' OR ')})`;
        else
            whereQuery = `value LIKE "${formatString}"`;
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            this.db.all(`SELECT * FROM words WHERE ${whereQuery} ${filteringQuery} ORDER BY ${missionQuery} LENGTH(value) DESC ${limitQuery}`, (err, res) => {
                if (!err) {
                    resolve({
                        elapsedTime: Date.now() - startTime,
                        result: res,
                    });
                }
                else
                    reject(err);
            });
        });
    }
    addWord(words) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            this.db.run(`INSERT OR REPLACE INTO words(value) VALUES ${this.formatToArray(words)}`, () => {
                resolve({ elapsedTime: Date.now() - startTime });
            });
        });
    }
    removeWord(words) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            this.db.run(`DELETE FROM words WHERE value IN (${this.formatValues(words)})`, () => {
                resolve({ elapsedTime: Date.now() - startTime });
            });
        });
    }
    addToNewWordList(words) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            const alreadyHasWords = yield new Promise((resolve) => {
                this.db.all(`SELECT value FROM words WHERE value IN(${this.formatValues(words)})`, (err, res) => resolve(res));
            });
            const filteredWords = words.filter((x) => !alreadyHasWords.some((y) => y.value == x));
            return yield new Promise((resolve) => {
                this.db.run(`INSERT OR REPLACE INTO detected_words(value) VALUES ${this.formatToArray(filteredWords)}`, () => {
                    resolve({
                        elapsedTime: Date.now() - startTime,
                        success: filteredWords.length,
                        exists: alreadyHasWords.length,
                    });
                });
            });
        });
    }
    addToFailWordList(words) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            const existWords = yield new Promise((resolve) => {
                this.db.all(`SELECT value FROM words WHERE value IN(${this.formatValues(words)})`, (err, res) => resolve(res));
            });
            return yield new Promise((resolve) => {
                this.db.run(`INSERT OR REPLACE INTO failed_words(value) VALUES ${this.formatToArray(existWords.map((x) => x.value))}`, () => {
                    resolve({
                        elapsedTime: Date.now() - startTime,
                        success: existWords.length,
                        exists: words.length - existWords.length,
                    });
                });
            });
        });
    }
    getPendingNewWords() {
        return new Promise((resolve) => {
            this.db.all(`SELECT value FROM detected_words`, (err, res) => {
                resolve(res);
            });
        });
    }
    getPendingInvalidWords() {
        return new Promise((resolve) => {
            this.db.all(`SELECT value FROM failed_words`, (err, res) => {
                resolve(res);
            });
        });
    }
    resetPendingNewWords() {
        this.db.run(`DELETE FROM detected_words`);
    }
    resetPendingInvalidWords() {
        this.db.run(`DELETE FROM failed_words`);
    }
    formatValues(args) {
        return args.map((x) => JSON.stringify(x)).join(', ');
    }
    formatToArray(args) {
        return args.map((x) => `("${x}")`).join(', ');
    }
}
exports.DataBaseManager = DataBaseManager;
