// 대결 링크 미리보기 — 도전장(⚔️ 시간 + "같은 문제로 붙자") / 답장(VS 결과)
import { ImageResponse } from "next/og";
import { formatTime } from "@/lib/encode";
import { decodeDuel, gapText, judge } from "@/lib/duel";
import { DIFFICULTY_LABEL, dailyNumber } from "@/lib/sudoku";
import { DIFF_THEME } from "@/lib/palette";
import { OG as C, OG_SIZE, Fallback, Flood, Sticker, ogFonts } from "@/lib/og";

export const alt = "스도쿠 — 1:1 대결";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const d = decodeDuel(code);
  const fonts = await ogFonts();
  if (!d) return new ImageResponse(<Fallback color={DIFF_THEME.normal.primary} />, { ...size, fonts });

  const { record, opponent } = d;
  const T = DIFF_THEME[record.difficulty];
  const id = `${record.daily ? `#${dailyNumber(record.dateKey)} · ` : "자유 스도쿠 · "}${DIFFICULTY_LABEL[record.difficulty]}`;

  const card: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    width: 900,
    background: C.surface,
    borderRadius: 36,
    border: `4px solid ${C.ink}`,
    boxShadow: `14px 14px 0 ${C.ink}`,
    padding: "36px 56px 36px 56px",
    position: "relative",
  };

  if (!opponent) {
    return new ImageResponse(
      (
        <Flood color={T.primary} deep={T.strong}>
          <div style={card}>
            <Sticker text="1:1 대결" bg={C.pop} color={C.ink} style={{ top: -26, right: -18, transform: "rotate(7deg)" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "Bagel Fat One", fontSize: 40, color: C.ink }}>스도쿠</span>
              <span style={{ fontSize: 22, fontWeight: 500, color: C.inkFaint }}>{id}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: 10, color: C.inkFaint }}>상대 기록</span>
              <div style={{ display: "flex", position: "relative", alignItems: "center", justifyContent: "center" }}>
                <div style={{ position: "absolute", left: -16, right: -16, top: 88, bottom: 18, background: C.pop, borderRadius: 14, transform: "rotate(-1.5deg)" }} />
                <span style={{ fontFamily: "Bagel Fat One", fontSize: 150, lineHeight: 1.15, color: T.primary }}>{formatTime(record.timeSec)}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
              {[
                ["실수", `${record.mistakes}`],
                ["힌트", `${record.hints}`],
              ].map(([label, value]) => (
                <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: C.ground, border: `3px solid ${C.ink}`, borderRadius: 14, padding: "12px 0" }}>
                  <span style={{ fontSize: 18, fontWeight: 500, color: C.inkFaint }}>{label}</span>
                  <span style={{ fontSize: 30, fontWeight: 700, color: C.ink }}>{value}</span>
                </div>
              ))}
              <div style={{ flex: 2.2, display: "flex", alignItems: "center", justifyContent: "center", background: T.primary, border: `3px solid ${C.ink}`, borderRadius: 14 }}>
                <span style={{ fontSize: 26, fontWeight: 700, color: C.surface }}>같은 문제로 붙자 · 고스트 대결 →</span>
              </div>
            </div>
          </div>
        </Flood>
      ),
      { ...size, fonts },
    );
  }

  // 답장: VS 결과
  const outcome = judge(record.timeSec, opponent.timeSec); // 답장 기준
  const side = (label: string, sec: number, mistakes: number, hints: number, won: boolean) => (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        padding: "26px 0 22px",
        background: won ? T.primary : C.ground,
        color: won ? C.surface : C.ink,
        border: `4px solid ${C.ink}`,
        borderRadius: 22,
        position: "relative",
      }}
    >
      {won && <Sticker text="WIN" bg={C.pop} color={C.ink} style={{ top: -24, right: -14, fontSize: 24, padding: "10px 18px", transform: "rotate(7deg)" }} />}
      <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: 6, opacity: 0.8 }}>{label}</span>
      <span style={{ fontFamily: "Bagel Fat One", fontSize: 104, lineHeight: 1.05 }}>{formatTime(sec)}</span>
      <span style={{ fontSize: 22, fontWeight: 500, opacity: 0.85 }}>
        실수 {mistakes} · 힌트 {hints}
      </span>
    </div>
  );

  return new ImageResponse(
    (
      <Flood color={T.primary} deep={T.strong}>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "Bagel Fat One", fontSize: 40, color: C.ink }}>스도쿠</span>
            <span style={{ fontSize: 22, fontWeight: 500, color: C.inkFaint }}>{id} · 대결 결과</span>
          </div>
          <div style={{ display: "flex", alignItems: "stretch", gap: 18, marginTop: 26 }}>
            {side("도전장", opponent.timeSec, opponent.mistakes, opponent.hints, outcome === "lose")}
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ fontFamily: "Bagel Fat One", fontSize: 44, color: C.inkFaint, transform: "rotate(-6deg)" }}>VS</span>
            </div>
            {side("답장", record.timeSec, record.mistakes, record.hints, outcome === "win")}
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: C.ink }}>
              {outcome === "tie" ? "완전히 같은 시간 😳" : `${gapText(record.timeSec, opponent.timeSec)}로 ${outcome === "win" ? "답장" : "도전장"} 승 — 너도 붙어볼래? →`}
            </span>
          </div>
        </div>
      </Flood>
    ),
    { ...size, fonts },
  );
}
