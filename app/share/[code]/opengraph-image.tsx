// 공유 링크 미리보기 카드 — next/og 동적 생성 (키치 팝)
import { ImageResponse } from "next/og";
import { decodeRecord, formatTime } from "@/lib/encode";
import { DIFFICULTY_LABEL, dailyNumber } from "@/lib/sudoku";
import { DIFF_THEME } from "@/lib/palette";
import { OG as C, OG_SIZE, Fallback, Flood, Sticker, ogFonts } from "@/lib/og";

export const alt = "스도쿠 클리어 기록";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const record = decodeRecord(code);

  const fonts = await ogFonts();

  if (!record) return new ImageResponse(<Fallback color={DIFF_THEME.normal.primary} />, { ...size, fonts });

  const T = DIFF_THEME[record.difficulty];
  return new ImageResponse(
    (
      <Flood color={T.primary} deep={T.strong}>
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
          {record.best && <Sticker text="신기록!" bg={C.danger} color={C.surface} style={{ top: -26, right: -18, transform: "rotate(7deg)" }} />}
          {record.streak > 1 && (
            <Sticker text={`${record.streak}일 연속`} bg={C.pop} color={C.ink} style={{ top: 150, left: -30, fontSize: 24, padding: "12px 20px", transform: "rotate(-8deg)" }} />
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
      </Flood>
    ),
    { ...size, fonts },
  );
}
