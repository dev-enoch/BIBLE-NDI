import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { Verse, BibleVersion } from "../shared/types";

const BIBLE_DIR = (() => {
  if (__dirname.includes("app.asar")) {
    const root = path
      .dirname(path.dirname(__dirname))
      .replace("app.asar", "app.asar.unpacked");
    return path.join(root, "bible");
  }
  return path.join(__dirname, "../../bible");
})();

// ─── Supported file extensions ─────────────────────────────────────────────────
// .spb files are removed — they may use a proprietary non-SQLite format.
// Only include extensions we can confirm are valid SQLite containers.
const SUPPORTED_EXTS = [".sqlite", ".sqlite3", ".db"];

// ─── SQLite validation ─────────────────────────────────────────────────────────
// better-sqlite3 opens files lazily, so new Database() does NOT throw for
// non-SQLite files. We probe sqlite_master (always present in any valid SQLite
// database) to force early validation. This throws SQLITE_NOTADB for invalid
// files, which callers can catch.

function assertValidSqlite(raw: Database.Database): void {
  raw.prepare("SELECT count(*) FROM sqlite_master").get();
}

// ─── Schema adapter ────────────────────────────────────────────────────────────
//
// Different Bible database formats share SQLite storage but vary in schema:
//
//  "standard"  ─ verses(id, book, chapter, verse, text)
//                Used by most generic SQLite Bibles
//
//  "mysword"   ─ Bible(Book, Chapter, Verse, Scripture)
//                Used by MySword .spb and some .db files
//

type Schema = "standard" | "mysword";

interface SchemaAdapter {
  schema: Schema;
  chapterCountSQL: string;
  verseCountSQL: string;
  verseSQL: string;
  /** Map raw row → normalised Verse */
  mapRow: (
    row: Record<string, unknown>,
    book: number,
    ch: number,
    vs: number,
  ) => Verse;
}

const ADAPTERS: Record<Schema, SchemaAdapter> = {
  standard: {
    schema: "standard",
    chapterCountSQL: "SELECT MAX(chapter) AS count FROM verses WHERE book = ?",
    verseCountSQL:
      "SELECT MAX(verse)   AS count FROM verses WHERE book = ? AND chapter = ?",
    verseSQL:
      "SELECT * FROM verses WHERE book = ? AND chapter = ? AND verse = ?",
    mapRow: (row, _b, _c, _v) => row as unknown as Verse,
  },
  mysword: {
    schema: "mysword",
    chapterCountSQL: "SELECT MAX(Chapter) AS count FROM Bible WHERE Book = ?",
    verseCountSQL:
      "SELECT MAX(Verse)   AS count FROM Bible WHERE Book = ? AND Chapter = ?",
    verseSQL:
      "SELECT Book, Chapter, Verse, Scripture FROM Bible WHERE Book = ? AND Chapter = ? AND Verse = ?",
    mapRow: (row, book, chapter, verse) => ({
      id: book * 1000000 + chapter * 1000 + verse,
      book,
      chapter,
      verse,
      text: String((row as { Scripture?: unknown }).Scripture ?? ""),
    }),
  },
};

function detectSchema(raw: Database.Database): Schema {
  // Check for MySword schema first (Bible table with Scripture column)
  try {
    raw.prepare("SELECT Scripture FROM Bible LIMIT 1").get();
    return "mysword";
  } catch {
    /* fall through */
  }
  return "standard";
}

// ─── Active state ──────────────────────────────────────────────────────────────

interface ActiveDb {
  raw: Database.Database;
  adapter: SchemaAdapter;
}

function openDb(filename: string): ActiveDb {
  const p = path.join(BIBLE_DIR, filename);
  const raw = new Database(p, { readonly: true });
  // Throws SQLITE_NOTADB immediately if the file is not a valid SQLite database.
  // This prevents a bad connection from ever being stored in `active`.
  assertValidSqlite(raw);
  const schema = detectSchema(raw);
  return { raw, adapter: ADAPTERS[schema] };
}

let active = openFirstAvailable();

