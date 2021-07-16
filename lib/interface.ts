export interface LookupReq {
  startWords: string[];
  overlaps: string[];
  mission?: string;
}

export interface DBWordReq {
  words: string[];
}

export interface LookupPendingReq {
  mode: WordMode;
}

export enum WordMode {
  ADD,
  DELETE,
}
