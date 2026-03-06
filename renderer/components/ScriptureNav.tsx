import React, { useCallback, useEffect, useRef, useState } from "react";
import { BOOK_NAMES, parseRef } from "../constants";
import SettingsPanel from "./SettingsPanel";
import type { BibleVersion } from "../../shared/types";
import type { ViewSettings } from "../viewTypes";

interface Props {
  book: number;
  chapter: number;
  verse: number;
  chapterCount: number;
  verseCount: number;
  setBook: (b: number) => void;
  setChapter: (c: number) => void;
  setVerse: (v: number) => void;

  versions: BibleVersion[];
  currentVersion: string;
  onVersionChange: (id: string) => void;

  lsSt: ViewSettings;
  updLs: <K extends keyof ViewSettings>(k: K, v: ViewSettings[K]) => void;
  ptSt: ViewSettings;
  updPt: <K extends keyof ViewSettings>(k: K, v: ViewSettings[K]) => void;
  ltSt: ViewSettings;
  updLt: <K extends keyof ViewSettings>(k: K, v: ViewSettings[K]) => void;
}

function range(n: number) {
  return Array.from({ length: n }, (_, i) => i + 1);
}

//  Press-and-hold repeat hook
// Fires `action` immediately, then repeatedly after a delay while held down.

// ─── Press-and-hold repeat hook ───────────────────────────────────────────────
// Keeps a ref to the latest action so the interval never calls a stale closure.

function useHold(action: () => void, delay = 380, interval = 110) {
  // Always point at the freshest action without needing it in useCallback deps.
  const actionRef = useRef(action);
  useEffect(() => {
    actionRef.current = action;
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeater = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (repeater.current) {
      clearInterval(repeater.current);
      repeater.current = null;
    }
  }, []);

  // `start` is stable — it never depends on action directly.
  const start = useCallback(() => {
    actionRef.current();
    timer.current = setTimeout(() => {
      repeater.current = setInterval(() => actionRef.current(), interval);
    }, delay);
  }, [delay, interval]);

  useEffect(() => clear, [clear]); // cleanup on unmount

  return { onMouseDown: start, onMouseUp: clear, onMouseLeave: clear };
}

//  Component

