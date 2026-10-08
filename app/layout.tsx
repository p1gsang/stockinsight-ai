import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StockInsight AI · 美的集团证据研究",
  description: "从经营信号出发，沿真实财报证据继续研究。事实、推断与未知分别呈现。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
