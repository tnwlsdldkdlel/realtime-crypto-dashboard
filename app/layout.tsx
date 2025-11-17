import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "실시간 암호화폐 대시보드",
  description: "Next.js 기반 고성능 실시간 암호화폐 대시보드",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="bg-gray-900 text-white">
        <Header />
        {children}
      </body>
    </html>
  );
}
