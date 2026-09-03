// 기록 백업 코드: 기기 이동용. 서버 없이 URL(#해시)에 기록 전체를 담는다.
// 스트릭은 넣지 않는다 — 날짜별 클리어에서 다시 계산되므로.
//
// 코드 = "1" + 비트열(base64url). 레이아웃:
//   플레이 20 · 클리어 20
//   난이도 4개 × [베스트有 1 · 초 17]
//   날짜有 1 · [시작 데일리번호 13 · 일수 13 · 하루마다 난이도 마스크 4 · 마스크 비트마다 초 12]
// 시간 12비트(최대 4095초, 0 = 미상). 하루 1판이면 16비트/일 → 1년 ≈ 1,000자. 링크 한 번 열어 옮기는 용도라 허용.
import { BitReader, BitWriter, cap } from "./encode";
import { DIFFICULTIES, dailyNumber, dailyKeyFromNumber } from "./sudoku";
import type { DayClears, Stats } from "./stats";

export type BackupData = Pick<Stats, "bests" | "played" | "cleared" | "days">;

const PREFIX = "1";
const BITS = { count: 20, best: 17, day: 13, sec: 12 } as const;
const MAX_SPAN = 8191; // 13비트 — 약 22년

export function encodeBackup(s: BackupData): string {
  const w = new BitWriter();
  w.write(cap(s.played, BITS.count), BITS.count);
  w.write(cap(s.cleared, BITS.count), BITS.count);
  for (const d of DIFFICULTIES) {
    const b = s.bests[d];
    w.write(b !== undefined ? 1 : 0, 1);
    if (b !== undefined) w.write(cap(b, BITS.best), BITS.best);
  }

  const nums = Object.keys(s.days)
    .map(dailyNumber)
    .filter((n) => n >= 1)
    .sort((a, b) => a - b);
  w.write(nums.length > 0 ? 1 : 0, 1);
  if (nums.length > 0) {
    const start = nums[0];
    const span = Math.min(MAX_SPAN, nums[nums.length - 1] - start + 1);
    w.write(cap(start, BITS.day), BITS.day);
    w.write(span, BITS.day);
    for (let n = start; n < start + span; n++) {
      const day = s.days[dailyKeyFromNumber(n)];
      let mask = 0;
      DIFFICULTIES.forEach((d, i) => {
        if (day?.[d] !== undefined) mask |= 1 << i;
      });
      w.write(mask, 4);
      DIFFICULTIES.forEach((d, i) => {
        if (mask & (1 << i)) w.write(cap(day![d]!, BITS.sec), BITS.sec);
      });
    }
  }
  return PREFIX + w.toString();
}

export function decodeBackup(code: string): BackupData | null {
  try {
    if (!code.startsWith(PREFIX)) return null;
    const rd = new BitReader(code.slice(PREFIX.length));
    const played = rd.read(BITS.count);
    const cleared = rd.read(BITS.count);
    const bests: BackupData["bests"] = {};
    for (const d of DIFFICULTIES) if (rd.flag()) bests[d] = rd.read(BITS.best);

    const days: Record<string, DayClears> = {};
    if (rd.flag()) {
      const start = rd.read(BITS.day);
      const span = rd.read(BITS.day);
      if (start < 1 || span < 1) return null;
      for (let n = start; n < start + span; n++) {
        const mask = rd.read(4);
        if (mask === 0) continue;
        const day: DayClears = {};
        DIFFICULTIES.forEach((d, i) => {
          if (mask & (1 << i)) day[d] = rd.read(BITS.sec);
        });
        days[dailyKeyFromNumber(n)] = day;
      }
    }
    return { played, cleared, bests, days };
  } catch {
    return null;
  }
}

export function backupUrl(s: BackupData, origin: string): string {
  // 해시에 담아 서버 로그에 남지 않게
  return `${origin}/restore#${encodeBackup(s)}`;
}
