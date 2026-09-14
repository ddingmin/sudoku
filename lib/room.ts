// 실시간 1:1 대결 — 클라이언트·서버 공용 타입, 상수, 파생값, 결과 코드
// 설계: docs/realtime-duel.md
import { BitReader, BitWriter, cap } from "./encode";
import { DIFFICULTIES, Difficulty } from "./sudoku";
import { DuelOutcome } from "./duelText";

export type RoomStatus = "waiting" | "countdown" | "playing" | "finished" | "abandoned";
export type Seat = "host" | "guest";
export type EndReason = "finished" | "forfeit" | "expired";

export interface RoomPlayer {
  cells: number[]; // 서버가 해답과 대조해 확인한 정답 칸 인덱스
  mistakes: number; // 클라 신고 (표시용)
  hints: number; // 대결 중 힌트는 비활성 — 항상 0, 카드 호환용
  joinedAt: number;
  lastSeen: number; // SSE 연결이 살아 있는 동안 서버가 주기적으로 갱신
  finishedAt?: number; // 서버 시각
  forfeit?: boolean;
}

// 클라이언트에 내려가는 스냅샷 (토큰·해답 제외)
export interface RoomView {
  id: string;
  difficulty: Difficulty;
  seed: number;
  status: RoomStatus;
  createdAt: number;
  startAt?: number; // 서버 시각. countdown 진입 시 확정
  host: RoomPlayer;
  guest?: RoomPlayer;
  winner?: Seat; // 먼저 완주한 쪽 (상대 기권 시 남은 쪽)
  endedReason?: EndReason;
  rematchId?: string; // 재대결 방
  ver: number;
  me: Seat;
  now: number; // 스냅샷 시점 서버 시각 — 시계 보정용
}

export const COUNTDOWN_MS = 4000;
export const WAITING_TTL_MS = 30 * 60_000; // 미참가 방 만료
export const ROOM_TTL_SEC = 3 * 3600;
export const STALE_MS = 30_000; // 이 이상 lastSeen이 오래되면 "끊김" 표시
export const FORFEIT_MS = 60_000; // 이 이상이면 기권 처리
export const SSE_POLL_MS = 500;
export const SSE_TOUCH_MS = 15_000;
export const SSE_MAX_MS = 280_000; // maxDuration(300s) 전에 정상 종료 → 클라 재접속
export const PROGRESS_THROTTLE_MS = 250;

export const opponentOf = (s: Seat): Seat => (s === "host" ? "guest" : "host");

export function playerOf(v: RoomView, seat: Seat): RoomPlayer | undefined {
  return seat === "host" ? v.host : v.guest;
}

// 완주 시간(초). 미완주면 null
export function playerTimeSec(v: RoomView, seat: Seat): number | null {
  const p = playerOf(v, seat);
  if (!p?.finishedAt || !v.startAt) return null;
  return Math.max(1, Math.round((p.finishedAt - v.startAt) / 1000));
}

// 내 관점의 결과. 아직 승부가 안 났으면 null
export function outcomeFor(v: RoomView, me: Seat): DuelOutcome | null {
  if (!v.winner) return null;
  if (v.endedReason === "forfeit" || playerTimeSec(v, opponentOf(me)) === null || playerTimeSec(v, me) === null) {
    return v.winner === me ? "win" : "lose";
  }
  const a = playerTimeSec(v, me)!;
  const b = playerTimeSec(v, opponentOf(me))!;
  return a === b ? "tie" : v.winner === me ? "win" : "lose";
}

// 상대 연결 상태
export function rivalPresence(v: RoomView, me: Seat, now: number): "absent" | "online" | "stale" | "finished" | "left" {
  const p = playerOf(v, opponentOf(me));
  if (!p) return "absent";
  if (p.forfeit) return "left";
  if (p.finishedAt) return "finished";
  return now - p.lastSeen > STALE_MS ? "stale" : "online";
}

// ── 방 ID / 토큰 ─────────────────────────────────────────────
// 방 ID는 읽어 부르기 쉬운 6자 (0/O, 1/I 제외)
const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function isRoomId(s: string): boolean {
  return /^[A-HJ-NP-Z2-9]{6}$/.test(s);
}
export function randomRoomId(rand: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += ID_ALPHABET[Math.floor(rand() * ID_ALPHABET.length)];
  return out;
}

// ── 결과 코드 (/result/<code>) ────────────────────────────────
// 무브 없이 두 기록만 담아 서버 없이 영구히 열린다. 접두 "r".
//   난이도 2 · 시드 32 · 승자 2 (0 host · 1 guest · 2 동점) · 기권 1
//   × 2: 완주 1 · [완주] 초 17 · 실수 7 · 힌트 7
export interface ResultSide {
  timeSec: number | null;
  mistakes: number;
  hints: number;
}
export interface ResultCode {
  difficulty: Difficulty;
  seed: number;
  host: ResultSide;
  guest: ResultSide;
  winner: Seat | "tie";
  forfeit: boolean;
}
const R_PREFIX = "r";

export function encodeResult(r: ResultCode): string {
  const w = new BitWriter();
  w.write(DIFFICULTIES.indexOf(r.difficulty), 2);
  w.write(r.seed >>> 0, 32);
  w.write(r.winner === "host" ? 0 : r.winner === "guest" ? 1 : 2, 2);
  w.write(r.forfeit ? 1 : 0, 1);
  for (const s of [r.host, r.guest]) {
    w.write(s.timeSec !== null ? 1 : 0, 1);
    if (s.timeSec !== null) w.write(cap(s.timeSec, 17), 17);
    w.write(cap(s.mistakes, 7), 7);
    w.write(cap(s.hints, 7), 7);
  }
  return R_PREFIX + w.toString();
}

export function decodeResult(code: string): ResultCode | null {
  try {
    if (!code.startsWith(R_PREFIX)) return null;
    const rd = new BitReader(code.slice(1));
    const difficulty = DIFFICULTIES[rd.read(2)];
    const seed = rd.read(32);
    const w = rd.read(2);
    const forfeit = rd.flag();
    const side = (): ResultSide => {
      const done = rd.flag();
      const timeSec = done ? rd.read(17) : null;
      return { timeSec, mistakes: rd.read(7), hints: rd.read(7) };
    };
    const host = side();
    const guest = side();
    if (!difficulty || w > 2) return null;
    return { difficulty, seed, host, guest, winner: w === 0 ? "host" : w === 1 ? "guest" : "tie", forfeit };
  } catch {
    return null;
  }
}

// 방 스냅샷 → 결과 코드
export function resultFromView(v: RoomView): ResultCode | null {
  if (!v.winner || !v.guest) return null;
  const side = (s: Seat): ResultSide => {
    const p = playerOf(v, s)!;
    return { timeSec: playerTimeSec(v, s), mistakes: p.mistakes, hints: p.hints };
  };
  const a = playerTimeSec(v, "host");
  const b = playerTimeSec(v, "guest");
  return {
    difficulty: v.difficulty,
    seed: v.seed,
    host: side("host"),
    guest: side("guest"),
    winner: a !== null && b !== null && a === b ? "tie" : v.winner,
    forfeit: v.endedReason === "forfeit",
  };
}
