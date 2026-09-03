// 게임 결과 → URL-safe 공유 코드 인코딩/디코딩
// v1: 결과 요약만 / v2: + 시드·무브 로그(풀이 리플레이용) — 둘은 디코딩만 유지(기존 링크 호환)
// v3: 비트 패킹. 무브별 시간차 대신 리캡 하이라이트 결과값만 실어 v2 대비 ~65% 짧음
import { Difficulty, DIFFICULTIES, DIFFICULTY_LABEL, dailyNumber } from "./sudoku";
import { computeHighlights, type Highlights } from "./recap";

// 풀이 무브: i=칸(0~80), k=0 정답 | 1 오답 | 2 힌트, t=경과 초(절대)
export interface Move {
  i: number;
  k: 0 | 1 | 2;
  t: number;
}

export interface ShareRecord {
  difficulty: Difficulty;
  timeSec: number;
  mistakes: number;
  hints: number;
  dateKey: string; // YYYY-MM-DD
  streak: number; // 데일리 연속 클리어 (0 = 비데일리)
  daily: boolean;
  best: boolean; // 신기록 여부
  seed?: number; // 퍼즐 시드 (리플레이용)
  moves?: Move[]; // 풀이 로그 (리플레이용). v3 디코딩 결과는 t가 0으로 채워짐 — 시간은 highlights를 볼 것
  highlights?: Highlights; // 리캡 하이라이트. v3 디코딩 시 채워짐 (무브 시간 로그가 없으므로)
}

const DIFF_CODE: Record<Difficulty, string> = {
  easy: "e",
  normal: "n",
  hard: "h",
  expert: "x",
};

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  if (typeof Buffer !== "undefined") return Buffer.from(b64, "base64").toString("utf-8");
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
}

// (v1/v2) 무브당 3문자: (k*81+i) 12비트 2문자 + 직전 무브와의 시간 차 1문자
function decodeMoves(s: string): Move[] | null {
  if (s.length % 3 !== 0) return null;
  const moves: Move[] = [];
  let t = 0;
  for (let p = 0; p < s.length; p += 3) {
    const hi = B64.indexOf(s[p]);
    const lo = B64.indexOf(s[p + 1]);
    const dt = B64.indexOf(s[p + 2]);
    if (hi < 0 || lo < 0 || dt < 0) return null;
    const v = (hi << 6) | lo;
    if (v > 242) return null;
    t += dt;
    moves.push({ i: v % 81, k: Math.floor(v / 81) as 0 | 1 | 2, t });
  }
  return moves;
}

// ── v3 비트 패킹 ─────────────────────────────────────────────
// 코드 = "3" + 비트열을 6비트씩 base64url 문자로. 레이아웃(비트):
//   난이도 2 · 데일리 1 · 신기록 1 · 무브有 1 · 시간 17 · 실수 7 · 힌트 7 · 연속 10 · 데일리번호 13
//   [자유 모드] 시드 32
//   [무브有] 고민有 1 [칸 7 · 초 12] · 스퍼트有 1 [초 12] · 무브×8 (k*81+i, 개수는 남은 비트로 추정)
const V3_PREFIX = "3";
const BITS = { time: 17, count: 7, streak: 10, day: 13, seed: 32, cell: 7, sec: 12, move: 8 } as const;
const cap = (v: number, bits: number) => Math.min(2 ** bits - 1, Math.max(0, Math.round(v)));

class BitWriter {
  private bits: number[] = [];
  write(v: number, n: number) {
    for (let b = n - 1; b >= 0; b--) this.bits.push((v / 2 ** b) & 1);
  }
  toString(): string {
    let out = "";
    for (let p = 0; p < this.bits.length; p += 6) {
      let v = 0;
      for (let b = 0; b < 6; b++) v = v * 2 + (this.bits[p + b] ?? 0);
      out += B64[v];
    }
    return out;
  }
}

