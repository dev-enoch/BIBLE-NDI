/**
 * Control Server — serves a browser-based remote control panel at localhost:9876.
 *
 * Add it in OBS as a Custom Browser Dock:
 *   Docks → Custom Browser Docks → URL: http://localhost:9876
 *
 * Architecture:
 *   - GET /         Self-contained control panel HTML (dockable in OBS)
 *   - GET /state    Current navigation state JSON
 *   - GET /events   Server-Sent Events stream (real-time state push)
 *   - GET /books    Book list [{id, name}]
 *   - GET /meta     {chapterCount, verseCount} for current book/chapter
 *   - POST /navigate {action} or {book,chapter,verse}
 */

import http from "http";
import type { ServerResponse } from "http";
import { getChapterCount, getVerseCount } from "./database";

// ─── State ───────────────────────────────────────────────────────────────────

export interface ControlState {
  book: number;
  chapter: number;
  verse: number;
  chapterCount: number;
  verseCount: number;
  reference: string;
  text: string;
}

export type NavigateCmd =
  | { action: "nextVerse" | "prevVerse" | "nextChapter" | "prevChapter" }
  | { book: number; chapter: number; verse: number };

let currentState: ControlState = {
  book: 1,
  chapter: 1,
  verse: 1,
  chapterCount: 50,
  verseCount: 31,
  reference: "Genesis 1:1",
  text: "",
};

const sseClients = new Set<ServerResponse>();
let _navigateCb: ((cmd: NavigateCmd) => void) | null = null;

export function setNavigateCallback(cb: (cmd: NavigateCmd) => void): void {
  _navigateCb = cb;
}

