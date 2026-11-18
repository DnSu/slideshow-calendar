"use client";

import { useEffect, useState } from "react";
import type { ConfigFileCheck } from "@/lib/config";
import type { DriveIssue, DriveIssues } from "@/lib/types";
import styles from "./DriveIssuesPanel.module.css";

type Props = { issues?: DriveIssues; configFile?: ConfigFileCheck };

/**
 * Under the /slideshow preview: things in the Drive folder that won't show on the screen
 * (folders with names that aren't understood, files that aren't pictures, mistakes in the
 * settings Doc or an old config.json), in plain words, so whoever manages the folder can fix them.
 */
export default function DriveIssuesPanel({ issues, configFile }: Props) {
  const folders = issues?.folders ?? [];
  const files = issues?.files ?? [];
  const count = folders.length + files.length + (configFile ? 1 : 0);
  if (!count) return null;

  return (
    <section className={styles.panel} aria-label="Problems in the Drive folder">
      <h2 className={styles.title}>
        {count === 1 ? "1 thing in the Drive folder needs attention" : `${count} things in the Drive folder need attention`}
      </h2>
      {folders.length > 0 && <IssueList heading="Folders" items={folders} />}
      {files.length > 0 && <IssueList heading="Files that won't show" items={files} />}
      {configFile && <ConfigFile check={configFile} />}
      <p className={styles.hint}>Fix them in Drive (see HOW-TO-USE-THIS-FOLDER.txt), then press ⟳.</p>
    </section>
  );
}

function IssueList({ heading, items }: { heading: string; items: DriveIssue[] }) {
  return (
    <>
      <h3 className={styles.heading}>{heading}</h3>
      <ul className={styles.list}>
        {items.map((f) => (
          <li key={f.name}>
            <strong className={styles.name}>{f.name}</strong> {f.reason}
          </li>
        ))}
      </ul>
    </>
  );
}

function ConfigFile({ check }: { check: ConfigFileCheck }) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 4000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(check.fixed);
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
  };

  return (
    <>
      <h3 className={styles.heading}>Settings ({check.name})</h3>
      <ul className={styles.list}>
        {check.problems.map((p) => (
          <li key={p}>{p}</li>
        ))}
        {check.note && <li>{check.note}</li>}
        {check.missing.length > 0 && (
          <li>
            It doesn&apos;t have {check.missing.length === 1 ? "this setting" : "these settings"}, so{" "}
            {check.missing.length === 1 ? "it uses its default" : "they use their defaults"}:{" "}
            {check.missing.join(", ")}
          </li>
        )}
      </ul>
      <div className={styles.copyRow}>
        <button type="button" className={styles.copy} onClick={() => void copy()}>
          Copy fixed settings
        </button>
        <span className={styles.copyNote} role="status">
          {copied === "yes"
            ? check.kind === "doc"
              ? 'Copied. In the "config" Doc, select everything and paste.'
              : 'Copied. Paste it into a Google Doc named "config" in the main folder.'
            : copied === "failed"
              ? "Couldn't copy; your browser blocked it."
              : "Keeps your valid settings; everything else is the current default."}
        </span>
      </div>
    </>
  );
}
