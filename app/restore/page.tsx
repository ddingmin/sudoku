import type { Metadata } from "next";
import RestoreClient from "@/components/RestoreClient";

export const metadata: Metadata = {
  title: "기록 불러오기 · 스도쿠",
  robots: { index: false },
};

// 기록 코드는 URL 해시(#)에 있어 서버에 오지 않는다 — 클라이언트에서 읽는다
export default function RestorePage() {
  return <RestoreClient />;
}
