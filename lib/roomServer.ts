// 실시간 대결 서버 로직 — 라우트 핸들러가 호출. 시각(now)은 인자로 받아 테스트 가능하게.
// 모든 판정(시작·완주 시각, 정답)은 여기서만 한다.
import { randomBytes } from "node:crypto";
import { Difficulty, DIFFICULTIES, generatePuzzle } from "./sudoku";
import {
  COUNTDOWN_MS,
  FORFEIT_MS,
  ROOM_TTL_SEC,
  RoomPlayer,
  RoomView,
  Seat,
  WAITING_TTL_MS,
  isRoomId,
  opponentOf,
  randomRoomId,
} from "./room";
import { RoomRecord, getStore } from "./store";

export class RoomError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const token = () => randomBytes(18).toString("base64url");

// 라우트 핸들러 공용 에러 응답
export function errorResponse(e: unknown): Response {
  if (e instanceof RoomError) return Response.json({ error: e.message }, { status: e.status });
  console.error(e);
  return Response.json({ error: "문제가 생겼어요" }, { status: 500 });
}

function newPlayer(now: number): RoomPlayer {
  return { cells: [], mistakes: 0, hints: 0, joinedAt: now, lastSeen: now };
}

export function seatOf(rec: RoomRecord, tok: string | null | undefined): Seat | null {
  if (!tok) return null;
  if (rec.tokens.host === tok) return "host";
  if (rec.tokens.guest && rec.tokens.guest === tok) return "guest";
  return null;
}

export function toView(rec: RoomRecord, me: Seat, now: number): RoomView {
  const { tokens: _t, puzzle: _p, solution: _s, ...rest } = rec;
  void _t;
  void _p;
  void _s;
  return { ...rest, me, now };
}

// 시간 경과에 따른 상태 전이. 바뀐 게 있으면 true (호출자가 저장)
export function reconcile(rec: RoomRecord, now: number): boolean {
  let changed = false;
  if (rec.status === "waiting" && now - rec.createdAt > WAITING_TTL_MS) {
    rec.status = "abandoned";
    rec.endedReason = "expired";
    changed = true;
  }
  if (rec.status === "countdown" && rec.startAt !== undefined && now >= rec.startAt) {
    rec.status = "playing";
    changed = true;
  }
  if (rec.status === "playing" && rec.guest) {
    // 한쪽만 오래 조용하면(상대는 살아 있음) 기권. 둘 다 조용하면 아무도 기권시키지 않고, 아주 오래되면 방 폐기
    const stale = (p: RoomPlayer) => !p.finishedAt && !p.forfeit && now - p.lastSeen > FORFEIT_MS;
    const alive = (p: RoomPlayer) => p.finishedAt !== undefined || now - p.lastSeen <= FORFEIT_MS;
    const hostStale = stale(rec.host);
    const guestStale = stale(rec.guest);
    if (hostStale && guestStale) {
      if (now - Math.max(rec.host.lastSeen, rec.guest.lastSeen) > FORFEIT_MS * 3) {
        rec.status = "abandoned";
        rec.endedReason = "expired";
        changed = true;
      }
    } else {
      for (const seat of ["host", "guest"] as Seat[]) {
        const p = seat === "host" ? rec.host : rec.guest;
        const other = seat === "host" ? rec.guest : rec.host;
        if (stale(p) && alive(other)) {
          p.forfeit = true;
          rec.winner = rec.winner ?? opponentOf(seat);
          rec.status = "finished";
          rec.endedReason = "forfeit";
          changed = true;
          break;
        }
      }
    }
  }
  return changed;
}

// CAS 루프로 방을 갱신. fn이 던지는 RoomError는 그대로 전달
async function updateRoom(id: string, now: number, fn: (rec: RoomRecord) => void): Promise<RoomRecord> {
  const store = getStore();
  for (let attempt = 0; attempt < 6; attempt++) {
    const rec = await store.get(id);
    if (!rec) throw new RoomError(404, "방이 없어요");
    const expected = rec.ver;
    reconcile(rec, now);
    fn(rec);
    rec.ver = expected + 1;
    if (await store.cas(id, expected, rec, ROOM_TTL_SEC)) return rec;
  }
  throw new RoomError(409, "잠시 후 다시 시도해 주세요");
}

// 읽기 + 필요 시 시간 전이 저장 (SSE 루프·랜딩용)
export async function readRoom(id: string, now: number): Promise<RoomRecord | null> {
  if (!isRoomId(id)) return null;
  const store = getStore();
  const rec = await store.get(id);
  if (!rec) return null;
  if (reconcile(rec, now)) {
    const expected = rec.ver;
    rec.ver = expected + 1;
    if (!(await store.cas(id, expected, rec, ROOM_TTL_SEC))) return (await store.get(id)) ?? rec;
  }
  return rec;
}

export async function createRoom(difficulty: Difficulty, now: number): Promise<{ rec: RoomRecord; token: string }> {
  if (!DIFFICULTIES.includes(difficulty)) throw new RoomError(400, "난이도가 올바르지 않아요");
  const store = getStore();
  const seed = Math.floor(Math.random() * 2 ** 31);
  const p = generatePuzzle(difficulty, seed);
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = randomRoomId();
    const hostToken = token();
    const rec: RoomRecord = {
      id,
      difficulty,
      seed,
      status: "waiting",
      createdAt: now,
      host: newPlayer(now),
      ver: 1,
      tokens: { host: hostToken },
      puzzle: p.puzzle,
      solution: p.solution,
    };
    if (await store.create(rec, Math.ceil(WAITING_TTL_MS / 1000) + 60)) return { rec, token: hostToken };
  }
  throw new RoomError(500, "방을 만들지 못했어요");
}

