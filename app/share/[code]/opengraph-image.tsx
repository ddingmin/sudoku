// 공유 링크 미리보기 카드 — next/og 동적 생성 (키치 팝)
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { decodeRecord, formatTime } from "@/lib/encode";
import { DIFFICULTY_LABEL, dailyNumber } from "@/lib/sudoku";
import { DIFF_THEME } from "@/lib/palette";

export const alt = "스도쿠 — 클리어 기록";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const C = {
  surface: "#ffffff",
  ground: "#faf8f3",
  ink: "#141414",
  inkFaint: "#9b978c",
  pop: "#c8f04d",
  danger: "#e93a5e",
};

function loadFont(file: string) {
  return readFile(path.join(process.cwd(), "assets", "fonts", file));
}

// 체커 스트립 (satori는 repeating-conic-gradient 미지원 → 사각형 나열)
function Checker({ cells, cellSize, color }: { cells: number; cellSize: number; color: string }) {
  return (
    <div style={{ display: "flex" }}>
      {Array.from({ length: cells }, (_, i) => (
        <div
          key={i}
          style={{
            width: cellSize,
            height: cellSize * 2,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ width: cellSize, height: cellSize, background: i % 2 === 0 ? color : "transparent" }} />
          <div style={{ width: cellSize, height: cellSize, background: i % 2 === 1 ? color : "transparent" }} />
        </div>
      ))}
    </div>
  );
}

export default async function OgImage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const record = decodeRecord(code);

  const [bagel, sansBold, sansMedium] = await Promise.all([
    loadFont("BagelFatOne-Regular.ttf"),
    loadFont("Pretendard-Bold.otf"),
    loadFont("Pretendard-Medium.otf"),
  ]);

  const fonts = [
    { name: "Bagel Fat One", data: bagel, weight: 400 as const, style: "normal" as const },
    { name: "Pretendard", data: sansBold, weight: 700 as const, style: "normal" as const },
    { name: "Pretendard", data: sansMedium, weight: 500 as const, style: "normal" as const },
  ];

  if (!record) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: DIFF_THEME.normal.primary,
            fontFamily: "Bagel Fat One",
            fontSize: 64,
            color: C.surface,
          }}
        >
          스도쿠 — 매일 한 판
        </div>
      ),
      { ...size, fonts },
    );
  }

  const T = DIFF_THEME[record.difficulty];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: T.primary,
          fontFamily: "Pretendard",
          position: "relative",
        }}
      >
        {/* 상하단 체커 */}
        <div style={{ position: "absolute", top: 0, left: 0, display: "flex", opacity: 0.55 }}>
          <Checker cells={38} cellSize={32} color={T.strong} />
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, display: "flex", opacity: 0.55 }}>
          <Checker cells={38} cellSize={32} color={T.strong} />
        </div>

        {/* 카드 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 860,
            background: C.surface,
            borderRadius: 36,
            border: `4px solid ${C.ink}`,
            boxShadow: `14px 14px 0 ${C.ink}`,
            padding: "36px 56px 32px 56px",
            position: "relative",
          }}
        >
          {/* 신기록 스티커 */}
          {record.best && (
            <div
              style={{
                position: "absolute",
                top: -26,
                right: -18,
                display: "flex",
                background: C.danger,
                color: C.surface,
                fontSize: 26,
                fontWeight: 700,
                padding: "14px 22px",
                borderRadius: 16,
                border: `4px solid ${C.ink}`,
                boxShadow: `6px 6px 0 ${C.ink}`,
                transform: "rotate(7deg)",
              }}
            >
              신기록!
            </div>
          )}
          {/* 스트릭 스티커 */}
          {record.streak > 1 && (
            <div
              style={{
                position: "absolute",
                top: 150,
                left: -30,
                display: "flex",
                background: C.pop,
                color: C.ink,
                fontSize: 24,
                fontWeight: 700,
                padding: "12px 20px",
                borderRadius: 16,
                border: `4px solid ${C.ink}`,
                boxShadow: `6px 6px 0 ${C.ink}`,
                transform: "rotate(-8deg)",
              }}
            >
              {record.streak}일 연속
            </div>
          )}

          {/* 헤더 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "Bagel Fat One", fontSize: 40, color: C.ink }}>스도쿠</span>
            <span style={{ fontSize: 22, fontWeight: 500, color: C.inkFaint }}>
              {record.daily ? `#${dailyNumber(record.dateKey)} · ` : "자유 스도쿠 · "}
              {record.dateKey.replace(/-/g, ".")}
            </span>
          </div>

          {/* 타임 */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: 10, color: C.inkFaint }}>클리어 타임</span>
            <div style={{ display: "flex", position: "relative", alignItems: "center", justifyContent: "center" }}>
              <div
                style={{
                  position: "absolute",
                  left: -16,
                  right: -16,
                  top: 88,
                  bottom: 18,
                  background: C.pop,
                  borderRadius: 14,
                  transform: "rotate(-1.5deg)",
                }}
              />
              <span
                style={{
                  fontFamily: "Bagel Fat One",
                  fontSize: 150,
                  lineHeight: 1.15,
                  color: T.primary,
                }}
              >
                {formatTime(record.timeSec)}
              </span>
            </div>
          </div>

          {/* 스탯 칩 */}
          <div style={{ display: "flex", gap: 14, marginTop: 18 }}>
            {[
              ["난이도", DIFFICULTY_LABEL[record.difficulty]],
              ["실수", `${record.mistakes}`],
              ["힌트", `${record.hints}`],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  background: C.ground,
                  border: `3px solid ${C.ink}`,
                  borderRadius: 14,
                  padding: "12px 0",
                }}
              >
                <span style={{ fontSize: 18, fontWeight: 500, color: C.inkFaint }}>{label}</span>
                <span style={{ fontSize: 30, fontWeight: 700, color: C.ink }}>{value}</span>
              </div>
            ))}
            <div
              style={{
                flex: 1.3,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: T.primary,
                border: `3px solid ${C.ink}`,
                borderRadius: 14,
              }}
            >
              <span style={{ fontSize: 24, fontWeight: 700, color: C.surface }}>깰 수 있어? →</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
