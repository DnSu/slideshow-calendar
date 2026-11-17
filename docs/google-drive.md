# Google Drive: pictures, date folders and Emergency Override

## Make the folder public and find its ID

1. In Google Drive, right-click the folder, Share, General access: **Anyone with the link** (Viewer).
2. Open the folder. The URL looks like `https://drive.google.com/drive/folders/<FOLDER_ID>`. The last part is `DRIVE_FOLDER_ID`.
3. Put image files in it. Only image files are shown, sorted by name (root first, then folders by name).

## Folders for dates

Inside the root folder you can make subfolders (one level only; deeper folders are ignored):

| Folder name | Shown |
|---|---|
| (root folder) | always |
| `2026-12` | until Dec 31, 2026 |
| `2026-12-31` | until Dec 31, 2026 |
| `2026-12-01 2026-12-31` | from Dec 1 through Dec 31, 2026 |
| `0000-06-15 0000-07-05` | **every year**, Jun 15 through Jul 5 |
| `0000-12-15 0000-01-05` | every year, Dec 15 through Jan 5 (wraps over New Year) |
| `0000-06` | every year, all of June |
| `0000-11 0000-12` | every year, Nov 1 through Dec 31 |
| `0000-12-25` | every year, Dec 25 only |

Year `0000` means "every year": only the month and day are matched. Both parts of a range must use `0000`; mixing (`0000-06-15 2026-07-05`) is ignored. `0000-02-29` only shows in leap years.

Any folder name can end with ` - description` (for example `2026-12-01 2026-12-31 - Pool closed`). Everything after the first ` - ` (spaces on both sides; `–` and `—` work too) is ignored, unless it starts with a date: `2026-12-01 - 2026-12-31` is read as a range.

Dates are whole days (inclusive) in `TIMEZONE`. Any other folder name is ignored and noted in the server log.

For the people who manage the pictures, [`docs/HOW-TO-USE-THIS-FOLDER.txt`](HOW-TO-USE-THIS-FOLDER.txt) explains these rules in plain language. Copy it into the root of the Drive folder; text files are never shown on screen.

## Emergency Override folder

Make a folder named **`Emergency Override`** in the root of the Drive folder. While it holds at least one image, screens show **only** those images (in name order) and skip everything else, including the calendar and weather. Delete or move the images out and the normal slideshow comes back. An empty folder does nothing, so it can stay in place, ready to use.

It goes out like any other change: within about 70 minutes on its own, or within about 10 minutes if someone presses **Refresh** on `/slideshow` after adding or removing the images. `/slideshow` shows "Emergency Override active" while it's on.

## Replacing a picture

Upload the new file under the same name (or use Drive's "Manage versions"). The image address includes a version taken from Drive's "last modified" time, so screens and the CDN fetch the new picture instead of their saved copy.

Screen behavior settings can also be changed from the folder with a `config.json`: see [Settings](settings.md).

[← Back to the README](../README.md)
