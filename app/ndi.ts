/**
 * NDI native addon wrapper.
 *
 * Loads the compiled ndi_sender.node addon gracefully — if the NDI SDK is
 * not installed or the addon hasn't been built, every function is a no-op
 * and `isNdiAvailable()` returns false.
 *
 * Build the addon:
 *   1. Install the NDI 6 SDK from https://ndi.tv/sdk/
 *      (headers + .lib needed at compile time)
 *   2. yarn rebuild-ndi  (also copies the runtime DLL into build/Release)
 *
 * Runtime DLL discovery order (Windows):
 *   1. Bundled DLL (native/ndi-sender/build/Release) — copied by rebuild-ndi
 *   2. NDI_RUNTIME_DIR env var (user override)
 *   3. NDI 6 Runtime → NDI 6 SDK Bin → NDI 5 SDK Bin
 *   4. Dynamic scan of C:\Program Files\NDI\*
 */

import fs from "fs";
import path from "path";

interface NdiAddon {
  ndiInit(): boolean;
  ndiCreate(name: string): boolean;
  ndiSendBgra(name: string, width: number, height: number, data: Buffer): void;
  ndiDestroy(name: string): void;
  ndiShutdown(): void;
}

let addon: NdiAddon | null = null;
let _available = false;

// ─── Path helpers (dev vs packaged asar) ────────────────────────────────────
// In a packaged app, __dirname sits inside app.asar (virtual). Native files
// land in app.asar.unpacked instead, so we remap the project root accordingly.

function projectRoot(): string {
  if (__dirname.includes("app.asar")) {
    // Go up two levels from dist/app to app.asar, then switch to unpacked.
    return path
      .dirname(path.dirname(__dirname))
      .replace("app.asar", "app.asar.unpacked");
  }
  return path.resolve(__dirname, "../..");
}

// ─── Runtime DLL discovery ────────────────────────────────────────────────────
// Add every known NDI DLL directory to PATH so the OS linker can find the DLL
// when the native addon is loaded. This is idempotent and safe to call early.

function scanNdiDirs(): string[] {
  if (process.platform !== "win32") return [];
  const found: string[] = [];
  const roots = [
    "C:\\Program Files\\NDI",
    ...(process.env.ProgramFiles ? [process.env.ProgramFiles + "\\NDI"] : []),
  ];
  const dll = "Processing.NDI.Lib.x64.dll";

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    try {
      for (const entry of fs.readdirSync(root)) {
        const dir = path.join(root, entry);
        // Check this dir depth directly
        if (fs.existsSync(path.join(dir, dll))) {
          found.push(dir);
          continue;
        }
        // One level deeper (e.g. "NDI 6 Runtime/v6")
        try {
          for (const sub of fs.readdirSync(dir)) {
            const subDir = path.join(dir, sub);
            if (fs.existsSync(path.join(subDir, dll))) found.push(subDir);
          }
        } catch {
          /* not iterable */
        }
      }
    } catch {
      /* can't read root */
    }
  }
  return found;
}

function findNdiRuntimeDirs(): string[] {
  if (process.platform !== "win32") return [];

  const candidates: Array<string | undefined> = [
    // Bundled DLL — copied next to ndi_sender.node by yarn rebuild-ndi / yarn copy-ndi-dll
    path.join(projectRoot(), "native", "ndi-sender", "build", "Release"),
    process.env.NDI_RUNTIME_DIR, // user override
    // NDI 6 Runtime (DLL-only install)
    "C:\\Program Files\\NDI\\NDI 6 Runtime\\v6",
    "C:\\Program Files\\NDI\\NDI 6 Runtime",
    // NDI 6 SDK Bin (if full SDK installed)
    "C:\\Program Files\\NDI\\NDI 6 SDK\\Bin\\x64",
    "C:\\Program Files\\NDI\\NDI Advanced SDK 6\\Bin\\x64",
    // NDI 5 fallback
    "C:\\Program Files\\NDI\\NDI 5 SDK\\Bin\\x64",
    "C:\\Program Files\\NDI\\NDI 5 Runtime",
    // Dynamic scan catches anything not listed above
    ...scanNdiDirs(),
  ];

  return candidates.filter(
    (d): d is string => typeof d === "string" && fs.existsSync(d),
  );
}

function prependNdiDirsToPath(): void {
  const dirs = findNdiRuntimeDirs();
  if (dirs.length === 0) return;

  const currentPath = process.env.PATH ?? "";
  const toAdd = dirs.filter((d) => !currentPath.includes(d));
  if (toAdd.length === 0) return;

  process.env.PATH = [...toAdd, currentPath].join(path.delimiter);
  console.log("[NDI] Added Runtime dirs to PATH:", toAdd);
}

// ─── Addon loading ────────────────────────────────────────────────────────────

function tryLoad(): void {
  if (addon !== null) return;
  // Add NDI Runtime dir to PATH before loading the .node so the OS finds the DLL
  prependNdiDirsToPath();

  try {
    const addonPath = path.join(
      projectRoot(),
      "native",
      "ndi-sender",
      "build",
      "Release",
      "ndi_sender.node",
    );
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const raw = require(addonPath) as NdiAddon;
    const ok = raw.ndiInit();
    if (!ok) {
      console.warn(
        "[NDI] NDIlib_initialize() returned false — NDI Runtime may be missing.",
      );
      return;
    }
    addon = raw;
    _available = true;
    console.log("[NDI] Initialized successfully");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[NDI] Addon load failed:", msg);
    console.warn(
      "[NDI] Build the addon first: yarn rebuild-ndi  (NDI 6 SDK required)",
    );
  }
}

// Attempt to load once at module import time
tryLoad();

export function isNdiAvailable(): boolean {
  return _available;
}

/** Create a named NDI sender. Returns true on success. */
export function ndiCreate(name: string): boolean {
  if (!addon) return false;
  return addon.ndiCreate(name);
}

/** Send one BGRA video frame from a raw pixel buffer. */
export function ndiSendBgra(
  name: string,
  width: number,
  height: number,
  data: Buffer,
): void {
  if (!addon) return;
  addon.ndiSendBgra(name, width, height, data);
}

/** Destroy a named NDI sender. */
export function ndiDestroy(name: string): void {
  if (!addon) return;
  addon.ndiDestroy(name);
}

/** Shut down all senders and the NDI runtime. Call on app quit. */
export function ndiShutdown(): void {
  if (!addon) return;
  addon.ndiShutdown();
  addon = null;
  _available = false;
}
