import { configKind } from "./config";
import { isImageEntry, type DriveEntry } from "./drive";
import type { DriveIssue } from "./types";

/**
 * Plain-language notes on things in the Drive folder that won't show on the screen
 * (a PDF, a video, a folder inside a dated folder, …), for the /slideshow preview.
 * `reason`s are read by the people who manage the folder, not developers.
 */

/** Where an entry sits, which changes what's expected there. */
export type Place =
  /** The main folder: pictures, plus the settings file ("config" Doc, config.txt or config.json) and HOW-TO-USE-THIS-FOLDER.txt. */
  | "root"
  /** A dated folder, a holiday folder or Emergency Override: pictures only. */
  | "folder"
  /** Directly inside "Holidays": only holiday folders. */
  | "holidays";

const GUIDE_NAME = "how-to-use-this-folder.txt";
const isNamed = (e: DriveEntry, name: string) => e.name.trim().toLowerCase() === name;

const ext = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() ?? "";
const VIDEO_EXT = new Set(["mp4", "mov", "m4v", "avi", "webm", "mkv", "wmv"]);
const DOC_EXT = new Set(["doc", "docx", "ppt", "pptx", "xls", "xlsx", "key", "pages", "odt", "odp", "rtf"]);
const TEXT_EXT = new Set(["txt", "md", "json"]);

/** Why a file that isn't a picture won't show, with what to do instead. */
export function notAPicture(e: DriveEntry): string {
  const mime = e.mime ?? "";
  const x = ext(e.name);
  if (mime === "application/pdf" || x === "pdf")
    return "is a PDF; only pictures are shown. Save the page as a JPG or PNG and add that instead";
  if (mime.startsWith("video/") || VIDEO_EXT.has(x)) return "is a video; only pictures are shown";
  if (mime === "application/vnd.google-apps.shortcut")
    return "is a shortcut; shortcuts aren't followed. Put the picture itself in the folder";
  if (mime.startsWith("application/vnd.google-apps."))
    return "is a Google Docs, Slides, Sheets or Drawings file; download it as a PNG or JPG and add that instead";
  if (DOC_EXT.has(x) || mime.startsWith("application/vnd.openxmlformats") || mime.startsWith("application/msword"))
    return "is a document; save it as a PNG or JPG and add that instead";
  if (x === "heic" || x === "heif")
    return "is an iPhone HEIC photo that can't be shown; export it as a JPG and add that instead";
  if (TEXT_EXT.has(x) || mime.startsWith("text/")) return "is a text file; it isn't shown on the screen";
  return "isn't a picture (JPG, PNG, GIF or WebP), so it isn't shown";
}

/** What's wrong with one entry in `place`, or null if it's fine there. */
export function entryIssue(e: DriveEntry, place: Place): string | null {
  if (place === "root") {
    if (e.isFolder || isImageEntry(e) || configKind(e) || isNamed(e, GUIDE_NAME)) return null;
    return notAPicture(e);
  }
  if (place === "holidays") {
    if (e.isFolder) return null; // holiday folders are checked by name
    if (isImageEntry(e))
      return 'is directly in "Holidays", so it isn\'t shown. Put it in a folder named for the holiday, like "July 4"';
    return notAPicture(e);
  }
  if (e.isFolder) return "is a folder inside a folder; those aren't read. Move its pictures up one level";
  if (isImageEntry(e)) return null;
  if (configKind(e)) return "settings only work in the main folder, not inside another folder";
  return notAPicture(e);
}

/** Issues for every entry in a listing, named "<path> › <file>". */
export function listingIssues(path: string | null, entries: DriveEntry[], place: Place): DriveIssue[] {
  const out: DriveIssue[] = [];
  for (const e of entries) {
    const reason = entryIssue(e, place);
    if (reason) out.push({ name: path ? `${path} › ${e.name}` : e.name, reason });
  }
  return out;
}

/** A dated or holiday folder with no pictures in it, or null. */
export function emptyFolderIssue(path: string, entries: DriveEntry[]): DriveIssue | null {
  return entries.some(isImageEntry) ? null : { name: path, reason: "has no pictures in it" };
}
