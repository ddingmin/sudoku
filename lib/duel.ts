// 1:1 고스트 대결 — 대결 코드 인코딩/디코딩, 시간 복원, 고스트 진행, 승패, 공유 문구
// 설계: docs/duel.md
//
// 코드 = "4" + 비트열(base64url). 레이아웃:
//   종류 1 (0 도전장 · 1 답장)
//   [답장] 상대 요약: 시간 17 · 실수 7 · 힌트 7
//   체크포인트有 1 · [개수 6 · 개수 × 누적 초 13]   ← 10무브마다 그 시점 경과 초
//   기록 본문 (encode.ts writeRecordBits — 무브가 마지막)
import {
  BitReader,
  BitWriter,
  Move,
  ShareRecord,
  cap,
  formatTime,
  readRecordBits,
  writeRecordBits,
} from "./encode";
import { DIFFICULTY_LABEL, dailyNumber } from "./sudoku";

// 상대(원 도전자) 요약 — 답장 코드에 실려 승패 카드를 그린다
export interface DuelSummary {
  timeSec: number;
  mistakes: number;
  hints: number;
}

export interface DuelCode {
  record: ShareRecord; // 이 코드를 만든 사람의 기록 (무브의 t는 체크포인트에서 복원됨)
  opponent?: DuelSummary; // 있으면 답장: record는 응답자, opponent는 원 도전자
}

const PREFIX = "4";
const BITS = { time: 17, count: 7, cpCount: 6, cpSec: 13 } as const;
export const CP_STEP = 10; // 체크포인트 간격(무브)

// 무브 로그에서 체크포인트 추출: 인덱스 9, 19, 29 … 의 경과 초
export function checkpoints(moves: Move[]): number[] {
  const out: number[] = [];
  for (let n = CP_STEP - 1; n < moves.length; n += CP_STEP) out.push(moves[n].t);
  return out.slice(0, 2 ** BITS.cpCount - 1);
}

// 체크포인트 + 총 시간으로 무브별 t를 복원. 앵커 사이는 균등 분포로 보되,
// 기록에 실린 "가장 오래 고민한 칸"(longestThink)이 속한 구간은 그 무브에 고민 시간을 몰아준다 —
// 고스트가 실제로 멈췄던 자리에서 멈추도록 (추가 비트 없이 v3 하이라이트를 재활용)
export function restoreTimes(
  moves: Move[],
  cps: number[],
  totalSec: number,
  longestThink?: { i: number; sec: number } | null,
): Move[] {
  const anchors: Array<[number, number]> = [[-1, 0]];
  cps.forEach((t, j) => {
    const idx = (j + 1) * CP_STEP - 1;
    if (idx < moves.length - 1) anchors.push([idx, Math.max(t, anchors[anchors.length - 1][1])]);
  });
  anchors.push([moves.length - 1, Math.max(totalSec, anchors[anchors.length - 1][1])]);

  const thinkIdx = longestThink ? moves.findIndex((m) => m.k === 0 && m.i === longestThink.i) : -1;
  const out: Move[] = [];
  for (let a = 0; a + 1 < anchors.length; a++) {
    const [i0, t0] = anchors[a];
    const [i1, t1] = anchors[a + 1];
    const n = i1 - i0; // 구간 무브 수
    const span = t1 - t0;
    // 고민 무브가 이 구간에 있고 고민 시간이 구간 안에 들어가면: 그 무브에 sec, 나머지에 균등
    const think = thinkIdx > i0 && thinkIdx <= i1 && longestThink && longestThink.sec <= span ? longestThink.sec : 0;
    const per = (span - think) / (think ? Math.max(1, n - 1) : n);
    let t = t0;
    for (let idx = i0 + 1; idx <= i1; idx++) {
      t += idx === thinkIdx && think ? think : per;
      out.push({ ...moves[idx], t: idx === i1 ? t1 : Math.round(t) });
    }
  }
  return out;
}

export function encodeDuel(d: DuelCode): string {
  const w = new BitWriter();
  w.write(d.opponent ? 1 : 0, 1);
  if (d.opponent) {
    w.write(cap(d.opponent.timeSec, BITS.time), BITS.time);
    w.write(cap(d.opponent.mistakes, BITS.count), BITS.count);
    w.write(cap(d.opponent.hints, BITS.count), BITS.count);
  }
  const cps = d.record.moves && d.record.seed !== undefined ? checkpoints(d.record.moves) : [];
  w.write(cps.length > 0 ? 1 : 0, 1);
  if (cps.length > 0) {
    w.write(cps.length, BITS.cpCount);
    for (const t of cps) w.write(cap(t, BITS.cpSec), BITS.cpSec);
  }
  writeRecordBits(w, d.record);
  return PREFIX + w.toString();
}

