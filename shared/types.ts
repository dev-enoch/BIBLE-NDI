export interface Verse {
  id: number;
  book: number;
  chapter: number;
  verse: number;
  text: string;
}

export interface BibleVersion {
  /** Filename without path, e.g. "kjv.sqlite" */
  id: string;
  /** Human-readable name from meta table or derived from filename */
  name: string;
}

export interface BibleAPI {
  getChapterCount: (book: number) => Promise<number>;
  getVerseCount: (book: number, chapter: number) => Promise<number>;
  getVerse: (
    book: number,
    chapter: number,
    verse: number,
  ) => Promise<Verse | null>;
  listVersions: () => Promise<BibleVersion[]>;
  setVersion: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

export interface NdiAPI {
  isAvailable: () => Promise<boolean>;
  start: (
    viewId: string,
    channelName: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  stop: (viewId: string) => Promise<{ ok: boolean }>;
  updateContent: (viewId: string, payload: unknown) => Promise<{ ok: boolean }>;
}

declare global {
  interface Window {
    bibleAPI: BibleAPI;
    ndiAPI: NdiAPI;
  }
}
