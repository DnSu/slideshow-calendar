import { Suspense } from "react";
import PreviewNav from "@/components/PreviewNav";

/**
 * Shared shell for the developer previews (/slideshow, /calendar). The menu lives here so it
 * stays mounted while switching between them. The signage player at `/` is not inside it.
 */
export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="preview-shell">
      <Suspense fallback={<nav className="preview-nav" />}>
        <PreviewNav />
      </Suspense>
      {children}
    </div>
  );
}
