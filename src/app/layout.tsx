import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slideshow",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ background: "#000" }}>
      <body style={{ background: "#000" }}>{children}</body>
    </html>
  );
}
