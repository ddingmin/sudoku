// 난이도별 키 컬러 (라이트 기준 고정값 — 공유 이미지/영상/OG/플러드용)
// 인앱 토큰은 globals.css의 [data-difficulty] 블록이 동일 값으로 정의한다.
import { Difficulty } from "./sudoku";

export interface DiffTheme {
  primary: string; // 키 컬러 — 사용자 숫자/CTA/플러드
  strong: string; // 딥톤 — 체커 패턴/눌림
  peer: string; // 하이라이트 틴트 (영상 셀 배경)
  heatRgb: string; // 히트맵용 "r, g, b"
}

export const DIFF_THEME: Record<Difficulty, DiffTheme> = {
  easy: { primary: "#00a356", strong: "#008144", peer: "#e7f6ec", heatRgb: "0, 163, 86" },
  normal: { primary: "#2b4cff", strong: "#1e38cc", peer: "#eef2ff", heatRgb: "43, 76, 255" },
  hard: { primary: "#7a3bff", strong: "#5f2bcc", peer: "#f1ebff", heatRgb: "122, 59, 255" },
  expert: { primary: "#ff5c00", strong: "#cc4900", peer: "#fff1e6", heatRgb: "255, 92, 0" },
};
