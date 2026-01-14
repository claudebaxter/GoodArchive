import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GoodArchive",
  description: "GoodArchive - archive of public rhetoric with moderation and safeguards",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/icon.png", sizes: "32x32", type: "image/png" },
      { url: "icon.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: ["/icon.png"],
    apple: ["/icon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers>
          <header className="site-header">
            <nav className="nav">
              <Link href="/">Submit</Link>
              <Link href="/feed">Feed</Link>
              <Link href="/search">Search</Link>
              <Link href="/dashboard">Dashboard</Link>
              <div className="brand">
                <img src="/goodarchive-logo.png" alt="GoodArchive" className="logo" />
                <span>GoodArchive</span>
              </div>
            </nav>
          </header>
          <div className="container">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
