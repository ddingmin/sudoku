// 무브 로그에서 리캡 하이라이트 계산
import { Move } from "./encode";

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

export function cellName(i: number): string {
  return `${Math.floor(i / 9) + 1}행 ${(i % 9) + 1}열`;
}
