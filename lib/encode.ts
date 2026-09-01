// 게임 결과 → URL-safe 공유 코드 인코딩/디코딩
import { Difficulty, DIFFICULTIES, DIFFICULTY_LABEL, dailyNumber } from "./sudoku";

export interface ShareRecord {
  difficulty: Difficulty;
  timeSec: number;
  mistakes: number;
  hints: number;
  dateKey: string; // YYYY-MM-DD
  streak: number; // 데일리 연속 클리어 (0 = 비데일리)
  daily: boolean;
  best: boolean; // 신기록 여부
}

const DIFF_CODE: Record<Difficulty, string> = {
  easy: "e",
  normal: "n",
  hard: "h",
  expert: "x",
};

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

export function encodeRecord(r: ShareRecord): string {
  const parts = [
    "1", // version
    DIFF_CODE[r.difficulty],
    String(r.timeSec),
    String(r.mistakes),
    String(r.hints),
    r.dateKey.replace(/-/g, ""),
    String(r.streak),
    r.daily ? "d" : "f",
    r.best ? "b" : "-",
  ];
  return toBase64Url(parts.join("|"));
}

export function decodeRecord(code: string): ShareRecord | null {
  try {
    const parts = fromBase64Url(code).split("|");
    if (parts[0] !== "1" || parts.length < 9) return null;
    const difficulty = DIFFICULTIES.find((d) => DIFF_CODE[d] === parts[1]);
    const raw = parts[5];
    if (!difficulty || !/^\d{8}$/.test(raw)) return null;
    const timeSec = Number(parts[2]);
    const mistakes = Number(parts[3]);
    const hints = Number(parts[4]);
    const streak = Number(parts[6]);
    if (![timeSec, mistakes, hints, streak].every((n) => Number.isInteger(n) && n >= 0)) return null;
    if (timeSec > 86400) return null;
    return {
      difficulty,
      timeSec,
      mistakes,
      hints,
      dateKey: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`,
      streak,
      daily: parts[7] === "d",
      best: parts[8] === "b",
    };
  } catch {
    return null;
  }
}

export function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Wordle 스타일 공유 텍스트
export function shareText(r: ShareRecord, url?: string): string {
  const title = r.daily
    ? `스도쿠 #${dailyNumber(r.dateKey)} · ${DIFFICULTY_LABEL[r.difficulty]}`
    : `스도쿠 · ${DIFFICULTY_LABEL[r.difficulty]}`;
  const line = [
    `⏱ ${formatTime(r.timeSec)}`,
    `✕ ${r.mistakes}`,
    `💡 ${r.hints}`,
    ...(r.streak > 1 ? [`🔥 ${r.streak}일 연속`] : []),
    ...(r.best ? ["🏆 신기록"] : []),
  ].join(" · ");
  return [title, line, "이 기록, 깰 수 있어?", ...(url ? [url] : [])].join("\n");
}
