import type { Metadata } from "next";
import StoreProvider from "./providers";
import "./globals.css";
import "katex/dist/katex.min.css";
import "../components/features/index.css";
// import "./test/index.less";
export const metadata: Metadata = {
  title: "AI Tools",
  description: "AI Tools Application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className="min-h-screen bg-zinc-950 font-sans antialiased"
        suppressHydrationWarning
      >
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
