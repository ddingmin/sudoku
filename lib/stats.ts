// localStorage 기록 관리: 베스트, 스트릭, 히스토리
import { Difficulty, todayKey } from "./sudoku";
import { ShareRecord } from "./encode";

const KEY = "sudoku:stats:v1";

export interface GameResult {
  difficulty: Difficulty;
  timeSec: number;
  mistakes: number;
  hints: number;
  dateKey: string;
  daily: boolean;
  finishedAt: number; // epoch ms
}

export interface Stats {
  bests: Partial<Record<Difficulty, number>>; // 난이도별 최단 시간(초)
  played: number;
  cleared: number;
  streak: number; // 데일리 연속 클리어
  maxStreak: number;
  lastDailyKey: string | null; // 마지막으로 데일리 클리어한 날짜
  history: GameResult[]; // 최근 20개
}

const EMPTY: Stats = {
  bests: {},
  played: 0,
  cleared: 0,
  streak: 0,
  maxStreak: 0,
  lastDailyKey: null,
  history: [],
};

export function loadStats(): Stats {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return EMPTY;
  }
}

function save(stats: Stats) {
  try {
    localStorage.setItem(KEY, JSON.stringify(stats));
  } catch {
    // 저장 불가 환경(사생활 보호 모드 등)은 조용히 무시
  }
}

export function recordStart(): Stats {
  const s = loadStats();
  s.played++;
  save(s);
  return s;
}

function prevDayKey(key: string): string {
  const d = new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// 클리어 기록 저장. 신기록 여부와 함께 공유용 레코드를 돌려준다.
export function recordClear(result: GameResult): { stats: Stats; record: ShareRecord } {
  const s = loadStats();
  s.cleared++;

  const prevBest = s.bests[result.difficulty];
  const best = prevBest === undefined || result.timeSec < prevBest;
  if (best) s.bests[result.difficulty] = result.timeSec;

  if (result.daily && s.lastDailyKey !== result.dateKey) {
    s.streak = s.lastDailyKey === prevDayKey(result.dateKey) ? s.streak + 1 : 1;
    s.maxStreak = Math.max(s.maxStreak, s.streak);
    s.lastDailyKey = result.dateKey;
  }

  s.history = [result, ...s.history].slice(0, 20);
  save(s);

  return {
    stats: s,
    record: {
      difficulty: result.difficulty,
      timeSec: result.timeSec,
      mistakes: result.mistakes,
      hints: result.hints,
      dateKey: result.dateKey,
      streak: result.daily ? s.streak : 0,
      daily: result.daily,
      best,
    },
  };
}

// 오늘 기준 유효 스트릭 (어제까지 클리어했으면 유지 중)
export function currentStreak(s: Stats): number {
  if (!s.lastDailyKey) return 0;
  const today = todayKey();
  if (s.lastDailyKey === today || s.lastDailyKey === prevDayKey(today)) return s.streak;
  return 0;
}
