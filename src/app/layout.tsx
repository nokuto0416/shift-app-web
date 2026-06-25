import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "ShiftApp",
  description: "シンプルでなじみやすいシフト提出・管理アプリケーション",
  manifest: "/manifest.json", // For PWA
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ShiftApp",
  }
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <PwaRegister />
        <div className="app-layout min-h-screen flex flex-col">
          <Header />
          <div className="flex-grow">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
