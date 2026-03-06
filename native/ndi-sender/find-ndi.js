/**
 * find-ndi.js  —  Auto-detect the NDI SDK installation directory.
 *
 * Used by binding.gyp at build time via:
 *   <!@(node find-ndi.js)
 *
 * Search order:
 *  1. NDI_SDK_DIR  environment variable (user override)
 *  2. Windows Registry (HKLM\SOFTWARE\NDI  /recursive)
 *  3. Common install paths (newest version first)
 *
 * Exits with code 1 and a helpful message if nothing is found.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ─── 1. Env var override ──────────────────────────────────────────────────────

if (process.env.NDI_SDK_DIR) {
  const dir = process.env.NDI_SDK_DIR;
  if (hasHeaders(dir)) {
    const sub = process.argv[2];
    const result = sub ? path.join(dir, sub) : dir;
    // Use forward slashes — GYP consumes backslashes on Windows
    process.stdout.write(result.replace(/\\/g, "/"));
    process.exit(0);
  }
  console.error(
    `[find-ndi] NDI_SDK_DIR="${dir}" does not contain NDI headers — ignoring.`,
  );
}

// ─── 2. Windows Registry ──────────────────────────────────────────────────────

if (process.platform === "win32") {
  try {
    // NDI registers under HKLM\SOFTWARE\NDI; each SDK version may add a sub-key
    const regOut = execSync(
      'reg query "HKLM\\SOFTWARE\\NDI" /s /f "SDK" /k 2>nul',
      { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] },
    );
    // Extract every key path and look for an Install Directory value
    const keys = regOut
      .split(/\r?\n/)
      .filter((l) => l.trim().startsWith("HKEY_"))
      .map((l) => l.trim());
    for (const key of keys) {
      try {
        const val = execSync(
          `reg query "${key}" /v "InstallationDirectory" 2>nul`,
          {
            encoding: "utf8",
            stdio: ["pipe", "pipe", "ignore"],
          },
        );
        const m = val.match(/InstallationDirectory\s+REG_SZ\s+(.+)/i);
        if (m) {
          const dir = m[1].trim();
          if (hasHeaders(dir)) {
            process.stdout.write(dir);
            process.exit(0);
          }
        }
      } catch {
        /* key may not have this value */
      }
    }
  } catch {
    /* reg.exe not available — unlikely on Windows */
  }
}

// ─── 3. Common install paths ─────────────────────────────────────────────────

const WIN_ROOTS = [
  "C:\\Program Files\\NDI",
  "C:\\Program Files (x86)\\NDI",
  ...(process.env.ProgramFiles ? [process.env.ProgramFiles + "\\NDI"] : []),
];

// SDK dirs in preference order (newest first)
const SDK_NAMES = [
  "NDI 6 SDK",
  "NDI Advanced SDK 6",
  "NDI 6 Advanced SDK",
  "NDI 5 SDK",
  "NDI Advanced SDK 5",
  "NDI 5 Advanced SDK",
  "NDI 4 SDK",
];

const MAC_CANDIDATES = [
  "/Library/NDI SDK for Apple",
  "/Library/NDI Advanced SDK for Apple",
];

const LINUX_CANDIDATES = ["/usr/local/ndi", "/opt/ndi"];

function findCommon() {
  if (process.platform === "win32") {
    for (const root of WIN_ROOTS) {
      if (!fs.existsSync(root)) continue;
      for (const name of SDK_NAMES) {
        const candidate = path.join(root, name);
        if (hasHeaders(candidate)) return candidate;
      }
      // Also scan any directory that has an "Include" subfolder with NDI headers
      try {
        for (const entry of fs.readdirSync(root)) {
          const candidate = path.join(root, entry);
          if (hasHeaders(candidate)) return candidate;
        }
      } catch {
        /* can't read */
      }
    }
  } else if (process.platform === "darwin") {
    for (const c of MAC_CANDIDATES) {
      if (hasHeaders(c)) return c;
    }
  } else {
    for (const c of LINUX_CANDIDATES) {
      if (hasHeaders(c)) return c;
    }
  }
  return null;
}

function hasHeaders(dir) {
  if (!dir || !fs.existsSync(dir)) return false;
  const header = path.join(dir, "Include", "Processing.NDI.Lib.h");
  return fs.existsSync(header);
}

const found = findCommon();
if (found) {
  // Optional: append a sub-path if passed as argument
  // e.g.  node find-ndi.js Include
  //        node find-ndi.js "Lib/x64/Processing.NDI.Lib.x64.lib"
  const sub = process.argv[2];
  const result = sub ? path.join(found, sub) : found;
  // Use forward slashes — GYP consumes backslashes on Windows
  process.stdout.write(result.replace(/\\/g, "/"));
  process.exit(0);
}

// ─── Not found ────────────────────────────────────────────────────────────────

console.error(`
[find-ndi] ERROR: NDI SDK not found.

The NDI SDK (with headers + .lib) is required to build the native addon.
The NDI Runtime alone (DLLs only) is not enough at compile time.

To fix:
  1. Download the NDI 6 SDK from https://ndi.tv/sdk/
  2. Install it  (default: C:\\Program Files\\NDI\\NDI 6 SDK)
  3. Run: yarn rebuild-ndi

  -- OR --  set NDI_SDK_DIR to a custom install path, e.g.:
  set NDI_SDK_DIR=C:\\MyNDI\\SDK
  yarn rebuild-ndi
`);
process.exit(1);
