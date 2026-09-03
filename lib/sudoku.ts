// 스도쿠 엔진: 시드 기반 생성(데일리 지원), 유일해 보장, 난이도별 힌트 수

export type Grid = number[]; // length 81, 0 = empty

export type Difficulty = "easy" | "normal" | "hard" | "expert";

export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard", "expert"];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "쉬움",
  normal: "보통",
  hard: "어려움",
  expert: "전문가",
};

const CLUES: Record<Difficulty, number> = {
  easy: 40,
  normal: 34,
  hard: 28,
  expert: 24,
};

// mulberry32 — 시드 재현 가능한 PRNG
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

function candidatesOk(grid: Grid, idx: number, val: number): boolean {
  const r = rowOf(idx);
  const c = colOf(idx);
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let k = 0; k < 9; k++) {
    if (grid[r * 9 + k] === val) return false;
    if (grid[k * 9 + c] === val) return false;
    if (grid[(br + Math.floor(k / 3)) * 9 + bc + (k % 3)] === val) return false;
  }
  return true;
}

function fillGrid(grid: Grid, rng: () => number): boolean {
  const idx = grid.indexOf(0);
  if (idx === -1) return true;
  for (const val of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)) {
    if (candidatesOk(grid, idx, val)) {
      grid[idx] = val;
      if (fillGrid(grid, rng)) return true;
      grid[idx] = 0;
    }
  }
  return false;
}

// 해의 개수를 limit까지 센다 (유일해 검증용)
export function countSolutions(grid: Grid, limit = 2): number {
  // 가장 후보가 적은 빈 칸을 골라 분기 폭을 줄인다
  let best = -1;
  let bestCands: number[] | null = null;
  for (let i = 0; i < 81; i++) {
    if (grid[i] !== 0) continue;
    const cands: number[] = [];
    for (let v = 1; v <= 9; v++) if (candidatesOk(grid, i, v)) cands.push(v);
    if (cands.length === 0) return 0;
    if (bestCands === null || cands.length < bestCands.length) {
      best = i;
      bestCands = cands;
      if (cands.length === 1) break;
    }
  }
  if (best === -1) return 1; // 빈 칸 없음 = 해 1개
  let count = 0;
  for (const v of bestCands!) {
    grid[best] = v;
    count += countSolutions(grid, limit - count);
    grid[best] = 0;
    if (count >= limit) break;
  }
  return count;
}

export interface Puzzle {
  puzzle: Grid;
  solution: Grid;
  difficulty: Difficulty;
  seed: number;
}

export function generatePuzzle(difficulty: Difficulty, seed: number): Puzzle {
  const rng = createRng(seed);
  const solution: Grid = new Array(81).fill(0);
  fillGrid(solution, rng);

  const puzzle = [...solution];
  const targetClues = CLUES[difficulty];
  const order = shuffled(
    Array.from({ length: 81 }, (_, i) => i),
    rng,
  );

  let clues = 81;
  for (const idx of order) {
    if (clues <= targetClues) break;
    const backup = puzzle[idx];
    puzzle[idx] = 0;
    const copy = [...puzzle];
    if (countSolutions(copy, 2) !== 1) {
      puzzle[idx] = backup; // 유일해가 깨지면 되돌림
    } else {
      clues--;
    }
  }

  return { puzzle, solution, difficulty, seed };
}

// KST(UTC+9) 기준 오늘 날짜 문자열 — 데일리 퍼즐 키
export function todayKey(date = new Date()): string {
  const kst = new Date(date.getTime() + 9 * 3600_000);
  return kst.toISOString().slice(0, 10);
}

// 데일리 퍼즐 번호 (2026-01-01 = #1)
export function dailyNumber(key: string): number {
  const epoch = Date.UTC(2026, 0, 1);
  const d = Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10));
  return Math.floor((d - epoch) / 86400_000) + 1;
}

// 데일리 번호 → YYYY-MM-DD (dailyNumber의 역함수)
export function dailyKeyFromNumber(n: number): string {
  return new Date(Date.UTC(2026, 0, 1) + (n - 1) * 86400_000).toISOString().slice(0, 10);
}

export function generateDaily(difficulty: Difficulty, key = todayKey()): Puzzle {
  return generatePuzzle(difficulty, hashSeed(`sudoku:${key}:${difficulty}`));
}
