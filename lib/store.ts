// 방 상태 저장소 — Upstash Redis(배포) 또는 인메모리(로컬 dev, env 없을 때)
// 갱신은 ver 비교-후-교체(CAS)로만 한다. 두 플레이어의 요청이 다른 인스턴스에 떨어져도 안전.
import { Redis } from "@upstash/redis";
import type { RoomView } from "./room";

// 서버에만 있는 레코드: 토큰·퍼즐·해답 포함
export interface RoomRecord extends Omit<RoomView, "me" | "now"> {
  tokens: { host: string; guest?: string };
  puzzle: number[];
  solution: number[];
}

export interface RoomStore {
  get(id: string): Promise<RoomRecord | null>;
  create(rec: RoomRecord, ttlSec: number): Promise<boolean>; // 이미 있으면 false
  cas(id: string, expectedVer: number, rec: RoomRecord, ttlSec: number): Promise<boolean>;
  incr(key: string, ttlSec: number): Promise<number>; // 레이트리밋 카운터
}

const key = (id: string) => `room:${id}`;

// Lua: ver가 기대값과 같을 때만 교체
const CAS_LUA = `
local cur = redis.call('GET', KEYS[1])
if not cur then return 0 end
local v = cjson.decode(cur)
if tostring(v.ver) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1`;

class RedisStore implements RoomStore {
  constructor(private r: Redis) {}
  async get(id: string) {
    const raw = await this.r.get<string | RoomRecord>(key(id));
    if (!raw) return null;
    return typeof raw === "string" ? (JSON.parse(raw) as RoomRecord) : raw;
  }
  async create(rec: RoomRecord, ttlSec: number) {
    const ok = await this.r.set(key(rec.id), JSON.stringify(rec), { nx: true, ex: ttlSec });
    return ok === "OK";
  }
  async cas(id: string, expectedVer: number, rec: RoomRecord, ttlSec: number) {
    const res = await this.r.eval(CAS_LUA, [key(id)], [String(expectedVer), JSON.stringify(rec), String(ttlSec)]);
    return res === 1;
  }
  async incr(k: string, ttlSec: number) {
    const n = await this.r.incr(k);
    if (n === 1) await this.r.expire(k, ttlSec);
    return n;
  }
}

// 단일 프로세스(next dev)용. 만료는 읽을 때 정리
class MemoryStore implements RoomStore {
  private rooms = new Map<string, { rec: RoomRecord; exp: number }>();
  private counters = new Map<string, { n: number; exp: number }>();
  async get(id: string) {
    const e = this.rooms.get(id);
    if (!e) return null;
    if (e.exp < Date.now()) {
      this.rooms.delete(id);
      return null;
    }
    return structuredClone(e.rec);
  }
  async create(rec: RoomRecord, ttlSec: number) {
    if (await this.get(rec.id)) return false;
    this.rooms.set(rec.id, { rec: structuredClone(rec), exp: Date.now() + ttlSec * 1000 });
    return true;
  }
  async cas(id: string, expectedVer: number, rec: RoomRecord, ttlSec: number) {
    const cur = await this.get(id);
    if (!cur || cur.ver !== expectedVer) return false;
    this.rooms.set(id, { rec: structuredClone(rec), exp: Date.now() + ttlSec * 1000 });
    return true;
  }
  async incr(k: string, ttlSec: number) {
    const e = this.counters.get(k);
    if (!e || e.exp < Date.now()) {
      this.counters.set(k, { n: 1, exp: Date.now() + ttlSec * 1000 });
      return 1;
    }
    return ++e.n;
  }
}

// Vercel Upstash 통합은 KV_REST_API_*, 직접 연결은 UPSTASH_REDIS_REST_* 를 준다
function redisEnv() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

// 모듈 스코프 싱글턴 — dev HMR에서도 하나만 유지되도록 globalThis에 둔다
const g = globalThis as unknown as { __sudokuRoomStore?: RoomStore; __sudokuStoreWarned?: boolean };

export function getStore(): RoomStore {
  if (g.__sudokuRoomStore) return g.__sudokuRoomStore;
  const env = redisEnv();
  if (env) {
    g.__sudokuRoomStore = new RedisStore(new Redis(env));
  } else {
    if (process.env.NODE_ENV === "production" && !g.__sudokuStoreWarned) {
      g.__sudokuStoreWarned = true;
      console.warn("[room] Redis env 없음 — 인메모리 저장소 사용. 인스턴스 간 공유가 안 되므로 배포 환경에선 대결이 동작하지 않습니다.");
    }
    g.__sudokuRoomStore = new MemoryStore();
  }
  return g.__sudokuRoomStore;
}

export const storeKind = () => (redisEnv() ? "redis" : "memory");
