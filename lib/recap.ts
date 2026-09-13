// 무브 로그에서 리캡 하이라이트 계산
import type { Move, ShareRecord } from "./encode";

export interface Highlights {
  longestThink: { i: number; sec: number } | null; // 가장 오래 고민한 칸
  lastSpurt: { cells: number; sec: number } | null; // 마지막 N칸 스퍼트
  errorCells: number; // 오답이 났던 칸 수(중복 제외)
}

export function computeHighlights(moves: Move[]): Highlights {
  let longestThink: Highlights["longestThink"] = null;
  let prev = 0;
  for (const m of moves) {
    const dt = m.t - prev;
    prev = m.t;
    if (m.k === 0 && dt >= 3 && (!longestThink || dt > longestThink.sec)) {
      longestThink = { i: m.i, sec: dt };
    }
  }

  const ok = moves.filter((m) => m.k === 0);
  let lastSpurt: Highlights["lastSpurt"] = null;
  if (ok.length >= 10) {
    const n = 10;
    const span = ok[ok.length - 1].t - ok[ok.length - 1 - n].t;
    lastSpurt = { cells: n, sec: Math.max(1, span) };
  }

  const errorCells = new Set(moves.filter((m) => m.k === 1).map((m) => m.i)).size;

  return { longestThink, lastSpurt, errorCells };
}

function fmtSec(sec: number): string {
  if (sec < 60) return `${sec}초`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `${m}분 ${s}초` : `${m}분`;
}

// 기록의 하이라이트: 공유 코드에서 디코딩된 값이 있으면 그것을, 없으면 무브 로그(시간 포함)에서 계산
export function recordHighlights(r: ShareRecord): Highlights | null {
  if (r.highlights) return r.highlights;
  if (r.moves && r.moves.length > 0) return computeHighlights(r.moves);
  return null;
}

// 리캡 하이라이트를 짧은 구로 (승리 모달·공유 랜딩 공용). 서술형 대신 기록 읽어주듯 명사형
export function highlightLines(h: Highlights, mistakes: number, hints: number): string[] {
  const lines: string[] = [];
  if (h.longestThink && h.longestThink.sec >= 5) {
    lines.push(`한 칸에서 ${fmtSec(h.longestThink.sec)} 고민`);
  }
  if (h.lastSpurt && h.lastSpurt.sec >= 10) {
    lines.push(`마지막 ${h.lastSpurt.cells}칸은 ${fmtSec(h.lastSpurt.sec)}에 마무리`);
  }
  lines.push(mistakes > 0 ? `실수 ${mistakes}번, 모두 바로잡음` : "실수 없이 클리어");
  if (hints > 0) lines.push(`힌트 ${hints}번`);
  return lines.slice(0, 4);
}