function openFirstAvailable(): ActiveDb {
  // Try kjv.sqlite first, then whatever exists
  const candidates = ["kjv.sqlite", "kjv.spb", "kjv.db"];
  for (const c of candidates) {
    try {
      return openDb(c);
    } catch {
      /* try next */
    }
  }
  // Try scanning the bible dir
  try {
    const files = fs
      .readdirSync(BIBLE_DIR)
      .filter((f) => SUPPORTED_EXTS.includes(path.extname(f).toLowerCase()))
      .sort();
    if (files.length) return openDb(files[0]);
  } catch {
    /* ignore */
  }
  // Last resort: open a non-existent path; queries will fail gracefully
  throw new Error("No Bible database found in bible/ directory");
}

// ─── Name extraction ───────────────────────────────────────────────────────────

function displayName(filename: string): string {
  try {
    const { raw, adapter } = openDb(filename);

    const metaQueries: Array<[string, string]> = [
      // MySword / TheWord
      ["SELECT Title FROM Details LIMIT 1", "Title"],
      ["SELECT Abbreviation FROM Details LIMIT 1", "Abbreviation"],
      // Other standard SQLite schemas
      ["SELECT value FROM meta WHERE field = 'name' LIMIT 1", "value"],
      ["SELECT value FROM meta WHERE field = 'translation' LIMIT 1", "value"],
      ["SELECT value FROM meta WHERE field = 'abbreviation' LIMIT 1", "value"],
      ["SELECT value FROM meta WHERE field = 'description' LIMIT 1", "value"],
      ["SELECT name FROM info LIMIT 1", "name"],
      ["SELECT shortName FROM info LIMIT 1", "shortName"],
    ];

    // Override: for mysword show abbreviation, then title
    const order =
      adapter.schema === "mysword"
        ? [metaQueries[1], metaQueries[0], ...metaQueries.slice(2)]
        : metaQueries;

    for (const [sql, col] of order) {
      try {
        const row = raw.prepare(sql).get() as
          | Record<string, string>
          | undefined;
        const val = row?.[col];
        if (val?.trim()) {
          raw.close();
          return val.trim();
        }
      } catch {
        /* table not present */
      }
    }
    raw.close();
  } catch {
    /* file unreadable */
  }

  // Fallback: uppercase stem, e.g. "esv.spb" → "ESV"
  return path.basename(filename, path.extname(filename)).toUpperCase();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function listVersions(): BibleVersion[] {
  try {
    const files = fs
      .readdirSync(BIBLE_DIR)
      .filter((f) => SUPPORTED_EXTS.includes(path.extname(f).toLowerCase()))
      .sort();

    const versions: BibleVersion[] = [];
    for (const id of files) {
      // Probe the file directly — openDb calls assertValidSqlite so any
      // non-SQLite file will throw here and be silently skipped.
      let probe: ActiveDb | null = null;
      try {
        probe = openDb(id);
        probe.raw.close();
      } catch {
        continue; // not a valid SQLite database
      }
      versions.push({ id, name: displayName(id) });
    }
    return versions;
  } catch {
    return [];
  }
}

export function setVersion(filename: string): { ok: boolean; error?: string } {
  try {
    if (filename.includes("/") || filename.includes("\\"))
      return { ok: false, error: "Invalid filename" };
    const next = openDb(filename);
    active.raw.close();
    active = next;
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: String(e) };
  }
}

export function getChapterCount(book: number): number {
  const row = active.raw.prepare(active.adapter.chapterCountSQL).get(book) as {
    count: number;
  };
  return row?.count ?? 0;
}

export function getVerseCount(book: number, chapter: number): number {
  const row = active.raw
    .prepare(active.adapter.verseCountSQL)
    .get(book, chapter) as { count: number };
  return row?.count ?? 0;
}

export function getVerse(
  book: number,
  chapter: number,
  verse: number,
): Verse | null {
  const row = active.raw
    .prepare(active.adapter.verseSQL)
    .get(book, chapter, verse) as Record<string, unknown> | undefined;
  if (!row) return null;
  return active.adapter.mapRow(row, book, chapter, verse);
}