export async function joinRoom(id: string, now: number): Promise<{ rec: RoomRecord; token: string }> {
  if (!isRoomId(id)) throw new RoomError(404, "방이 없어요");
  const guestToken = token();
  const rec = await updateRoom(id, now, (r) => {
    if (r.status === "abandoned") throw new RoomError(410, "만료된 대결이에요");
    if (r.guest || r.status !== "waiting") throw new RoomError(409, "이미 시작된 대결이에요");
    r.guest = newPlayer(now);
    r.tokens.guest = guestToken;
    r.status = "countdown";
    r.startAt = now + COUNTDOWN_MS;
  });
  return { rec, token: guestToken };
}

// 진행 보고: 81칸 값을 받아 서버가 정답 칸을 계산. 전부 맞으면 완주 처리
export async function reportProgress(
  id: string,
  tok: string | null,
  values: unknown,
  mistakes: unknown,
  now: number,
): Promise<{ rec: RoomRecord; seat: Seat }> {
  if (!Array.isArray(values) || values.length !== 81 || !values.every((v) => Number.isInteger(v) && v >= 0 && v <= 9)) {
    throw new RoomError(400, "보드 값이 올바르지 않아요");
  }
  let seat: Seat | null = null;
  const rec = await updateRoom(id, now, (r) => {
    seat = seatOf(r, tok);
    if (!seat) throw new RoomError(401, "참가자가 아니에요");
    // 친구가 기권해 이미 끝난 방이라도 남은 사람은 끝까지 풀어 기록을 남길 수 있다
    if (r.status !== "playing" && !(r.status === "finished" && r.endedReason === "forfeit")) {
      if (r.status === "countdown") throw new RoomError(425, "아직 시작 전이에요");
      throw new RoomError(409, "진행 중인 대결이 아니에요");
    }
    const p = seat === "host" ? r.host : r.guest!;
    if (p.finishedAt || p.forfeit) return;
    if (r.status === "finished" && r.endedReason !== "forfeit") return; // 둘 다 끝난 방
    const cells: number[] = [];
    let all = true;
    for (let i = 0; i < 81; i++) {
      if (r.puzzle[i] !== 0) continue;
      if ((values as number[])[i] === r.solution[i]) cells.push(i);
      else all = false;
    }
    p.cells = cells;
    p.mistakes = Math.min(127, Math.max(p.mistakes, Number.isInteger(mistakes) ? (mistakes as number) : 0));
    p.lastSeen = now;
    if (all) {
      p.finishedAt = now;
      r.winner = r.winner ?? seat;
      const other = seat === "host" ? r.guest : r.host;
      if (other?.finishedAt || other?.forfeit) {
        r.status = "finished";
        r.endedReason = "finished";
      }
    }
  });
  return { rec, seat: seat! };
}

// SSE 연결 유지 신호 — 연결이 살아 있는 동안 주기적으로
export async function touch(id: string, tok: string, now: number): Promise<RoomRecord> {
  return updateRoom(id, now, (r) => {
    const seat = seatOf(r, tok);
    if (!seat) throw new RoomError(401, "참가자가 아니에요");
    (seat === "host" ? r.host : r.guest!).lastSeen = now;
  });
}

export async function leaveRoom(id: string, tok: string | null, now: number): Promise<RoomRecord> {
  return updateRoom(id, now, (r) => {
    const seat = seatOf(r, tok);
    if (!seat) throw new RoomError(401, "참가자가 아니에요");
    if (r.status === "waiting" || r.status === "countdown") {
      r.status = "abandoned";
      r.endedReason = "expired";
      return;
    }
    if (r.status !== "playing") return;
    const p = seat === "host" ? r.host : r.guest!;
    if (p.finishedAt) return; // 이미 완주한 뒤 나가는 건 기권이 아님
    p.forfeit = true;
    r.winner = r.winner ?? opponentOf(seat);
    r.status = "finished";
    r.endedReason = "forfeit";
  });
}

// 재대결: 요청자가 호스트인 새 방을 만들고 이전 방에 rematchId 기록.
// 두 사람이 동시에 눌러도 먼저 기록된 방 하나로 수렴한다 (늦은 쪽의 새 방은 미참가 만료로 사라짐)
export async function rematch(id: string, tok: string | null, now: number): Promise<{ rematchId: string; token?: string }> {
  const cur = await readRoom(id, now);
  if (!cur) throw new RoomError(404, "방이 없어요");
  const seat = seatOf(cur, tok);
  if (!seat) throw new RoomError(401, "참가자가 아니에요");
  if (cur.status !== "finished") throw new RoomError(409, "아직 끝나지 않았어요");
  if (cur.rematchId) return { rematchId: cur.rematchId };
  const { rec, token: hostToken } = await createRoom(cur.difficulty, now);
  let settled = rec.id;
  await updateRoom(id, now, (r) => {
    if (r.rematchId) settled = r.rematchId;
    else r.rematchId = rec.id;
  });
  return settled === rec.id ? { rematchId: settled, token: hostToken } : { rematchId: settled };
}
