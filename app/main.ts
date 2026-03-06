import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import {
  getChapterCount,
  getVerseCount,
  getVerse,
  listVersions,
  setVersion,
} from "./database";
import {
  ensureOutput,
  updateContent,
  startNdi,
  stopNdi,
  destroyAll,
  type OutputPayload,
} from "./outputWindow";
import { isNdiAvailable, ndiShutdown } from "./ndi";
import {
  startControlServer,
  stopControlServer,
  broadcastState,
  setNavigateCallback,
} from "./controlServer";

let mainWindow: BrowserWindow;

// ─── Offscreen output windows (one per view) ──────────────────────────────────

const OUTPUT_CONFIGS = [
  { viewId: "ls", width: 1280, height: 720 },
  { viewId: "pt", width: 720, height: 1280 },
  { viewId: "lt", width: 1280, height: 180 },
] as const;

function initOutputWindows() {
  for (const { viewId, width, height } of OUTPUT_CONFIGS) {
    ensureOutput(viewId, width, height);
  }
}

// ─── Main window ──────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
}

// ─── IPC: Bible ───────────────────────────────────────────────────────────────

ipcMain.handle("get-chapter-count", (_e, book: number) =>
  getChapterCount(book),
);
ipcMain.handle("get-verse-count", (_e, book: number, chapter: number) =>
  getVerseCount(book, chapter),
);
ipcMain.handle(
  "get-verse",
  (_e, book: number, chapter: number, verse: number) =>
    getVerse(book, chapter, verse),
);
ipcMain.handle("list-versions", () => listVersions());
ipcMain.handle("set-version", (_e, id: string) => setVersion(id));

// ─── IPC: NDI / Output ────────────────────────────────────────────────────────

/** Push updated content to an offscreen output window. */
ipcMain.handle(
  "output-update",
  (_e, viewId: string, payload: OutputPayload) => {
    updateContent(viewId, payload);
    return { ok: true };
  },
);

/** Start NDI for a view. Creates the NDI sender and begins frame capture. */
ipcMain.handle("ndi-start", (_e, viewId: string, channelName: string) => {
  if (!isNdiAvailable()) {
    return {
      ok: false,
      error:
        "NDI runtime not available. Install the NDI SDK and run: yarn rebuild-ndi",
    };
  }
  const ok = startNdi(viewId, channelName);
  return ok
    ? { ok: true }
    : { ok: false, error: "Failed to create NDI sender" };
});

/** Stop NDI for a view. */
ipcMain.handle("ndi-stop", (_e, viewId: string) => {
  stopNdi(viewId);
  return { ok: true };
});

/** Check whether the NDI addon is loaded and functional. */
ipcMain.handle("ndi-available", () => isNdiAvailable());

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  initOutputWindows();

  // ─── OBS control panel ────────────────────────────────────────────────────
  startControlServer(9876);

  // When the dock posts a navigate command, forward it to the renderer.
  setNavigateCallback((cmd) => {
    mainWindow.webContents.send("navigate-to", cmd);
  });

  // When the renderer pushes a new navigation state, broadcast via SSE.
  ipcMain.on("state-push", (_e, state) => {
    broadcastState(state);
  });

  // Toggle the control server on/off from the renderer UI.
  ipcMain.handle("obs-dock-toggle", (_e, enable: boolean) => {
    if (enable) startControlServer(9876);
    else stopControlServer();
    return { ok: true };
  });
});

app.on("before-quit", () => {
  destroyAll();
  ndiShutdown();
});
