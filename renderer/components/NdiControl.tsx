import React from "react";
import type { NdiState } from "../viewTypes";

interface Props {
  state: NdiState;
  onChange: (next: Partial<NdiState>) => void;
  /** Whether the NDI native addon is loaded and ready. */
  ndiAvailable?: boolean;
}

/**
 * Demo NDI output control strip.
 * Scaffolded for real NDI SDK wiring — currently simulates live/offline state.
 */
export default function NdiControl({
  state,
  onChange,
  ndiAvailable = false,
}: Props) {
  const { channelName, live } = state;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#0c0c18",
        borderTop: "1px solid #ffffff0a",
        flexShrink: 0,
      }}
    >
      {/* SDK-not-available warning banner */}
      {!ndiAvailable && (
        <div
          style={{
            padding: "3px 10px",
            fontSize: 9,
            color: "#c8a96e99",
            background: "#1a1500",
            borderBottom: "1px solid #ffffff08",
            letterSpacing: 0.5,
          }}
        >
          NDI SDK not installed &mdash; Install SDK &amp; run{" "}
          <code style={{ fontFamily: "monospace" }}>yarn rebuild-ndi</code>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 10px",
        }}
      >
        {/* Live indicator */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            flexShrink: 0,
            background: live ? "#3ddc84" : "#333344",
            boxShadow: live ? "0 0 6px #3ddc84aa" : "none",
            transition: "background 0.2s, box-shadow 0.2s",
          }}
        />

        {/* NDI label */}
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 1.2,
            color: "#555",
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          NDI
        </span>

        {/* Channel name input */}
        <input
          type="text"
          value={channelName}
          onChange={(e) => onChange({ channelName: e.target.value })}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "3px 7px",
            fontSize: 11,
            background: "#16162a",
            color: "#d0ccbf",
            border: "1px solid #ffffff10",
            borderRadius: 3,
            outline: "none",
            fontFamily: "monospace",
          }}
          title="NDI source name"
        />

        {/* Go Live / Stop */}
        <button
          onClick={() => onChange({ live: !live })}
          style={{
            padding: "3px 10px",
            fontSize: 10,
            fontWeight: 700,
            flexShrink: 0,
            borderRadius: 3,
            cursor: "pointer",
            border: "none",
            letterSpacing: 0.5,
            background: live ? "#2a1a1a" : "#1a2a1a",
            color: live ? "#e05252" : "#3ddc84",
            boxShadow: live
              ? "inset 0 0 0 1px #e0525244"
              : "inset 0 0 0 1px #3ddc8444",
            transition: "all 0.15s",
          }}
          title={live ? "Stop NDI output" : "Start NDI output"}
        >
          {live ? "■ Stop" : "▶ Go Live"}
        </button>
      </div>
    </div>
  );
}
