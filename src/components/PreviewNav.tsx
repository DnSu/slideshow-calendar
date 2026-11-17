"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./PreviewNav.module.css";

const TABS = [
  { href: "/slideshow", label: "Slideshow" },
  { href: "/calendar", label: "Calendar" },
  { href: "/weather", label: "Weather" },
];

/** Menu shared by the developer previews. Keeps the `?demo` choice when switching. */
export default function PreviewNav() {
  const pathname = usePathname();
  const demo = useSearchParams().has("demo");
  const withDemo = (href: string, on: boolean) => (on ? `${href}?demo` : href);

  return (
    <nav className={styles.previewNav}>
      <span className={styles.previewNavTitle}>Preview</span>
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={withDemo(t.href, demo)}
          className={pathname === t.href ? styles.active : undefined}
          aria-current={pathname === t.href ? "page" : undefined}
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
      >
        Sample data: {demo ? "on" : "off"}
      </Link>
      <Link href="/" target="_blank" rel="noopener">
        Open screen ↗
      </Link>
    </nav>
  );
}
