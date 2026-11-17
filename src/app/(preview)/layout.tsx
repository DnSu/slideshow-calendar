import { Suspense } from "react";
import PreviewNav from "@/components/PreviewNav";
import styles from "./layout.module.css";
import navStyles from "@/components/PreviewNav.module.css";

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
    <div className={styles.previewShell}>
      <Suspense fallback={<nav className={navStyles.previewNav} />}>
        <PreviewNav />
      </Suspense>
      {children}
    </div>
  );
}
