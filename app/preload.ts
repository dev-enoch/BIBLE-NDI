import { contextBridge, ipcRenderer } from "electron";

// ─── Bible API ────────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld("bibleAPI", {
  getChapterCount: (book: number): Promise<number> =>
    ipcRenderer.invoke("get-chapter-count", book),

  getVerseCount: (book: number, chapter: number): Promise<number> =>
    ipcRenderer.invoke("get-verse-count", book, chapter),

  getVerse: (
    book: number,
    chapter: number,
    verse: number,
  ): Promise<{
    id: number;
    book: number;
    chapter: number;
    verse: number;
    text: string;
  } | null> => ipcRenderer.invoke("get-verse", book, chapter, verse),

  listVersions: (): Promise<{ id: string; name: string }[]> =>
    ipcRenderer.invoke("list-versions"),

  setVersion: (id: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("set-version", id),

  /** Push current navigation state to the main process (→ OBS control panel). */
  pushState: (state: unknown): void => ipcRenderer.send("state-push", state),

  /** Register a callback that fires when the OBS control panel requests navigation. */
  onNavigateTo: (
    cb: (
      nav:
        | { action: "nextVerse" | "prevVerse" | "nextChapter" | "prevChapter" }
        | { book: number; chapter: number; verse: number },
    ) => void,
  ): void => {
    ipcRenderer.on("navigate-to", (_e, cmd) => cb(cmd));
  },
});

// ─── NDI API ──────────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld("ndiAPI", {
  /** Returns true if the NDI native addon is loaded and initialised. */
  isAvailable: (): Promise<boolean> => ipcRenderer.invoke("ndi-available"),

  /** Start NDI output for a view. */
  start: (
    viewId: string,
    channelName: string,
  ): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("ndi-start", viewId, channelName),

  /** Stop NDI output for a view. */
  stop: (viewId: string): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("ndi-stop", viewId),

  /** Push content to the offscreen output window for a view. */
  updateContent: (viewId: string, payload: unknown): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("output-update", viewId, payload),
});
