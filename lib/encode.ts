// 게임 결과 → URL-safe 공유 코드 인코딩/디코딩
// v1: 결과 요약만 / v2: + 시드·무브 로그(풀이 리플레이용)
import { Difficulty, DIFFICULTIES, DIFFICULTY_LABEL, dailyNumber } from "./sudoku";

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
  seed?: number; // 퍼즐 시드 (리플레이용, v2)
  moves?: Move[]; // 풀이 로그 (리플레이용, v2)
}

const DIFF_CODE: Record<Difficulty, string> = {
  easy: "e",
  normal: "n",
  hard: "h",
  expert: "x",
};

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function toBase64Url(s: string): string {
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(s, "utf-8").toString("base64")
      : btoa(String.fromCharCode(...new TextEncoder().encode(s)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  if (typeof Buffer !== "undefined") return Buffer.from(b64, "base64").toString("utf-8");
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
}

// 무브당 3문자: (k*81+i)를 12비트 2문자로, 직전 무브와의 시간 차(0~63초 캡)를 1문자로
function encodeMoves(moves: Move[]): string {
  let out = "";
  let prev = 0;
  for (const m of moves) {
    const v = m.k * 81 + m.i;
    const dt = Math.min(63, Math.max(0, Math.round(m.t - prev)));
    out += B64[v >> 6] + B64[v & 63] + B64[dt];
    prev = m.t;
  }
  return out;
}

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

export function encodeRecord(r: ShareRecord): string {
  const v2 = r.seed !== undefined && r.moves !== undefined && r.moves.length > 0;
  const parts = [
    v2 ? "2" : "1",
    DIFF_CODE[r.difficulty],
    String(r.timeSec),
    String(r.mistakes),
    String(r.hints),
    r.dateKey.replace(/-/g, ""),
    String(r.streak),
    r.daily ? "d" : "f",
    r.best ? "b" : "-",
    ...(v2 ? [r.seed!.toString(36), encodeMoves(r.moves!)] : []),
  ];
  return toBase64Url(parts.join("|"));
}

export function decodeRecord(code: string): ShareRecord | null {
  try {
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
