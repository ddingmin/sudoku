// 대결 문구·판정 — 결과 카드/모달/OG/공유 텍스트 공용
import { formatTime } from "./encode";

export type DuelOutcome = "win" | "lose" | "tie";

export function judge(mineSec: number, opponentSec: number): DuelOutcome {
  if (mineSec < opponentSec) return "win";
  if (mineSec > opponentSec) return "lose";
  return "tie";
}

// 두 기록의 시간 차 ("1분 12초"). 0이면 빈 문자열
export function gapText(aSec: number, bSec: number): string {
  const d = Math.abs(aSec - bSec);
  if (d === 0) return "";
  if (d < 60) return `${d}초`;
  const m = Math.floor(d / 60);
  const s = d % 60;
  return s > 0 ? `${m}분 ${s}초` : `${m}분`;
}

// 승패 한 문장: "내 기록이 1분 12초 빨라요" / "같은 시간이에요". subject는 "내 기록이", "친구 기록이" 등
export function verdictText(aSec: number, bSec: number, aSubject: string, bSubject: string): string {
  const o = judge(aSec, bSec);
  if (o === "tie") return "같은 시간이에요";
  return `${o === "win" ? aSubject : bSubject} ${gapText(aSec, bSec)} 빨라요`;
}

export const OUTCOME_LABEL: Record<DuelOutcome, string> = { win: "이겼다!", lose: "졌다", tie: "동점" };

// 실시간 진행 비교 한 줄
export function paceLine(mine: number, rival: number, rivalFinished: boolean): string {
  if (rivalFinished) return "친구는 다 풀었어요";
  if (mine === 0 && rival === 0) return "이제 시작이에요";
  const d = mine - rival;
  if (d > 0) return `친구보다 ${d}칸 앞서요`;
  if (d < 0) return `친구보다 ${-d}칸 뒤에 있어요`;
  return "친구와 같은 칸 수예요";
}

// 결과 공유 텍스트 (1인칭)
export function resultShareText(label: string, mineSec: number | null, rivalSec: number | null, outcome: DuelOutcome, url?: string): string {
  const head = `스도쿠 실시간 대결 · ${label}`;
  let body: string;
  if (mineSec !== null && rivalSec !== null) {
    const gap = gapText(mineSec, rivalSec);
    body =
      outcome === "win"
        ? `${formatTime(mineSec)} vs ${formatTime(rivalSec)}, ${gap} 차이로 내가 이겼다`
        : outcome === "lose"
          ? `${formatTime(mineSec)} vs ${formatTime(rivalSec)}, ${gap} 차이로 졌다. 한 판 더 붙자`
          : `${formatTime(mineSec)} vs ${formatTime(rivalSec)}, 완전히 같은 시간`;
  } else {
    body = outcome === "win" ? `친구가 중간에 나가서 내가 이겼다` : `내가 중간에 나갔다. 다음엔 끝까지`;
  }
  return [head, body, ...(url ? [url] : [])].join("\n");
}
