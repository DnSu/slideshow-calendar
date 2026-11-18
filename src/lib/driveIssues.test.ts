import { describe, expect, it } from "vitest";
import type { DriveEntry } from "@/lib/drive";
import { emptyFolderIssue, entryIssue, listingIssues, notAPicture } from "@/lib/driveIssues";

let n = 0;
const file = (name: string, mime: string | null = null): DriveEntry => ({
  id: `fakeEntryId${String(n++).padStart(12, "0")}`,
  name,
  mime,
  isFolder: false,
});
const folder = (name: string): DriveEntry => ({ ...file(name, "application/vnd.google-apps.folder"), isFolder: true });

describe("entryIssue", () => {
  it("expects only pictures, config.json and the how-to file in the main folder", () => {
    expect(entryIssue(file("a.jpg", "image/jpeg"), "root")).toBeNull();
    expect(entryIssue(file("b.PNG"), "root")).toBeNull();
    expect(entryIssue(file("config.json", "application/json"), "root")).toBeNull();
    expect(entryIssue(file("HOW-TO-USE-THIS-FOLDER.txt", "text/plain"), "root")).toBeNull();
    expect(entryIssue(folder("2026-12"), "root")).toBeNull();
    expect(entryIssue(file("notes.txt", "text/plain"), "root")).toMatch(/text file/);
    expect(entryIssue(file("flyer.pdf", "application/pdf"), "root")).toMatch(/^is a PDF/);
  });
  it("flags everything but pictures inside a folder", () => {
    expect(entryIssue(file("a.jpg", "image/jpeg"), "folder")).toBeNull();
    expect(entryIssue(folder("more"), "folder")).toMatch(/folder inside a folder/);
    expect(entryIssue(file("config.json"), "folder")).toMatch(/only work in the main folder/);
    expect(entryIssue(file("config", "application/vnd.google-apps.document"), "folder")).toMatch(/only work in the main folder/);
    expect(entryIssue(file("config", "application/vnd.google-apps.document"), "root")).toBeNull();
    expect(entryIssue(file("Notes", "application/vnd.google-apps.document"), "root")).toMatch(/Google Docs/);
    expect(entryIssue(file("HOW-TO-USE-THIS-FOLDER.txt"), "folder")).toMatch(/text file/);
  });
  it("flags pictures put straight into Holidays", () => {
    expect(entryIssue(file("tree.jpg", "image/jpeg"), "holidays")).toMatch(/directly in "Holidays"/);
    expect(entryIssue(folder("July 4"), "holidays")).toBeNull();
  });
});

describe("notAPicture", () => {
  it("names the kind of file and what to do", () => {
    expect(notAPicture(file("x.mov", "video/quicktime"))).toMatch(/^is a video/);
    expect(notAPicture(file("x.mp4"))).toMatch(/^is a video/);
    expect(notAPicture(file("Poster", "application/vnd.google-apps.presentation"))).toMatch(/Google Docs, Slides/);
    expect(notAPicture(file("link", "application/vnd.google-apps.shortcut"))).toMatch(/shortcut/);
    expect(notAPicture(file("notice.docx"))).toMatch(/^is a document/);
    expect(notAPicture(file("IMG_1.HEIC"))).toMatch(/HEIC/);
    expect(notAPicture(file("archive.zip", "application/zip"))).toMatch(/^isn't a picture/);
  });
});

describe("listingIssues / emptyFolderIssue", () => {
  it("names each entry by its path", () => {
    const entries = [file("a.jpg", "image/jpeg"), file("menu.pdf", "application/pdf")];
    expect(listingIssues("Holidays › July 4", entries, "folder")).toEqual([
      { name: "Holidays › July 4 › menu.pdf", reason: expect.stringMatching(/^is a PDF/) },
    ]);
    expect(listingIssues(null, entries, "root").map((i) => i.name)).toEqual(["menu.pdf"]);
  });
  it("flags a folder with no pictures", () => {
    expect(emptyFolderIssue("2026-12", [file("menu.pdf", "application/pdf")])).toEqual({
      name: "2026-12",
      reason: "has no pictures in it",
    });
    expect(emptyFolderIssue("2026-12", [file("a.jpg", "image/jpeg")])).toBeNull();
  });
});
