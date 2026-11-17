"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "/slideshow", label: "Slideshow" },
  { href: "/calendar", label: "Calendar" },
];

/** Menu shared by the developer previews. Keeps the `?demo` choice when switching. */
export default function PreviewNav() {
  const pathname = usePathname();
  const demo = useSearchParams().has("demo");
  const withDemo = (href: string, on: boolean) => (on ? `${href}?demo` : href);

  return (
    <nav className="preview-nav">
      <span className="preview-nav-title">Preview</span>
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={withDemo(t.href, demo)}
          className={pathname === t.href ? "active" : undefined}
          aria-current={pathname === t.href ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
      <Link
        href={withDemo(pathname, !demo)}
        className={`preview-nav-toggle${demo ? " active" : ""}`}
        aria-pressed={demo}
      >
        Sample events: {demo ? "on" : "off"}
      </Link>
      <Link
        href="/"
        target="_blank"
        rel="noopener"
        className="preview-nav-screen"
      >
        Open screen ↗
      </Link>
    </nav>
  );
}
