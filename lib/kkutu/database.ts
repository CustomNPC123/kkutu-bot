import { Database, verbose } from 'sqlite3';

export class DataBaseManager {
  db: Database;

  constructor(dbPath: string) {
    const sqlite = verbose();
    this.db = new sqlite.Database(dbPath);
  }

  getWord(
    formatString: string | string[],
    overlaps: string[] = [],
    mission?: string,
    maxLength: number = 100,
  ): Promise<GetWordResult> {
    let missionQuery = '';
    let filteringQuery = '';
    let limitQuery = '';
    let whereQuery = '';
    if (mission)
      missionQuery = `LENGTH(value) - LENGTH(REPLACE(value, "${mission}", '')) DESC, `;
    if (overlaps.length > 0)
      filteringQuery = `AND value NOT IN (${this.formatValues(overlaps)})`;
    if (maxLength) limitQuery = `LIMIT ${maxLength}`;
    if (typeof formatString == 'object')
      whereQuery = `(${formatString
        .map((x) => `value LIKE "${x}"`)
        .join(' OR ')})`;
    else whereQuery = `value LIKE "${formatString}"`;

    return new Promise<GetWordResult>((resolve, reject) => {
      const startTime = Date.now();
      this.db.all(
        `SELECT * FROM words WHERE ${whereQuery} ${filteringQuery} ORDER BY ${missionQuery} LENGTH(value) DESC ${limitQuery}`,
        (err, res) => {
          if (!err) {
            resolve({
              elapsedTime: Date.now() - startTime,
              result: res,
            });
          } else reject(err);
        },
      );
    });
  }

  addWord(words: string[]): Promise<DefaltQueryResult> {
    return new Promise<DefaltQueryResult>((resolve) => {
      const startTime = Date.now();
      this.db.run(
        `INSERT OR REPLACE INTO words(value) VALUES ${this.formatToArray(
          words,
        )}`,
        () => {
          resolve({ elapsedTime: Date.now() - startTime });
        },
      );
    });
  }

  removeWord(words: string[]): Promise<DefaltQueryResult> {
    return new Promise<DefaltQueryResult>((resolve) => {
      const startTime = Date.now();
      this.db.run(
        `DELETE FROM words WHERE value IN (${this.formatValues(words)})`,
        () => {
          resolve({ elapsedTime: Date.now() - startTime });
        },
      );
    });
  }

  async addToNewWordList(words: string[]) {
    const startTime = Date.now();
    const alreadyHasWords = await new Promise<DefaultWordSchema[]>(
      (resolve) => {
        this.db.all(
          `SELECT value FROM words WHERE value IN(${this.formatValues(words)})`,
          (err, res) => resolve(res),
        );
      },
    );

    const filteredWords = words.filter(
      (x) => !alreadyHasWords.some((y) => y.value == x),
    );

    return await new Promise<
      DefaltQueryResult & { success: number; exists: number }
    >((resolve) => {
      this.db.run(
        `INSERT OR REPLACE INTO detected_words(value) VALUES ${this.formatToArray(
          filteredWords,
        )}`,
        () => {
          resolve({
            elapsedTime: Date.now() - startTime,
            success: filteredWords.length,
            exists: alreadyHasWords.length,
          });
        },
      );
    });
  }

  async addToFailWordList(words: string[]) {
    const startTime = Date.now();
    const existWords = await new Promise<DefaultWordSchema[]>((resolve) => {
      this.db.all(
        `SELECT value FROM words WHERE value IN(${this.formatValues(words)})`,
        (err, res) => resolve(res),
      );
    });

    return await new Promise<
      DefaltQueryResult & { success: number; exists: number }
    >((resolve) => {
      this.db.run(
        `INSERT OR REPLACE INTO failed_words(value) VALUES ${this.formatToArray(
          existWords.map((x) => x.value),
        )}`,
        () => {
          resolve({
            elapsedTime: Date.now() - startTime,
            success: existWords.length,
            exists: words.length - existWords.length,
          });
        },
      );
    });
  }

  getPendingNewWords() {
    return new Promise<DefaultWordSchema[]>((resolve) => {
      this.db.all(`SELECT value FROM detected_words`, (err, res) => {
        resolve(res);
      });
    });
  }

  getPendingInvalidWords() {
    return new Promise<DefaultWordSchema[]>((resolve) => {
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

  private formatValues(args: any[]) {
    return args.map((x) => JSON.stringify(x)).join(', ');
  }

  private formatToArray(args: any[]) {
    return args.map((x) => `("${x}")`).join(', ');
  }
}

interface DefaltQueryResult {
  readonly elapsedTime: number;
}

export interface GetWordResult extends DefaltQueryResult {
  result: WordSchema[];
}

export interface DefaultWordSchema {
  value: string;
}

export interface WordSchema extends DefaultWordSchema {
  id: number;
}