export function broadcastState(state: ControlState): void {
  currentState = state;
  const data = `data: ${JSON.stringify(state)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch {
      sseClients.delete(res);
    }
  }
}

// ─── Book names (matches renderer/constants.ts) ───────────────────────────────

const BOOKS = [
  "Genesis",
  "Exodus",
  "Leviticus",
  "Numbers",
  "Deuteronomy",
  "Joshua",
  "Judges",
  "Ruth",
  "1 Samuel",
  "2 Samuel",
  "1 Kings",
  "2 Kings",
  "1 Chronicles",
  "2 Chronicles",
  "Ezra",
  "Nehemiah",
  "Esther",
  "Job",
  "Psalms",
  "Proverbs",
  "Ecclesiastes",
  "Song of Solomon",
  "Isaiah",
  "Jeremiah",
  "Lamentations",
  "Ezekiel",
  "Daniel",
  "Hosea",
  "Joel",
  "Amos",
  "Obadiah",
  "Jonah",
  "Micah",
  "Nahum",
  "Habakkuk",
  "Zephaniah",
  "Haggai",
  "Zechariah",
  "Malachi",
  "Matthew",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Romans",
  "1 Corinthians",
  "2 Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Titus",
  "Philemon",
  "Hebrews",
  "James",
  "1 Peter",
  "2 Peter",
  "1 John",
  "2 John",
  "3 John",
  "Jude",
  "Revelation",
];

// ─── HTML control panel ───────────────────────────────────────────────────────

function buildHTML(): string {
  const booksJson = JSON.stringify(BOOKS);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>BibleNDI Control</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    background:#111118;color:#e8e4da;
    font-family:'Segoe UI',system-ui,sans-serif;
    font-size:13px;user-select:none;
    display:flex;flex-direction:column;
    height:100vh;overflow:hidden;
  }
  #header{
    background:#0d0d16;
    border-bottom:1px solid #ffffff0d;
    padding:10px 12px 8px;
    flex-shrink:0;
  }
  #ref{
    font-size:17px;font-weight:700;
    color:#c8a96e;letter-spacing:.5px;
    margin-bottom:5px;
  }
  #text{
    font-size:11px;color:#aaa;
    line-height:1.5;
    display:-webkit-box;-webkit-line-clamp:3;
    -webkit-box-orient:vertical;overflow:hidden;
  }
  #navArea{
    padding:10px 12px;
    display:flex;flex-direction:column;gap:8px;
    flex-shrink:0;
  }
  .navRow{
    display:flex;gap:6px;align-items:center;
  }
  .navLabel{
    font-size:9px;color:#555;text-transform:uppercase;
    letter-spacing:1px;width:50px;flex-shrink:0;
  }
  .navBtn{
    flex:1;padding:7px 4px;border:1px solid #ffffff14;
    border-radius:4px;background:#1c1c2e;color:#e8e4da;
    font-size:12px;cursor:pointer;transition:background .12s,color .12s;
  }
  .navBtn:hover{background:#c8a96e22;border-color:#c8a96e55;color:#c8a96e}
  .navBtn:active{background:#c8a96e44}
  .navBig{padding:10px 4px;font-size:14px;font-weight:700}
  #selArea{
    padding:0 12px 12px;
    display:flex;flex-direction:column;gap:7px;
    overflow-y:auto;flex:1;
  }
  .selRow{display:flex;flex-direction:column;gap:3px}
  .selLbl{font-size:9px;color:#555;text-transform:uppercase;letter-spacing:1px}
  select,input[type=number]{
    width:100%;padding:5px 7px;
    background:#1c1c2e;color:#e8e4da;
    border:1px solid #ffffff14;border-radius:4px;
    font-size:12px;cursor:pointer;
  }
  select:focus,input:focus{outline:1px solid #c8a96e55;border-color:#c8a96e55}
  #goBtn{
    width:100%;padding:8px;
    background:#c8a96e22;color:#c8a96e;
    border:1px solid #c8a96e55;border-radius:4px;
    font-size:12px;font-weight:700;cursor:pointer;
    letter-spacing:.5px;
  }
  #goBtn:hover{background:#c8a96e44}
  #status{
    padding:6px 12px;
    font-size:9px;color:#444;text-align:center;
    border-top:1px solid #ffffff06;flex-shrink:0;
  }
  #status.ok{color:#3a3}
  #status.err{color:#a33}
</style>
</head>
<body>
<div id="header">
  <div id="ref">Loading…</div>
  <div id="text"></div>
</div>

<div id="navArea">
  <div class="navRow">
    <span class="navLabel">Verse</span>
    <button class="navBtn navBig" onclick="nav('prevVerse')">◀</button>
    <button class="navBtn navBig" onclick="nav('nextVerse')">▶</button>
  </div>
  <div class="navRow">
    <span class="navLabel">Chapter</span>
    <button class="navBtn" onclick="nav('prevChapter')">◀ Prev</button>
    <button class="navBtn" onclick="nav('nextChapter')">Next ▶</button>
  </div>
</div>

<div id="selArea">
  <div class="selRow">
    <label class="selLbl">Book</label>
    <select id="bookSel"></select>
  </div>
  <div class="selRow">
    <label class="selLbl">Chapter</label>
    <input id="chapterIn" type="number" min="1" value="1"/>
  </div>
  <div class="selRow">
    <label class="selLbl">Verse</label>
    <input id="verseIn" type="number" min="1" value="1"/>
  </div>
  <button id="goBtn" onclick="jumpTo()">GO</button>
</div>

<div id="status" id="status">Connecting…</div>

<script>
const BOOKS = ${booksJson};
let _state = null;
let _busy = false;

// Populate book dropdown
const bookSel = document.getElementById('bookSel');
BOOKS.forEach((name, i) => {
  const opt = document.createElement('option');
  opt.value = i + 1;
  opt.textContent = name;
  bookSel.appendChild(opt);
});

function applyState(s) {
  _state = s;
  document.getElementById('ref').textContent = s.reference;
  document.getElementById('text').textContent = s.text;
  bookSel.value = s.book;
  document.getElementById('chapterIn').max = s.chapterCount;
  document.getElementById('chapterIn').value = s.chapter;
  document.getElementById('verseIn').max = s.verseCount;
  document.getElementById('verseIn').value = s.verse;
}

// SSE
function connect() {
  const es = new EventSource('/events');
  es.onopen = () => setStatus('Connected', 'ok');
  es.onmessage = e => { try { applyState(JSON.parse(e.data)); } catch{} };
  es.onerror = () => {
    setStatus('Reconnecting…', 'err');
    es.close();
    setTimeout(connect, 2000);
  };
}
connect();

// Fetch initial state
fetch('/state').then(r=>r.json()).then(applyState).catch(()=>{});

function setStatus(msg, cls) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = cls || '';
  if (cls === 'ok') setTimeout(() => { el.textContent = 'BibleNDI'; el.className = ''; }, 1500);
}

function nav(action) {
  if (_busy) return;
  _busy = true;
  fetch('/navigate', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({action})
  })
  .then(r => r.json())
  .then(j => { if (!j.ok) setStatus('Error', 'err'); })
  .catch(() => setStatus('Error', 'err'))
  .finally(() => { _busy = false; });
}

function jumpTo() {
  const book = parseInt(bookSel.value);
  const chapter = parseInt(document.getElementById('chapterIn').value) || 1;
  const verse = parseInt(document.getElementById('verseIn').value) || 1;
  if (_busy) return;
  _busy = true;
  fetch('/navigate', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({book, chapter, verse})
  })
  .then(r => r.json())
  .then(j => { if (!j.ok) setStatus('Error', 'err'); })
  .catch(() => setStatus('Error', 'err'))
  .finally(() => { _busy = false; });
}

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === 'ArrowRight') nav('nextVerse');
  else if (e.key === 'ArrowLeft') nav('prevVerse');
  else if (e.key === 'ArrowUp') nav('prevChapter');
  else if (e.key === 'ArrowDown') nav('nextChapter');
});
</script>
</body>
</html>`;
}

