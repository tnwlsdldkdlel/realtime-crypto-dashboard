import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
