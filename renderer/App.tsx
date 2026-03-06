import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Verse, BibleVersion } from "../shared/types";
import {
  makeDefault,
  makeNdi,
  type NdiState,
  type ViewSettings,
} from "./viewTypes";

// ─── Portrait aspect ratios ───────────────────────────────────────────────────────────
type PortraitRatio = "9:16" | "4:5" | "1:1";
const PORTRAIT_DIMS: Record<PortraitRatio, [number, number]> = {
  "9:16": [720, 1280],
  "4:5": [1080, 1350],
  "1:1": [1080, 1080],
};

// ─── Session persistence ───────────────────────────────────────────────────────────
const SESSION_KEY = "bible-ndi:session";

type SavedSettings = Omit<ViewSettings, "bgImage"> & { bgImage: null };

interface Session {
  book: number;
  chapter: number;
  verse: number;
  version: string;
  lsSt: SavedSettings;
  ptSt: SavedSettings;
  ltSt: SavedSettings;
  lsChannel: string;
  ptChannel: string;
  ltChannel: string;
  portraitRatio: PortraitRatio;
}

function loadSession(): Partial<Session> {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as Partial<Session>;
  } catch {}
  return {};
}

function mergeSettings(
  saved: Partial<SavedSettings> | undefined,
  defaults: ViewSettings,
): ViewSettings {
  if (!saved) return defaults;
  return { ...defaults, ...saved, bgImage: null };
}
import { cleanText } from "./styleUtils";
import { renderSlate, renderLowerThird } from "./slateRenderers";
import FitPreview from "./components/FitPreview";
import NdiControl from "./components/NdiControl";
import ScriptureNav from "./components/ScriptureNav";
import { BOOK_NAMES } from "./constants";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useSettings(init: ViewSettings) {
  const [st, set] = useState(init);
  const update = useCallback(
    <K extends keyof ViewSettings>(k: K, v: ViewSettings[K]) =>
      set((s) => ({ ...s, [k]: v })),
    [],
  );
  return [st, update] as const;
}

function useNdi(init: NdiState) {
  const [ndi, set] = useState(init);
  const update = useCallback(
    (next: Partial<NdiState>) => set((s) => ({ ...s, ...next })),
    [],
  );
  return [ndi, update] as const;
}

// ─── View block (label + preview + NDI strip) ─────────────────────────────────

interface ViewBlockProps {
  label: string;
  ndi: NdiState;
  onNdiChange: (n: Partial<NdiState>) => void;
  ndiAvailable: boolean;
  nativeW: number;
  nativeH: number;
  render: () => React.ReactNode;
}