class BitReader {
  private bits: number[] = [];
  private pos = 0;
  constructor(s: string) {
    for (const ch of s) {
      const v = B64.indexOf(ch);
      if (v < 0) throw new Error("bad char");
      for (let b = 5; b >= 0; b--) this.bits.push((v >> b) & 1);
    }
  }
  get remaining() {
    return this.bits.length - this.pos;
  }
  read(n: number): number {
    if (this.pos + n > this.bits.length) throw new Error("eof");
    let v = 0;
    for (let b = 0; b < n; b++) v = v * 2 + this.bits[this.pos++];
    return v;
  }
  flag(): boolean {
    return this.read(1) === 1;
  }
}

export function encodeRecord(r: ShareRecord): string {
  const hasMoves = r.seed !== undefined && r.moves !== undefined && r.moves.length > 0;
  const w = new BitWriter();
  w.write(DIFFICULTIES.indexOf(r.difficulty), 2);
  w.write(r.daily ? 1 : 0, 1);
  w.write(r.best ? 1 : 0, 1);
  w.write(hasMoves ? 1 : 0, 1);
  w.write(cap(r.timeSec, BITS.time), BITS.time);
  w.write(cap(r.mistakes, BITS.count), BITS.count);
  w.write(cap(r.hints, BITS.count), BITS.count);
  w.write(cap(r.streak, BITS.streak), BITS.streak);
  w.write(cap(dailyNumber(r.dateKey), BITS.day), BITS.day);
  if (!r.daily) w.write((r.seed ?? 0) >>> 0, BITS.seed);
  if (hasMoves) {
    const h = r.highlights ?? computeHighlights(r.moves!);
    w.write(h.longestThink ? 1 : 0, 1);
    if (h.longestThink) {
      w.write(h.longestThink.i, BITS.cell);
      w.write(cap(h.longestThink.sec, BITS.sec), BITS.sec);
    }
    w.write(h.lastSpurt ? 1 : 0, 1);
    if (h.lastSpurt) w.write(cap(h.lastSpurt.sec, BITS.sec), BITS.sec);
    for (const m of r.moves!) w.write(m.k * 81 + m.i, BITS.move);
  }
  return V3_PREFIX + w.toString();
}

// 데일리 번호(2026-01-01 = #1) → YYYY-MM-DD
function dateKeyFromDailyNumber(n: number): string {
  return new Date(Date.UTC(2026, 0, 1) + (n - 1) * 86400_000).toISOString().slice(0, 10);
}

