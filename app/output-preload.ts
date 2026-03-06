/**
 * Preload for offscreen output windows.
 * Bridges the 'output-update' IPC message from the main process
 * to the output renderer via a minimal contextBridge API.
 */

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("outputAPI", {
  /**
   * Register a callback that fires whenever the main process sends
   * new content (verse text, reference, settings, type).
   */
  onUpdate: (cb: (payload: unknown) => void): void => {
    ipcRenderer.on("output-update", (_event, payload) => cb(payload));
  },
});