export function decodeDuel(code: string): DuelCode | null {
  try {
    if (!code.startsWith(PREFIX)) return null;
    const rd = new BitReader(code.slice(PREFIX.length));
    const isReply = rd.flag();
    const opponent = isReply
      ? { timeSec: rd.read(BITS.time), mistakes: rd.read(BITS.count), hints: rd.read(BITS.count) }
      : undefined;
    const cps: number[] = [];
    if (rd.flag()) {
      const n = rd.read(BITS.cpCount);
      for (let j = 0; j < n; j++) cps.push(rd.read(BITS.cpSec));
    }
    const record = readRecordBits(rd);
    if (!record) return null;
    if (record.moves && record.moves.length > 0) {
      record.moves = restoreTimes(record.moves, cps, record.timeSec, record.highlights?.longestThink);
    }
    return opponent ? { record, opponent } : { record };
  } catch {
    return null;
  }
}

// 도전장으로 쓸 수 있는가: 퍼즐을 재생성할 시드와 고스트로 재생할 무브가 있어야 한다
export function isChallengeable(r: ShareRecord): boolean {
  return r.seed !== undefined && !!r.moves && r.moves.length > 0;
}

// ── 고스트 진행 ─────────────────────────────────────────────

// 경과 초 시점의 고스트 칸 상태: 0 없음 · 1 정답 채움 · 2 오답(정정 전)
export function ghostCells(moves: Move[], elapsed: number): number[] {
  const state = new Array<number>(81).fill(0);
  for (const m of moves) {
    if (m.t > elapsed) break;
    state[m.i] = m.k === 1 ? 2 : 1;
  }
  return state;
}

export function countFilled(cells: number[]): number {
  let n = 0;
  for (const s of cells) if (s === 1) n++;
  return n;
}

// 진행 비교 한 줄
export function paceLine(mine: number, ghost: number, elapsed: number, opponentSec: number): string {
  if (elapsed > opponentSec) return "친구는 이미 다 풀었어요";
  if (mine === 0 && ghost === 0) return "이제 시작이에요";
  const d = mine - ghost;
  if (d > 0) return `친구보다 ${d}칸 앞서요`;
  if (d < 0) return `친구보다 ${-d}칸 뒤에 있어요`;
  return "친구와 같은 칸 수예요";
}

// ── 승패 ────────────────────────────────────────────────────

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

// 승패 한 문장: "내 기록이 1분 12초 빨라요" / "같은 시간이에요". subject는 "내 기록이", "친구 기록이", "답장 기록이" 등
export function verdictText(aSec: number, bSec: number, aSubject: string, bSubject: string): string {
  const o = judge(aSec, bSec);
  if (o === "tie") return "같은 시간이에요";
  return `${o === "win" ? aSubject : bSubject} ${gapText(aSec, bSec)} 빨라요`;
}

export const OUTCOME_LABEL: Record<DuelOutcome, string> = { win: "이겼다!", lose: "졌다", tie: "동점" };

// ── 공유 문구 ───────────────────────────────────────────────

function idOf(r: ShareRecord): string {
  return `${r.daily ? `#${dailyNumber(r.dateKey)} ` : ""}${DIFFICULTY_LABEL[r.difficulty]}`;
}

// 도전장 텍스트 — 스탯은 OG가 보여주니 도발 한 줄 + 링크
export function challengeText(r: ShareRecord, url?: string): string {
  const lines = [`스도쿠 ${idOf(r)} · 1:1 대결`, `내 기록 ${formatTime(r.timeSec)}, 같은 문제로 붙어볼래?`];
  if (url) lines.push(`👉 ${url}`);
  return lines.join("\n");
}

// 답장 텍스트 — 응답자 1인칭
export function replyText(d: Required<DuelCode>, url?: string): string {
  const o = judge(d.record.timeSec, d.opponent.timeSec);
  const gap = gapText(d.record.timeSec, d.opponent.timeSec);
  const verdict = o === "win" ? `${gap} 차이로 내가 이겼다` : o === "lose" ? `${gap} 차이로 졌다. 한 판 더 붙자` : "완전히 같은 시간. 한 판 더 붙자";
  const lines = [`스도쿠 ${idOf(d.record)} · 대결 결과`, `${formatTime(d.record.timeSec)} vs ${formatTime(d.opponent.timeSec)}, ${verdict}`];
  if (url) lines.push(`👉 ${url}`);
  return lines.join("\n");
}
