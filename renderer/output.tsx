/**
 * Standalone output renderer — runs inside an offscreen BrowserWindow.
 *
 * Receives content from the main process via window.outputAPI.onUpdate,
 * then renders the appropriate slate layout at full native resolution.
 */

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import type { ViewSettings } from "./viewTypes";
import { renderSlate, renderLowerThird } from "./slateRenderers";

// ─── outputAPI type (exposed by app/output-preload.ts) ───────────────────────

export type OutputType = "slate" | "lowerThird";

export interface OutputPayload {
  text: string;
  reference: string;
  settings: ViewSettings;
  type: OutputType;
  width: number;
  height: number;
}

declare global {
  interface Window {
    outputAPI: {
      onUpdate(cb: (payload: OutputPayload) => void): void;
    };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

function OutputApp() {
  const [payload, setPayload] = useState<OutputPayload | null>(null);

  useEffect(() => {
    window.outputAPI.onUpdate((p) => setPayload(p));
  }, []);

  if (!payload) {
    // Transparent frame while waiting for first content
    return (
      <div
        style={{ background: "transparent", width: "100vw", height: "100vh" }}
      />
    );
  }

  const { text, reference, settings, type, width, height } = payload;

  return (
    <>
      {type === "lowerThird"
        ? renderLowerThird(width, height, text, reference, settings)
        : renderSlate(width, height, text, reference, settings)}
    </>
  );
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <OutputApp />
    </React.StrictMode>,
  );
}
