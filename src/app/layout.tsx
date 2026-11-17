import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter (Google Fonts, SIL Open Font License), self-hosted by next/font at build time: the browser
// never contacts Google, the files are cached for offline use like the rest of the app, and text
// renders the same on every player instead of depending on the Pi's installed fonts.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Slideshow",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Literal black (not var(--color-bg)) so the screen is black even before or without the CSS.
    <html lang="en" className={inter.variable} style={{ background: "#000" }}>
      <body style={{ background: "#000" }}>{children}</body>
    </html>
  );
}