function ViewBlock({
  label,
  ndi,
  onNdiChange,
  ndiAvailable,
  nativeW,
  nativeH,
  render,
}: ViewBlockProps) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={S.viewLabel}>{label}</div>
      <FitPreview nativeW={nativeW} nativeH={nativeH}>
        {render}
      </FitPreview>
      <NdiControl
        state={ndi}
        onChange={onNdiChange}
        ndiAvailable={ndiAvailable}
      />
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const saved = useMemo(() => loadSession(), []);

  const [book, setBook_] = useState(saved.book ?? 1);
  const [chapter, setChapter_] = useState(saved.chapter ?? 1);
  const [verse, setVerse_] = useState(saved.verse ?? 1);
  const [chapterCount, setChapterCount] = useState(50);
  const [verseCount, setVerseCount] = useState(31);
  const [verseData, setVerseData] = useState<Verse | null>(null);

  // Stable setters — wrapped in useCallback so child components never see
  // a new function reference on every render (which would bust memoization
  // and could cause stale closures in the hold-repeat hook).
  const setBook = useCallback((b: number) => {
    setBook_(b);
    setChapter_(1);
    setVerse_(1);
  }, []);

  const setChapter = useCallback((c: number) => {
    setChapter_(c);
    setVerse_(1);
  }, []);

  const setVerse = setVerse_; // already stable (useState dispatch)

  const [lsSt, updLs] = useSettings(mergeSettings(saved.lsSt, makeDefault()));
  const [ptSt, updPt] = useSettings(
    mergeSettings(saved.ptSt, makeDefault({ fontSize: 44 })),
  );
  const [ltSt, updLt] = useSettings(
    mergeSettings(
      saved.ltSt,
      makeDefault({ fontSize: 36, refPosition: "above" }),
    ),
  );

  const [lsNdi, updLsNdi] = useNdi(
    makeNdi(saved.lsChannel ?? "BibleNDI - Landscape"),
  );
  const [ptNdi, updPtNdi] = useNdi(
    makeNdi(saved.ptChannel ?? "BibleNDI - Portrait"),
  );
  const [ltNdi, updLtNdi] = useNdi(
    makeNdi(saved.ltChannel ?? "BibleNDI - LowerThird"),
  );

  const [portraitRatio, setPortraitRatio] = useState<PortraitRatio>(
    saved.portraitRatio ?? "9:16",
  );
  const [ptW, ptH] = PORTRAIT_DIMS[portraitRatio];

  // Bible version
  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState(
    saved.version ?? "kjv.sqlite",
  );

  useEffect(() => {
    window.bibleAPI.listVersions().then((vs) => {
      setVersions(vs);
      if (vs.length > 0 && !vs.find((v) => v.id === currentVersion)) {
        setCurrentVersion(vs[0].id);
      }
    });
  }, []);

  const handleVersionChange = async (id: string) => {
    const result = await window.bibleAPI.setVersion(id);
    if (result.ok) {
      setCurrentVersion(id);
      // Re-fetch current verse with new translation
      window.bibleAPI.getVerse(book, chapter, verse).then(setVerseData);
    } else {
      console.error("Failed to switch version:", result.error);
    }
  };

  useEffect(() => {
    window.bibleAPI.getChapterCount(book).then(setChapterCount);
  }, [book]);
  useEffect(() => {
    if (chapter > chapterCount) setChapter_(chapterCount || 1);
  }, [chapterCount]);
  useEffect(() => {
    window.bibleAPI.getVerseCount(book, chapter).then(setVerseCount);
  }, [book, chapter]);
  useEffect(() => {
    if (verse > verseCount) setVerse_(verseCount || 1);
  }, [verseCount]);
  useEffect(() => {
    window.bibleAPI.getVerse(book, chapter, verse).then(setVerseData);
  }, [book, chapter, verse]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT") return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        e.shiftKey
          ? (setChapter_((c) => Math.min(c + 1, chapterCount)), setVerse_(1))
          : setVerse_((v) => Math.min(v + 1, verseCount));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.shiftKey
          ? (setChapter_((c) => Math.max(c - 1, 1)), setVerse_(1))
          : setVerse_((v) => Math.max(v - 1, 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [chapterCount, verseCount]);

  const reference = `${BOOK_NAMES[book]} ${chapter}:${verse}`;
  const text = verseData ? cleanText(verseData.text) : "Loading...";

  // ─── Session save (debounced 400ms) ──────────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const session: Session = {
          book,
          chapter,
          verse,
          version: currentVersion,
          lsSt: { ...lsSt, bgImage: null },
          ptSt: { ...ptSt, bgImage: null },
          ltSt: { ...ltSt, bgImage: null },
          lsChannel: lsNdi.channelName,
          ptChannel: ptNdi.channelName,
          ltChannel: ltNdi.channelName,
          portraitRatio,
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch {}
    }, 400);
  }, [
    book,
    chapter,
    verse,
    currentVersion,
    lsSt,
    ptSt,
    ltSt,
    lsNdi.channelName,
    ptNdi.channelName,
    ltNdi.channelName,
    portraitRatio,
  ]);

  // ─── NDI: availability check ─────────────────────────────────────────────
  const [ndiAvailable, setNdiAvailable] = useState(false);
  useEffect(() => {
    window.ndiAPI.isAvailable().then(setNdiAvailable);
  }, []);

  // ─── NDI: content sync ───────────────────────────────────────────────────
  // Push latest content to each offscreen output window whenever it changes.
  // The output windows render at full native resolution for NDI capture.
  useEffect(() => {
    window.ndiAPI.updateContent("ls", {
      text,
      reference,
      settings: lsSt,
      type: "slate",
      width: 1280,
      height: 720,
    });
  }, [text, reference, lsSt]);

  useEffect(() => {
    window.ndiAPI.updateContent("pt", {
      text,
      reference,
      settings: ptSt,
      type: "slate",
      width: ptW,
      height: ptH,
    });
  }, [text, reference, ptSt, ptW, ptH]);

  useEffect(() => {
    window.ndiAPI.updateContent("lt", {
      text,
      reference,
      settings: ltSt,
      type: "lowerThird",
      width: 1280,
      height: 180,
    });
  }, [text, reference, ltSt]);

  // ─── NDI: start/stop lifecycle ───────────────────────────────────────────
  useEffect(() => {
    if (lsNdi.live) {
      window.ndiAPI.start("ls", lsNdi.channelName).then((r) => {
        if (!r.ok) console.warn("[NDI] Landscape start failed:", r.error);
      });
    } else {
      window.ndiAPI.stop("ls");
    }
  }, [lsNdi.live, lsNdi.channelName]);

  useEffect(() => {
    if (ptNdi.live) {
      window.ndiAPI.start("pt", ptNdi.channelName).then((r) => {
        if (!r.ok) console.warn("[NDI] Portrait start failed:", r.error);
      });
    } else {
      window.ndiAPI.stop("pt");
    }
  }, [ptNdi.live, ptNdi.channelName]);

  useEffect(() => {
    if (ltNdi.live) {
      window.ndiAPI.start("lt", ltNdi.channelName).then((r) => {
        if (!r.ok) console.warn("[NDI] LowerThird start failed:", r.error);
      });
    } else {
      window.ndiAPI.stop("lt");
    }
  }, [ltNdi.live, ltNdi.channelName]);

  return (
    <div style={S.root}>
      <aside style={S.left}>
        <ScriptureNav
          book={book}
          chapter={chapter}
          verse={verse}
          chapterCount={chapterCount}
          verseCount={verseCount}
          setBook={setBook}
          setChapter={setChapter}
          setVerse={setVerse}
          versions={versions}
          currentVersion={currentVersion}
          onVersionChange={handleVersionChange}
          lsSt={lsSt}
          updLs={updLs}
          ptSt={ptSt}
          updPt={updPt}
          ltSt={ltSt}
          updLt={updLt}
        />
      </aside>

      <div style={S.center}>
        <ViewBlock
          label="Landscape  16:9"
          ndi={lsNdi}
          onNdiChange={updLsNdi}
          ndiAvailable={ndiAvailable}
          nativeW={1280}
          nativeH={720}
          render={() => renderSlate(1280, 720, text, reference, lsSt)}
        />
        <div style={S.divider} />
        <ViewBlock
          label="Lower Third  1280×180"
          ndi={ltNdi}
          onNdiChange={updLtNdi}
          ndiAvailable={ndiAvailable}
          nativeW={1280}
          nativeH={180}
          render={() => renderLowerThird(1280, 180, text, reference, ltSt)}
        />
      </div>

      <div style={S.right}>
        {/* Portrait ratio selector */}
        <div
          style={{ display: "flex", gap: 4, marginBottom: 6, flexShrink: 0 }}
        >
          <span
            style={{
              fontSize: 9,
              color: "#c8a96e88",
              textTransform: "uppercase",
              letterSpacing: 1,
              alignSelf: "center",
              marginRight: 4,
              fontWeight: 700,
            }}
          >
            Ratio
          </span>
          {(["9:16", "4:5", "1:1"] as PortraitRatio[]).map((r) => (
            <button
              key={r}
              onClick={() => setPortraitRatio(r)}
              style={{
                padding: "3px 8px",
                fontSize: 10,
                background: portraitRatio === r ? "#c8a96e22" : "#1c1c30",
                color: portraitRatio === r ? "#c8a96e" : "#777",
                border:
                  portraitRatio === r
                    ? "1px solid #c8a96e55"
                    : "1px solid #ffffff12",
                borderRadius: 3,
                cursor: "pointer",
              }}
            >
              {r}
            </button>
          ))}
        </div>
        <ViewBlock
          label={`Portrait  ${portraitRatio}  (${ptW}×${ptH})`}
          ndi={ptNdi}
          onNdiChange={updPtNdi}
          ndiAvailable={ndiAvailable}
          nativeW={ptW}
          nativeH={ptH}
          render={() =>
            renderSlate(ptW, ptH, text, reference, ptSt, "80px", "60px")
          }
        />
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "row",
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    background: "#0b0b14",
    color: "#e8e4da",
    fontFamily: "'Lato', 'Segoe UI', sans-serif",
    fontSize: 13,
  },
  left: {
    width: 280,
    flexShrink: 0,
    background: "#111120",
    borderRight: "1px solid #ffffff0d",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  center: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    padding: "12px 10px",
    gap: 0,
  },
  divider: {
    height: 1,
    background: "#ffffff08",
    flexShrink: 0,
    margin: "8px 0",
  },
  right: {
    width: 380,
    flexShrink: 0,
    background: "#0d0d1a",
    borderLeft: "1px solid #ffffff0d",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    padding: "12px 10px",
  },
  viewLabel: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#c8a96e55",
    paddingBottom: 5,
    flexShrink: 0,
  },
};
