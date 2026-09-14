// 대결 초대 링크 미리보기
import { ImageResponse } from "next/og";
import { readRoom } from "@/lib/roomServer";
import { DIFFICULTY_LABEL } from "@/lib/sudoku";
import { DIFF_THEME } from "@/lib/palette";
import { OG as C, OG_SIZE, Flood, Sticker, ogFonts } from "@/lib/og";

export const alt = "스도쿠 실시간 대결";
export const size = OG_SIZE;
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rec = await readRoom(id.toUpperCase(), Date.now());
  const fonts = await ogFonts();
  const difficulty = rec?.difficulty ?? "normal";
  const T = DIFF_THEME[difficulty];
  const waiting = rec?.status === "waiting";
  return new ImageResponse(
    (
      <Flood color={T.primary} deep={T.strong}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: 900,
            background: C.surface,
            borderRadius: 36,
            border: `4px solid ${C.ink}`,
            boxShadow: `14px 14px 0 ${C.ink}`,
            padding: "44px 56px 40px",
            position: "relative",
          }}
        >
          <Sticker text="실시간 대결" bg={C.pop} color={C.ink} style={{ top: -26, right: -18, transform: "rotate(7deg)" }} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <span style={{ fontFamily: "Bagel Fat One", fontSize: 40, color: C.ink }}>스도쿠</span>
            {rec && <span style={{ fontSize: 22, fontWeight: 500, color: C.inkFaint }}>방 {rec.id}</span>}
          </div>
          <span style={{ fontFamily: "Bagel Fat One", fontSize: 88, lineHeight: 1.15, color: C.ink, marginTop: 18, textAlign: "center" }}>
            {waiting ? "같은 문제로 지금 붙어볼래?" : rec ? "이미 시작된 대결" : "끝난 대결"}
          </span>
          <div style={{ display: "flex", gap: 14, marginTop: 26, width: "100%" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: C.ground, border: `3px solid ${C.ink}`, borderRadius: 14, padding: "12px 0" }}>
              <span style={{ fontSize: 18, fontWeight: 500, color: C.inkFaint }}>난이도</span>
              <span style={{ fontSize: 30, fontWeight: 700, color: C.ink }}>{DIFFICULTY_LABEL[difficulty]}</span>
            </div>
            <div style={{ flex: 2.4, display: "flex", alignItems: "center", justifyContent: "center", background: T.primary, border: `3px solid ${C.ink}`, borderRadius: 14 }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: C.surface }}>{waiting ? "친구가 기다리고 있어요 · 참가하기 →" : "친구에게 새 링크를 받아 주세요"}</span>
            </div>
          </div>
        </div>
      </Flood>
    ),
    { ...size, fonts },
  );
}