// ─── HTTP server ──────────────────────────────────────────────────────────────

function json(res: ServerResponse, code: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

export function startControlServer(port = 9876): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const pathname = url.pathname;

    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    // ── GET / ──
    if (req.method === "GET" && pathname === "/") {
      const html = buildHTML();
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    // ── GET /state ──
    if (req.method === "GET" && pathname === "/state") {
      json(res, 200, currentState);
      return;
    }

    // ── GET /events (SSE) ──
    if (req.method === "GET" && pathname === "/events") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      res.write(`data: ${JSON.stringify(currentState)}\n\n`);
      sseClients.add(res);
      req.on("close", () => sseClients.delete(res));
      return;
    }

    // ── GET /books ──
    if (req.method === "GET" && pathname === "/books") {
      json(
        res,
        200,
        BOOKS.map((name, i) => ({ id: i + 1, name })),
      );
      return;
    }

    // ── GET /meta?book=N&chapter=N ──
    if (req.method === "GET" && pathname === "/meta") {
      const book = parseInt(url.searchParams.get("book") ?? "1");
      const chapter = parseInt(url.searchParams.get("chapter") ?? "1");
      try {
        const [chapterCount, verseCount] = await Promise.all([
          getChapterCount(book),
          getVerseCount(book, chapter),
        ]);
        json(res, 200, { chapterCount, verseCount });
      } catch {
        json(res, 500, { error: "DB error" });
      }
      return;
    }

    // ── POST /navigate ──
    if (req.method === "POST" && pathname === "/navigate") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const cmd = JSON.parse(body) as NavigateCmd;
          if (_navigateCb) {
            _navigateCb(cmd);
            json(res, 200, { ok: true });
          } else {
            json(res, 503, { ok: false, error: "App not ready" });
          }
        } catch {
          json(res, 400, { ok: false, error: "Invalid JSON" });
        }
      });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`[Control] Panel running at http://localhost:${port}`);
  });

  return server;
}