// 데일리 시드는 날짜·난이도에서 재계산 — generateDaily와 동일한 식
function dailySeed(dateKey: string, difficulty: Difficulty): number {
  let h = 2166136261;
  const str = `sudoku:${dateKey}:${difficulty}`;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function decodeV3(code: string): ShareRecord | null {
  const rd = new BitReader(code.slice(V3_PREFIX.length));
  const difficulty = DIFFICULTIES[rd.read(2)];
  const daily = rd.flag();
  const best = rd.flag();
  const hasMoves = rd.flag();
  const timeSec = rd.read(BITS.time);
  const mistakes = rd.read(BITS.count);
  const hints = rd.read(BITS.count);
  const streak = rd.read(BITS.streak);
  const day = rd.read(BITS.day);
  if (!difficulty || timeSec > 86400 || day < 1) return null;
  const dateKey = dateKeyFromDailyNumber(day);
  const record: ShareRecord = { difficulty, timeSec, mistakes, hints, dateKey, streak, daily, best };
  const seed = daily ? dailySeed(dateKey, difficulty) : rd.read(BITS.seed);
  if (!hasMoves) return record;

  const longestThink = rd.flag() ? { i: rd.read(BITS.cell), sec: rd.read(BITS.sec) } : null;
  if (longestThink && longestThink.i > 80) return null;
  const lastSpurt = rd.flag() ? { cells: 10, sec: rd.read(BITS.sec) } : null;

  const count = Math.floor(rd.remaining / BITS.move);
  if (count < 1 || count > 400) return null;
  const moves: Move[] = [];
  for (let n = 0; n < count; n++) {
    const v = rd.read(BITS.move);
    if (v > 242) return null;
    moves.push({ i: v % 81, k: Math.floor(v / 81) as 0 | 1 | 2, t: 0 });
  }
  const errorCells = new Set(moves.filter((m) => m.k === 1).map((m) => m.i)).size;
  record.seed = seed;
  record.moves = moves;
  record.highlights = { longestThink, lastSpurt, errorCells };
  return record;
}

// v1/v2: "|" 구분 필드 전체를 base64url로 감싼 형식
function decodeLegacy(code: string): ShareRecord | null {
  const parts = fromBase64Url(code).split("|");
  const version = parts[0];
  if ((version !== "1" && version !== "2") || parts.length < 9) return null;
  const difficulty = DIFFICULTIES.find((d) => DIFF_CODE[d] === parts[1]);
  const raw = parts[5];
  if (!difficulty || !/^\d{8}$/.test(raw)) return null;
  const timeSec = Number(parts[2]);
  const mistakes = Number(parts[3]);
  const hints = Number(parts[4]);
  const streak = Number(parts[6]);
  if (![timeSec, mistakes, hints, streak].every((n) => Number.isInteger(n) && n >= 0)) return null;
  if (timeSec > 86400) return null;

  const record: ShareRecord = {
    difficulty,
    timeSec,
    mistakes,
    hints,
    dateKey: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`,
    streak,
    daily: parts[7] === "d",
    best: parts[8] === "b",
  };

  if (version === "2" && parts.length >= 11) {
    const seed = parseInt(parts[9], 36);
    const moves = decodeMoves(parts[10]);
    if (Number.isInteger(seed) && seed >= 0 && moves && moves.length > 0 && moves.length <= 400) {
      record.seed = seed;
      record.moves = moves;
    }
  }
  return record;
}

export function decodeRecord(code: string): ShareRecord | null {
  try {
    // 레거시 코드는 base64("1|"/"2|") → 항상 "M"으로 시작하므로 "3" 접두와 충돌 없음
    return code.startsWith(V3_PREFIX) ? decodeV3(code) : decodeLegacy(code);
  } catch {
    return null;
  }
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// 공유 카피 — OG 썸네일이 스탯(번호·시간·난이도·실수·힌트·신기록·연속)을 모두 보여주므로
// 텍스트는 이미지가 못 하는 것만 한다: 1인칭 자랑 한 줄 + 도전 한 줄
// 원칙: 구체적 벤치마크(시간) + 공정한 도전("같은 문제") + 가벼운 도발

// 자랑 조각: "힌트 없이 16:11 컷" 등, 기록에서 가장 내세울 포인트 하나만
export function shareFlex(r: ShareRecord): string {
  const t = formatTime(r.timeSec);
  const perfect = r.mistakes === 0 && r.hints === 0;
  if (perfect && r.best) return `실수 0 힌트 0 신기록 ${t}`;
  if (perfect) return `실수도 힌트도 0, ${t}`;
  if (r.hints === 0) return `힌트 없이 ${t} 컷`;
  if (r.best) return `신기록 ${t}`;
  return `${t} 클리어`;
}

// 도전 한 줄 (OG 설명에도 사용)
export function shareHook(r: ShareRecord): string {
  const perfect = r.mistakes === 0 && r.hints === 0;
  const same = r.daily ? "같은 문제로 " : "";
  if (perfect && r.best) return `이건 못 깰 듯? 😏`;
  if (perfect) return `${same}완벽하게 푸는 사람만 인정 😏`;
  if (r.hints === 0) return `${same}나보다 빠르면 인정 👀`;
  if (r.best) return `${same}이 기록 넘어볼래? 🏆`;
  return r.daily ? `같은 문제, 이 안에 풀면 인정 👀` : `너는 몇 분? 👀`;
}

// 공유 텍스트: 자랑 헤드라인 → 도전 → 링크 (스탯은 썸네일에 맡긴다)
export function shareText(r: ShareRecord, url?: string): string {
  const id = r.daily ? `#${dailyNumber(r.dateKey)} ` : "";
  const title = `🧩 스도쿠 ${id}${DIFFICULTY_LABEL[r.difficulty]} · ${shareFlex(r)}`;
  return [title, shareHook(r), ...(url ? [`👉 ${url}`] : [])].join("\n");
}
