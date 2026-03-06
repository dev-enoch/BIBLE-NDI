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
<title>BibleNDI</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    background:#0f0f1a;color:#e8e4da;
    font-family:'Segoe UI',system-ui,sans-serif;
    font-size:12px;user-select:none;
    display:flex;flex-direction:column;
    padding:8px;gap:6px;
    height:100vh;overflow:hidden;
  }
  #ref{
    font-size:11px;font-weight:700;color:#c8a96e;
    letter-spacing:.3px;white-space:nowrap;overflow:hidden;
    text-overflow:ellipsis;flex-shrink:0;
  }
  .row{display:flex;gap:5px;flex-shrink:0}
  select,input[type=number]{
    flex:1;width:100%;padding:5px 6px;
    background:#1a1a2e;color:#e8e4da;
    border:1px solid #ffffff14;border-radius:4px;
    font-size:12px;cursor:pointer;min-width:0;
  }
  select:focus,input:focus{outline:none;border-color:#c8a96e66}
  .lbl{
    font-size:9px;color:#444;text-transform:uppercase;
    letter-spacing:.8px;margin-bottom:2px;
  }
  .col{display:flex;flex-direction:column;flex:1;min-width:0}
  .nav{
    display:grid;grid-template-columns:1fr 2fr 2fr 1fr;
    gap:5px;flex-shrink:0;
  }
  .nb{
    padding:8px 2px;border:1px solid #ffffff14;
    border-radius:4px;background:#1a1a2e;color:#e8e4da;
    font-size:13px;cursor:pointer;text-align:center;
    transition:background .1s;
  }
  .nb:hover{background:#c8a96e22;border-color:#c8a96e55;color:#c8a96e}
  .nb:active{background:#c8a96e44}
  .nb.sm{font-size:10px;color:#666;padding:8px 0}
  .nb.sm:hover{color:#c8a96e}
  #dot{
    display:inline-block;width:6px;height:6px;
    border-radius:50%;background:#444;margin-right:5px;
    vertical-align:middle;transition:background .3s;
  }
  #dot.ok{background:#3ddc84;box-shadow:0 0 5px #3ddc8488}
  #dot.err{background:#c83}
</style>
</head>
<body>
<div id="ref"><span id="dot"></span>Loading…</div>

<div class="col">
  <div class="lbl">Book</div>
  <select id="bookSel" onchange="onBookChange()"></select>
</div>

<div class="row">
  <div class="col">
    <div class="lbl">Chapter</div>
    <input id="chapterIn" type="number" min="1" value="1" onchange="onChapterChange()"/>
  </div>
  <div class="col">
    <div class="lbl">Verse</div>
    <input id="verseIn" type="number" min="1" value="1" onchange="onVerseChange()"/>
  </div>
</div>

<div class="nav">
  <button class="nb sm" onclick="nav('prevChapter')" title="Prev Chapter">Ch&#9664;</button>
  <button class="nb" onclick="nav('prevVerse')" title="Prev Verse">&#9664;</button>
  <button class="nb" onclick="nav('nextVerse')" title="Next Verse">&#9654;</button>
  <button class="nb sm" onclick="nav('nextChapter')" title="Next Chapter">&#9654;Ch</button>
</div>

<script>
const BOOKS = ${booksJson};
let _state = null;
let _busy = false;

const bookSel = document.getElementById('bookSel');
const chapterIn = document.getElementById('chapterIn');
const verseIn = document.getElementById('verseIn');

BOOKS.forEach((name, i) => {
  const opt = document.createElement('option');
  opt.value = i + 1; opt.textContent = name;
  bookSel.appendChild(opt);
});

function setDot(cls) {
  const d = document.getElementById('dot');
  if (d) d.className = cls;
}

function applyState(s) {
  _state = s;
  const d = document.getElementById('dot');
  const dotHtml = '<span id="dot" class="' + (d ? d.className : 'ok') + '"></span>';
  document.getElementById('ref').innerHTML = dotHtml + s.reference;
  bookSel.value = s.book;
  chapterIn.max = s.chapterCount; chapterIn.value = s.chapter;
  verseIn.max = s.verseCount;     verseIn.value = s.verse;
}

function connect() {
  const es = new EventSource('/events');
  es.onopen = () => setDot('ok');
  es.onmessage = e => { try { applyState(JSON.parse(e.data)); } catch{} };
  es.onerror = () => { setDot('err'); es.close(); setTimeout(connect, 2000); };
}
connect();
fetch('/state').then(r=>r.json()).then(applyState).catch(()=>{});

function post(body) {
  if (_busy) return;
  _busy = true;
  fetch('/navigate', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body)
  }).finally(() => { _busy = false; });
}

function nav(action) { post({action}); }
function onBookChange() { post({book:parseInt(bookSel.value),chapter:1,verse:1}); }
function onChapterChange() { if(_state) post({book:_state.book,chapter:parseInt(chapterIn.value)||1,verse:1}); }
function onVerseChange()   { if(_state) post({book:_state.book,chapter:_state.chapter,verse:parseInt(verseIn.value)||1}); }

document.addEventListener('keydown', e => {
  if (e.target.tagName==='INPUT'||e.target.tagName==='SELECT') return;
  if (e.key==='ArrowRight') nav('nextVerse');
  else if (e.key==='ArrowLeft') nav('prevVerse');
  else if (e.key==='ArrowUp') nav('prevChapter');
  else if (e.key==='ArrowDown') nav('nextChapter');
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

let _server: http.Server | null = null;

export function stopControlServer(): void {
  if (_server) {
    sseClients.forEach((res) => { try { res.end(); } catch {} });
    sseClients.clear();
    _server.close();
    _server = null;
    console.log("[Control] Panel stopped");
  }
}

export function startControlServer(port = 9876): http.Server {
  if (_server) return _server; // already running
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

  _server = server;
  return server;
}
