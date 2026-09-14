// localStorage 기록 관리: 베스트, 날짜별 데일리 클리어(잔디), 히스토리
// 스트릭은 저장하지 않고 days에서 계산한다 — 백업 복원·병합 시 어긋나지 않도록.
import { Difficulty, DIFFICULTIES, dailyNumber, todayKey } from "./sudoku";
import { Move, ShareRecord } from "./encode";

const KEY = "sudoku:stats:v2";
const LEGACY_KEY = "sudoku:stats:v1";

export interface GameResult {
  difficulty: Difficulty;
  timeSec: number;
  mistakes: number;
  hints: number;
  dateKey: string;
  daily: boolean;
  finishedAt: number; // epoch ms
  seed?: number; // 리플레이용
  moves?: Move[]; // 리플레이용
  duel?: "win" | "lose" | "tie"; // 실시간 대결 판이면 결과
}

// 하루의 데일리 클리어: 난이도 → 최단 시간(초). 0 = 시간 미상(복원 데이터)
export type DayClears = Partial<Record<Difficulty, number>>;

export interface Stats {
  bests: Partial<Record<Difficulty, number>>; // 난이도별 최단 시간(초), 데일리·자유 통합
  played: number;
  cleared: number;
  days: Record<string, DayClears>; // YYYY-MM-DD → 그날 데일리 클리어 (잔디·스트릭의 원본)
  history: GameResult[]; // 최근 20개 (리플레이 포함)
}

const EMPTY: Stats = { bests: {}, played: 0, cleared: 0, days: {}, history: [] };

interface LegacyStats {
  bests?: Partial<Record<Difficulty, number>>;
  played?: number;
  cleared?: number;
  history?: GameResult[];
}

// v1(스트릭 필드 저장) → v2: 날짜별 클리어는 히스토리에서 복원
function migrateLegacy(raw: string): Stats {
  const old = JSON.parse(raw) as LegacyStats;
  const s: Stats = { ...EMPTY, bests: old.bests ?? {}, played: old.played ?? 0, cleared: old.cleared ?? 0, history: old.history ?? [], days: {} };
  for (const h of s.history) if (h.daily) addDayClear(s.days, h.dateKey, h.difficulty, h.timeSec);
  return s;
}

export function loadStats(): Stats {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const migrated = migrateLegacy(legacy);
      save(migrated);
      return migrated;
    }
    return EMPTY;
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

// 하루 기록에 난이도 클리어 추가. 더 빠른 시간만 덮어쓴다 (0 = 미상은 항상 밀림)
function addDayClear(days: Record<string, DayClears>, dateKey: string, difficulty: Difficulty, timeSec: number) {
  const day = (days[dateKey] ??= {});
  const prev = day[difficulty];
  if (prev === undefined || prev === 0 || (timeSec > 0 && timeSec < prev)) day[difficulty] = timeSec;
}

export function recordStart(): Stats {
  const s = loadStats();
  s.played++;
  save(s);
  return s;
}

// 클리어 기록 저장. 신기록 여부와 함께 공유용 레코드를 돌려준다.
export function recordClear(result: GameResult): { stats: Stats; record: ShareRecord } {
  const s = loadStats();
  s.cleared++;

  const prevBest = s.bests[result.difficulty];
  const best = prevBest === undefined || result.timeSec < prevBest;
  if (best) s.bests[result.difficulty] = result.timeSec;

  if (result.daily) addDayClear(s.days, result.dateKey, result.difficulty, result.timeSec);

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
      streak: result.daily ? currentStreak(s) : 0,
      daily: result.daily,
      best,
      seed: result.seed,
      moves: result.moves,
    },
  };
}

// ── 파생값 ──────────────────────────────────────────────

export interface StreakInfo {
  current: number; // 오늘 기준 유효 스트릭 (어제까지 클리어했으면 유지 중)
  max: number; // 역대 최장
}

export function streakInfo(days: Record<string, DayClears>, today = todayKey()): StreakInfo {
  const nums = Object.keys(days).map(dailyNumber).sort((a, b) => a - b);
  if (nums.length === 0) return { current: 0, max: 0 };

  let max = 1;
  let run = 1;
  for (let i = 1; i < nums.length; i++) {
    run = nums[i] === nums[i - 1] + 1 ? run + 1 : 1;
    if (run > max) max = run;
  }

  const set = new Set(nums);
  const t = dailyNumber(today);
  let n = set.has(t) ? t : set.has(t - 1) ? t - 1 : null;
  let current = 0;
  while (n !== null && set.has(n)) {
    current++;
    n--;
  }
  return { current, max };
}

export function currentStreak(s: Stats): number {
  return streakInfo(s.days).current;
}

export function clearedDayCount(s: Stats): number {
  return Object.keys(s.days).length;
}

// ── 백업 병합 ─────────────────────────────────────────────

// 다른 기기의 기록을 이 기기에 합친다: 날짜별 클리어는 합집합(빠른 시간 우선), 베스트는 최소, 횟수는 최대.
// 횟수를 더하지 않는 이유: 같은 기록을 두 번 불러와도 부풀지 않게.
export function mergeStats(incoming: Pick<Stats, "bests" | "played" | "cleared" | "days">): Stats {
  const s = loadStats();
  for (const d of DIFFICULTIES) {
    const b = incoming.bests[d];
    if (b !== undefined && b > 0 && (s.bests[d] === undefined || b < s.bests[d]!)) s.bests[d] = b;
  }
  s.played = Math.max(s.played, incoming.played);
  s.cleared = Math.max(s.cleared, incoming.cleared);
  for (const [dateKey, day] of Object.entries(incoming.days)) {
    for (const d of DIFFICULTIES) {
      const t = day[d];
      if (t !== undefined) addDayClear(s.days, dateKey, d, t);
    }
  }
  save(s);
  return s;
}
