import type { MetadataRoute } from "next";

// PWA 매니페스트 — 홈 화면 추가(A2HS) 시 앱 아이콘/이름
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "스도쿠",
    short_name: "스도쿠",
    description: "매일 자정 새로운 스도쿠가 열려요. 기록을 공유할 수 있습니다.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf8f3",
    theme_color: "#2b4cff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
