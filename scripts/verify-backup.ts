// 기록 백업 코드 라운드트립 + 스트릭 파생 + 병합 규칙 검증. 실행: npx tsx scripts/verify-backup.ts
import { decodeBackup, encodeBackup, BackupData } from "../lib/backup";
import { streakInfo, DayClears } from "../lib/stats";
import { DIFFICULTIES, dailyKeyFromNumber, dailyNumber } from "../lib/sudoku";

let fails = 0;
const check = (c: boolean, m: string) => { if (!c) { fails++; console.error("FAIL:", m); } };

// 1) 라운드트립: 1년치, 하루 1~4판 무작위
let seed = 3; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
const days: Record<string, DayClears> = {};
for (let n = 100; n < 465; n++) {
  if (rnd() < 0.7) {
    const day: DayClears = {};
    if (rnd() < 0.9) day.normal = 300 + Math.floor(rnd() * 900);
    if (rnd() < 0.3) day.easy = 200 + Math.floor(rnd() * 300);
    if (rnd() < 0.2) day.hard = 900 + Math.floor(rnd() * 1500);
    if (rnd() < 0.05) day.expert = 0; // 시간 미상
    if (Object.keys(day).length === 0) day.normal = 500;
    days[dailyKeyFromNumber(n)] = day;
  }
}
const data: BackupData = { played: 400, cleared: 320, bests: { easy: 201, normal: 305, hard: 950 }, days };
const code = encodeBackup(data);
const back = decodeBackup(code);
check(!!back, "decode null");
// 키 순서에 무관하게 비교
const canon = (d: BackupData) => JSON.stringify({ p: d.played, c: d.cleared, b: DIFFICULTIES.map((x) => d.bests[x] ?? null), d: Object.keys(d.days).sort().map((k) => [k, DIFFICULTIES.map((x) => d.days[k][x] ?? null)]) });
check(!!back && canon(back) === canon(data), "roundtrip mismatch");
console.log(`1년치 ${Object.keys(days).length}일 (하루 최대 4판) → ${code.length}자`);

// 하루 1판만 1년
const one: Record<string, DayClears> = {};
for (let n = 100; n < 465; n++) one[dailyKeyFromNumber(n)] = { normal: 500 + n };
const oneCode = encodeBackup({ played: 365, cleared: 365, bests: { normal: 500 }, days: one });
const oneBack = decodeBackup(oneCode);
check(!!oneBack && canon(oneBack) === canon({ played: 365, cleared: 365, bests: { normal: 500 }, days: one }), "one/day roundtrip");
console.log(`1년치 매일 1판 → ${oneCode.length}자`);

// 빈 기록
const empty = decodeBackup(encodeBackup({ played: 0, cleared: 0, bests: {}, days: {} }));
check(!!empty && Object.keys(empty.days).length === 0 && empty.played === 0, "empty");
console.log(`빈 기록 → ${encodeBackup({ played: 0, cleared: 0, bests: {}, days: {} }).length}자`);

// 2) 스트릭 파생
const today = "2026-09-04";
const t = dailyNumber(today);
const mk = (...offsets: number[]) => Object.fromEntries(offsets.map((o) => [dailyKeyFromNumber(t - o), { normal: 1 }]));
check(streakInfo(mk(0, 1, 2), today).current === 3, "streak today 3");
check(streakInfo(mk(1, 2, 3), today).current === 3, "streak alive from yesterday");
check(streakInfo(mk(2, 3), today).current === 0, "streak broken");
check(streakInfo(mk(0, 1, 5, 6, 7, 8), today).max === 4, "max streak 4");
check(streakInfo({}, today).current === 0 && streakInfo({}, today).max === 0, "empty streak");

// 3) 깨진 코드
check(decodeBackup("") === null && decodeBackup("2abc") === null && decodeBackup("1!!") === null, "garbage null");

console.log(fails === 0 ? "ALL OK" : `${fails} FAIL`);
process.exit(fails ? 1 : 0);
