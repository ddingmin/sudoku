import type { Metadata, Viewport } from "next";
import { Bagel_Fat_One } from "next/font/google";
import "./globals.css";

const bagel = Bagel_Fat_One({
  weight: "400",
  preload: false, // 한글 서브셋 포함 로드를 위해 unicode-range 기반 전체 서브셋 사용
  variable: "--font-bagel",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000"),
  ),
  title: "스도쿠 — 매일 한 판",
  description: "매일 자정 새로운 스도쿠가 열려요. 기록을 공유할 수 있습니다.",
  openGraph: {
    title: "스도쿠 — 매일 한 판",
    description: "매일 자정 새로운 스도쿠가 열려요. 기록을 공유할 수 있습니다.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#14151a" },
  ],
};

const themeInit = `try{var t=localStorage.getItem("sudoku:theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning className={bagel.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
