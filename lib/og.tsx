// OG 이미지 공용 — 공유(/share)와 대결(/duel) 미리보기가 함께 쓴다. satori 제약(gradient 미지원 등) 고려
import { readFile } from "node:fs/promises";
import path from "node:path";

// 라이트 팔레트 고정값 (OG는 테마 무관)
export const OG = {
  surface: "#ffffff",
  ground: "#faf8f3",
  ink: "#141414",
  inkFaint: "#9b978c",
  pop: "#c8f04d",
  danger: "#e93a5e",
} as const;

export const OG_SIZE = { width: 1200, height: 630 };

function loadFont(file: string) {
  return readFile(path.join(process.cwd(), "assets", "fonts", file));
}

export async function ogFonts() {
  const [bagel, sansBold, sansMedium] = await Promise.all([
    loadFont("BagelFatOne-Regular.ttf"),
    loadFont("Pretendard-Bold.otf"),
    loadFont("Pretendard-Medium.otf"),
  ]);
  return [
    { name: "Bagel Fat One", data: bagel, weight: 400 as const, style: "normal" as const },
    { name: "Pretendard", data: sansBold, weight: 700 as const, style: "normal" as const },
    { name: "Pretendard", data: sansMedium, weight: 500 as const, style: "normal" as const },
  ];
}

// 체커 스트립 (satori는 repeating-conic-gradient 미지원 → 사각형 나열)
export function Checker({ cells, cellSize, color }: { cells: number; cellSize: number; color: string }) {
  return (
    <div style={{ display: "flex" }}>
      {Array.from({ length: cells }, (_, i) => (
        <div key={i} style={{ width: cellSize, height: cellSize * 2, display: "flex", flexDirection: "column" }}>
          <div style={{ width: cellSize, height: cellSize, background: i % 2 === 0 ? color : "transparent" }} />
          <div style={{ width: cellSize, height: cellSize, background: i % 2 === 1 ? color : "transparent" }} />
        </div>
      ))}
    </div>
  );
}

// 플러드 배경 + 상하단 체커 프레임
export function Flood({ color, deep, children }: { color: string; deep: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: color,
        fontFamily: "Pretendard",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, display: "flex", opacity: 0.55 }}>
        <Checker cells={38} cellSize={32} color={deep} />
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, display: "flex", opacity: 0.55 }}>
        <Checker cells={38} cellSize={32} color={deep} />
      </div>
      {children}
    </div>
  );
}

// 회전 스티커
export function Sticker({ text, bg, color, style }: { text: string; bg: string; color: string; style: React.CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        background: bg,
        color,
        fontSize: 26,
        fontWeight: 700,
        padding: "14px 22px",
        borderRadius: 16,
        border: `4px solid ${OG.ink}`,
        boxShadow: `6px 6px 0 ${OG.ink}`,
        ...style,
      }}
    >
      {text}
    </div>
  );
}

// 코드 없음/깨짐 폴백
export function Fallback({ color }: { color: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: color,
        fontFamily: "Bagel Fat One",
        fontSize: 64,
        color: OG.surface,
      }}
    >
      스도쿠
    </div>
  );
}
