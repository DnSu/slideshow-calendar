"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./PreviewNav.module.css";

const TABS = [
  { href: "/slideshow", label: "Slideshow" },
  { href: "/calendar", label: "Calendar" },
  { href: "/weather", label: "Weather" },
];

/**
 * Menu shared by the developer previews. Keeps the `?demo` choice when switching.
 * On narrow screens the links fold into a ☰ button that opens them in a panel below the bar;
 * it closes after a choice, on Escape, or on a tap outside it.
 */
export default function PreviewNav() {
  const pathname = usePathname();
  const demo = useSearchParams().has("demo");
  const withDemo = (href: string, on: boolean) => (on ? `${href}?demo` : href);

  const [open, setOpen] = useState(false);
  const nav = useRef<HTMLElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const linksId = useId();
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!nav.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = TABS.find((t) => t.href === pathname);

  return (
    <nav ref={nav} className={styles.previewNav}>
      <span className={styles.previewNavTitle}>Preview</span>
      {current && <span className={styles.previewNavCurrent}>{current.label}</span>}
      <button
        ref={button}
        type="button"
        className={styles.menuButton}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls={linksId}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          )}
        </svg>
      </button>
      <div id={linksId} className={open ? `${styles.links} ${styles.open}` : styles.links}>
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={withDemo(t.href, demo)}
            className={pathname === t.href ? styles.active : undefined}
            aria-current={pathname === t.href ? "page" : undefined}
            onClick={close}
          >
            {t.label}
          </Link>
        ))}
        <Link
          href={withDemo(pathname, !demo)}
          className={
            demo
              ? `${styles.previewNavToggle} ${styles.active}`
              : styles.previewNavToggle
          }
          aria-pressed={demo}
          onClick={close}
        >
          Sample data: {demo ? "on" : "off"}
        </Link>
        <Link href="/" target="_blank" rel="noopener" onClick={close}>
          Open screen ↗
        </Link>
      </div>
    </nav>
  );
}
