// 대결 결과 미리보기 — VS 카드
import { ImageResponse } from "next/og";
import { formatTime } from "@/lib/encode";
import { decodeResult } from "@/lib/room";
import { verdictText } from "@/lib/duelText";
import { DIFFICULTY_LABEL } from "@/lib/sudoku";
import { DIFF_THEME } from "@/lib/palette";
import { OG as C, OG_SIZE, Fallback, Flood, Sticker, ogFonts } from "@/lib/og";

export const alt = "스도쿠 실시간 대결 결과";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const r = decodeResult(code);
  const fonts = await ogFonts();
  if (!r) return new ImageResponse(<Fallback color={DIFF_THEME.normal.primary} />, { ...size, fonts });
  const T = DIFF_THEME[r.difficulty];
  const tie = r.host.timeSec !== null && r.host.timeSec !== null && r.host.timeSec === r.guest.timeSec;

  const side = (label: string, sec: number | null, mistakes: number, won: boolean) => (
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
      <span style={{ fontFamily: "Bagel Fat One", fontSize: 104, lineHeight: 1.05 }}>{sec !== null ? formatTime(sec) : "—"}</span>
      <span style={{ fontSize: 22, fontWeight: 500, opacity: 0.85 }}>실수 {mistakes}</span>
    </div>
  );

  const line =
    r.host.timeSec !== null && r.guest.timeSec !== null
      ? verdictText(r.host.timeSec, r.guest.timeSec, "방장 기록이", "도전자 기록이")
      : r.forfeit
        ? `${r.winner === "host" ? "도전자" : "방장"}가 중간에 나갔어요`
        : `${r.winner === "host" ? "방장" : "도전자"}이 먼저 다 풀었어요`;

  return new ImageResponse(
    (
      <Flood color={T.primary} deep={T.strong}>
        <div style={{ display: "flex", flexDirection: "column", width: 900, background: C.surface, borderRadius: 36, border: `4px solid ${C.ink}`, boxShadow: `14px 14px 0 ${C.ink}`, padding: "36px 56px", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: "Bagel Fat One", fontSize: 40, color: C.ink }}>스도쿠</span>
            <span style={{ fontSize: 22, fontWeight: 500, color: C.inkFaint }}>실시간 대결 · {DIFFICULTY_LABEL[r.difficulty]}</span>
          </div>
          <div style={{ display: "flex", alignItems: "stretch", gap: 18, marginTop: 26 }}>
            {side("방장", r.host.timeSec, r.host.mistakes, !tie && r.winner === "host")}
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ fontFamily: "Bagel Fat One", fontSize: 44, color: C.inkFaint, transform: "rotate(-6deg)" }}>VS</span>
            </div>
            {side("도전자", r.guest.timeSec, r.guest.mistakes, !tie && r.winner === "guest")}
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: C.ink }}>{line} · 나도 붙어볼래? →</span>
          </div>
        </div>
      </Flood>
    ),
    { ...size, fonts },
  );
}
