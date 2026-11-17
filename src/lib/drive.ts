/**
 * Everything that knows about Google Drive's page layout lives in this file.
 *
 * UNVERIFIED: the entry parsing below follows the known structure of
 * https://drive.google.com/embeddedfolderview?id=<ID> (`flip-entry` blocks with
 * `id="entry-<fileId>"`, a `flip-entry-title` and a link to `/file/d/<id>/` or
 * `/drive/folders/<id>`), but has only been checked against hand-made fixtures
 * and a real *empty* folder page. The config.json download and the thumbnail URL
 * are likewise unverified against live files.
 */

export type DriveEntry = {
  id: string;
  name: string;
  mime: string | null;
  isFolder: boolean;
  /** Drive's "last modified" text as shown on the page ("7:29 pm", "Nov 10"). Changes when a file is replaced. */
  modified?: string;
};

/**
 * Short, URL-safe token that changes when a file's "last modified" text changes, so a file
 * replaced under the same name (same Drive ID) gets a new image URL and isn't served from cache.
 */
export function fileVersion(modified: string): string {
  let h = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < modified.length; i++) {
    h ^= modified.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export type DriveListing = {
  entries: DriveEntry[];
  /** False when the page didn't look like a Drive folder listing at all. */
  recognized: boolean;
};

const UA = "Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const TIMEOUT_MS = 15_000;

const ID_RE = /^[A-Za-z0-9_-]{6,128}$/;
export const isValidDriveId = (id: string) => ID_RE.test(id);

export function folderListingUrl(folderId: string) {
  return `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}`;
}
export function downloadUrl(fileId: string) {
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
}
export function thumbnailUrl(fileId: string, width = 1920) {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${width}`;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|avif|tiff?)$/i;
export function isImageEntry(e: DriveEntry): boolean {
  if (e.isFolder) return false;
  if (e.mime) return e.mime.startsWith("image/");
  return IMAGE_EXT.test(e.name);
}

/** Pure parser for the embeddedfolderview HTML. Never throws. */
export function parseFolderListing(html: string): DriveListing {
  const startRe = /<div[^>]*\bclass="flip-entry"[^>]*\bid="entry-([A-Za-z0-9_-]+)"|<div[^>]*\bid="entry-([A-Za-z0-9_-]+)"[^>]*\bclass="flip-entry"/g;
  const starts: { id: string; index: number }[] = [];
  for (let m = startRe.exec(html); m; m = startRe.exec(html)) {
    starts.push({ id: m[1] ?? m[2], index: m.index });
  }
  const recognized = starts.length > 0 || html.includes("flip-entries");
  const entries: DriveEntry[] = [];
  starts.forEach((s, i) => {
    const block = html.slice(s.index, i + 1 < starts.length ? starts[i + 1].index : html.length);
    const title = /class="flip-entry-title"[^>]*>([\s\S]*?)<\/div>/.exec(block);
    if (!title) {
      console.warn(`[drive] entry ${i} has no title; skipped`);
      return;
    }
    const name = decodeEntities(title[1].replace(/<[^>]*>/g, "")).trim();
    const mimeMatch = /\/type\/([A-Za-z0-9.+\-]+\/[A-Za-z0-9.+\-]+)/.exec(block);
    const mime = mimeMatch ? mimeMatch[1] : null;
    const isFolder = /\/drive\/folders\//.test(block) || mime === "application/vnd.google-apps.folder";
    const mod = /class="flip-entry-last-modified"[^>]*>\s*<div[^>]*>([^<]*)</.exec(block);
    const modified = mod ? decodeEntities(mod[1]).trim() : "";
    if (name) entries.push({ id: s.id, name, mime, isFolder, ...(modified ? { modified } : {}) });
  });
  if (!recognized) console.warn("[drive] folder page not recognised (layout changed, or not public?)");
  return { entries, recognized };
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, "accept-language": "en" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for Drive request`);
  return res.text();
}

/** List one folder level. Throws on network/HTTP failure. */
export async function listFolder(folderId: string): Promise<DriveListing> {
  return parseFolderListing(await getText(folderListingUrl(folderId)));
}

const MAX_DOWNLOAD_CHARS = 64 * 1024;

/** Download a small public file as text (used for config.json). Throws on failure or if too big. */
export async function downloadText(fileId: string): Promise<string> {
  const text = await getText(downloadUrl(fileId));
  if (text.length > MAX_DOWNLOAD_CHARS) throw new Error(`file is larger than ${MAX_DOWNLOAD_CHARS} characters`);
  return text;
}
