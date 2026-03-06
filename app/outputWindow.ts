/**
 * Manages hidden offscreen BrowserWindow instances — one per NDI output.
 *
 * Each window renders the same slate content as a preview but at full
 * native resolution (e.g. 1280×720). When NDI is live, the main process
 * captures frames via webContents.capturePage() and forwards them to NDI.
 */

import { BrowserWindow } from "electron";
import path from "path";
import { ndiCreate, ndiSendBgra, ndiDestroy } from "./ndi";

export type OutputType = "slate" | "lowerThird";

export interface OutputPayload {
  text: string;
  reference: string;
  /** JSON-serialised ViewSettings */
  settings: unknown;
  type: OutputType;
  width: number;
  height: number;
}

interface OutputEntry {
  win: BrowserWindow;
  width: number;
  height: number;
  captureInterval: ReturnType<typeof setInterval> | null;
  channelName: string | null;
}

const outputs = new Map<string, OutputEntry>();

// ─── Window lifecycle ──────────────────────────────────────────────────────────

export function ensureOutput(
  viewId: string,
  width: number,
  height: number,
): void {
  if (outputs.has(viewId)) return; // already exists

  const win = new BrowserWindow({
    width,
    height,
    show: false,
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      offscreen: true,
      contextIsolation: true,
      preload: path.join(__dirname, "output-preload.js"),
    },
  });

  win.loadFile(path.join(__dirname, "../renderer/output.html"));

  outputs.set(viewId, {
    win,
    width,
    height,
    captureInterval: null,
    channelName: null,
  });
}

export function destroyOutput(viewId: string): void {
  const entry = outputs.get(viewId);
  if (!entry) return;
  stopNdi(viewId);
  entry.win.destroy();
  outputs.delete(viewId);
}

export function destroyAll(): void {
  for (const viewId of [...outputs.keys()]) destroyOutput(viewId);
}

// ─── Content update ────────────────────────────────────────────────────────────

/** Push new verse / settings down to an offscreen window. */
export function updateContent(viewId: string, payload: OutputPayload): void {
  const entry = outputs.get(viewId);
  if (!entry) return;

  // Resize the offscreen window if dimensions changed (e.g. portrait ratio switch,
  // or lower-third height differs from the initial window size).
  if (payload.width !== entry.width || payload.height !== entry.height) {
    entry.win.setContentSize(payload.width, payload.height);
    entry.width = payload.width;
    entry.height = payload.height;
  }

  // Wait until the renderer is ready before sending
  if (entry.win.webContents.isLoading()) {
    entry.win.webContents.once("did-finish-load", () => {
      entry.win.webContents.send("output-update", payload);
    });
  } else {
    entry.win.webContents.send("output-update", payload);
  }
}

// ─── NDI control ───────────────────────────────────────────────────────────────

const CAPTURE_FPS = 30;

export function startNdi(viewId: string, channelName: string): boolean {
  const entry = outputs.get(viewId);
  if (!entry) return false;

  // Stop any existing capture for this view
  stopNdi(viewId);

  // Create (or re-use) the NDI sender
  const ok = ndiCreate(channelName);
  if (!ok) return false;

  entry.channelName = channelName;

  entry.captureInterval = setInterval(
    () => {
      // Read dimensions from entry every frame so ratio changes take effect live.
      const { win, width, height } = entry;
      win.webContents
        .capturePage()
        .then((img) => {
          // toBitmap() returns raw BGRA pixels on Windows/Linux — matches our C++ FourCC
          const raw = img.toBitmap();
          const buf =
            raw.length === width * height * 4
              ? raw
              : img.resize({ width, height }).toBitmap();
          ndiSendBgra(channelName, width, height, buf);
        })
        .catch(() => {
          /* window may be destroyed — ignore */
        });
    },
    Math.round(1000 / CAPTURE_FPS),
  );

  return true;
}

export function stopNdi(viewId: string): void {
  const entry = outputs.get(viewId);
  if (!entry) return;

  if (entry.captureInterval !== null) {
    clearInterval(entry.captureInterval);
    entry.captureInterval = null;
  }

  if (entry.channelName) {
    ndiDestroy(entry.channelName);
    entry.channelName = null;
  }
}

export function isNdiLive(viewId: string): boolean {
  const entry = outputs.get(viewId);
  return !!entry?.captureInterval;
}
