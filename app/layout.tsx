import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "광고인 경영지원 대시보드",
  description: "Finance Ops Dashboard for 광고인"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