export default function ScriptureNav({
  book,
  chapter,
  verse,
  chapterCount,
  verseCount,
  setBook,
  setChapter,
  setVerse,
  versions,
  currentVersion,
  onVersionChange,
  lsSt,
  updLs,
  ptSt,
  updPt,
  ltSt,
  updLt,
}: Props) {
  const [quickRef, setQuickRef] = useState("");
  const [refError, setRefError] = useState(false);

  const reference = `${BOOK_NAMES[book]} ${chapter}:${verse}`;

  const goQuickRef = () => {
    const p = parseRef(quickRef);
    if (!p) {
      setRefError(true);
      setTimeout(() => setRefError(false), 700);
      return;
    }
    setBook(p.book);
    setChapter(p.chapter);
    setVerse(p.verse);
    setQuickRef("");
  };

  // Hold-enabled navigation. useHold updates actionRef after every render so
  // these closures always capture fresh prop values — no stale closure bugs.
  const prevVerse = useHold(() => setVerse(Math.max(verse - 1, 1)));
  const nextVerse = useHold(() => setVerse(Math.min(verse + 1, verseCount)));
  const prevChap = useHold(() => setChapter(Math.max(chapter - 1, 1)));
  const nextChap = useHold(() =>
    setChapter(Math.min(chapter + 1, chapterCount)),
  );

  return (
    <div style={S.wrap}>
      {/*  Logo  */}
      <div style={S.logo}> Bible NDI</div>

      {/*  Version selector  */}
      {versions.length > 0 && (
        <div style={{ padding: "6px 10px 4px", flexShrink: 0 }}>
          <label style={S.lbl}>Translation</label>
          <select
            style={{
              ...S.sel,
              color: versions.length === 1 ? "#555" : "#f0ece2",
            }}
            value={currentVersion}
            onChange={(e) => onVersionChange(e.target.value)}
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/*  Quick jump  */}
      <div style={{ display: "flex", gap: 5, padding: "6px 10px 4px" }}>
        <input
          style={{
            ...S.input,
            ...(refError ? { borderColor: "#e05252" } : {}),
          }}
          placeholder="jn 3:16  rev 22:1  ps 23"
          value={quickRef}
          onChange={(e) => {
            setQuickRef(e.target.value);
            setRefError(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && goQuickRef()}
        />
        <button style={S.goBtn} onClick={goQuickRef}>
          Go
        </button>
      </div>

      {/*  Book selector  */}
      <div style={{ padding: "0 10px 6px" }}>
        <label style={S.lbl}>Book</label>
        <select
          style={S.sel}
          value={book}
          onChange={(e) => {
            setBook(Number(e.target.value));
            setChapter(1);
            setVerse(1);
          }}
        >
          {BOOK_NAMES.slice(1).map((n, i) => (
            <option key={i + 1} value={i + 1}>
              {n}
            </option>
          ))}
        </select>
      </div>

      {/* Chapter / Verse selects */}
      <div style={{ display: "flex", gap: 6, padding: "0 10px 6px" }}>
        <div style={{ flex: 1 }}>
          <label style={S.lbl}>Chapter</label>
          <select
            style={S.sel}
            value={chapter}
            onChange={(e) => {
              setChapter(Number(e.target.value));
              setVerse(1);
            }}
          >
            {range(chapterCount).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={S.lbl}>Verse</label>
          <select
            style={S.sel}
            value={verse}
            onChange={(e) => setVerse(Number(e.target.value))}
          >
            {range(verseCount).map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/*  Fast nav bar  */}
      <div style={S.navRow}>
        <button
          style={S.navBtnSm}
          title="Prev chapter (Shift+)"
          {...prevChap}
        ></button>
        <button
          style={{ ...S.navBtnSm, ...S.navBtnPrimary }}
          title="Prev verse ()"
          {...prevVerse}
        ></button>
        <span style={S.refPill}>{reference}</span>
        <button
          style={{ ...S.navBtnSm, ...S.navBtnPrimary }}
          title="Next verse ()"
          {...nextVerse}
        ></button>
        <button
          style={S.navBtnSm}
          title="Next chapter (Shift+)"
          {...nextChap}
        ></button>
      </div>

      <div style={S.hint}>
        Hold for rapid scroll &nbsp;&nbsp; Shift+ chapter
      </div>

      {/*  View settings  */}
      <div
        style={{
          borderTop: "1px solid #ffffff08",
          marginTop: 4,
          paddingTop: 2,
        }}
      >
        <div style={S.sectionHead}>View Settings</div>
        <SettingsPanel label=" Landscape" st={lsSt} onChange={updLs} />
        <SettingsPanel label=" Portrait" st={ptSt} onChange={updPt} />
        <SettingsPanel label=" Lower Third" st={ltSt} onChange={updLt} />
      </div>

      <div style={{ height: 16 }} />
    </div>
  );
}

//  Styles

const S: Record<string, React.CSSProperties> = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflowY: "auto",
    overflowX: "hidden",
  },
  logo: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.8,
    color: "#c8a96e",
    padding: "14px 12px 10px",
    borderBottom: "1px solid #ffffff08",
    flexShrink: 0,
  },
  lbl: {
    display: "block",
    fontSize: 9,
    color: "#555",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 2,
  } as React.CSSProperties,
  sel: {
    width: "100%",
    padding: "5px 6px",
    fontSize: 11,
    background: "#1c1c30",
    color: "#f0ece2",
    border: "1px solid #ffffff12",
    borderRadius: 4,
    cursor: "pointer",
  },
  input: {
    flex: 1,
    padding: "6px 8px",
    fontSize: 11,
    background: "#1c1c30",
    color: "#f0ece2",
    border: "1px solid #c8a96e44",
    borderRadius: 4,
    outline: "none",
  },
  goBtn: {
    padding: "6px 11px",
    fontSize: 11,
    fontWeight: 700,
    background: "#c8a96e",
    color: "#0b0b14",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
  },
  hint: { fontSize: 9, color: "#3a3a4a", padding: "1px 10px 6px" },
  navRow: {
    display: "flex",
    alignItems: "center",
    gap: 3,
    padding: "4px 10px",
  },
  navBtnSm: {
    width: 28,
    height: 32,
    fontSize: 13,
    fontWeight: 700,
    background: "#1a1a2e",
    color: "#c8a96eaa",
    border: "1px solid #c8a96e22",
    borderRadius: 3,
    cursor: "pointer",
    flexShrink: 0,
    userSelect: "none",
  } as React.CSSProperties,
  navBtnPrimary: {
    background: "#c8a96e18",
    color: "#c8a96e",
    border: "1px solid #c8a96e44",
  },
  refPill: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    color: "#f0ece2",
    background: "#c8a96e12",
    padding: "3px 5px",
    borderRadius: 3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  sectionHead: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#c8a96e66",
    padding: "8px 12px 4px",
  },
};
