// 공유 코드 v3 라운드트립 + 레거시(v1/v2) 디코딩 호환 검증. 실행: npx tsx scripts/verify-encode.ts
import { encodeRecord, decodeRecord, Move, ShareRecord } from "../lib/encode";
import { computeHighlights, recordHighlights } from "../lib/recap";
import { generateDaily, generatePuzzle } from "../lib/sudoku";

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
let fails = 0;
const check = (cond: boolean, msg: string) => { if (!cond) { fails++; console.error("FAIL:", msg); } };

function fakeMoves(puzzle: number[]): { moves: Move[]; t: number } {
  const empties = puzzle.map((v, i) => (v === 0 ? i : -1)).filter((i) => i >= 0);
  const moves: Move[] = []; let t = 0;
  for (const i of empties) {
    t += 3 + Math.floor(rnd() * 20);
    if (rnd() < 0.1) { moves.push({ i, k: 1, t }); t += 2; }
    moves.push({ i, k: rnd() < 0.05 ? 2 : 0, t });
  }
  moves[5].t += 140; for (let n = 6; n < moves.length; n++) moves[n].t += 140; // 2분 넘게 고민한 칸 (구 63초 캡 확인)
  return { moves, t };
}

for (const d of ["easy", "normal", "hard", "expert"] as const) {
  for (const daily of [true, false]) {
    const p = daily ? generateDaily(d, "2026-09-04") : generatePuzzle(d, Math.floor(rnd() * 2 ** 31));
    const { moves, t } = fakeMoves(p.puzzle);
    const rec: ShareRecord = { difficulty: d, timeSec: t, mistakes: 3, hints: 1, dateKey: "2026-09-04", streak: 5, daily, best: true, seed: p.seed, moves };
    const code = encodeRecord(rec);
    const out = decodeRecord(code);
    check(!!out, `${d} decode null`); if (!out) continue;
    check(out.difficulty === d && out.timeSec === t && out.mistakes === 3 && out.hints === 1 && out.streak === 5 && out.daily === daily && out.best, `${d} header mismatch ${JSON.stringify(out)}`);
    check(out.dateKey === "2026-09-04", `${d} dateKey ${out.dateKey}`);
    check(out.seed === p.seed, `${d} seed ${out.seed} != ${p.seed}`);
    check(JSON.stringify(out.moves!.map((m) => [m.i, m.k])) === JSON.stringify(moves.map((m) => [m.i, m.k])), `${d} moves order`);
    const h0 = computeHighlights(moves), h1 = recordHighlights(out)!;
    check(JSON.stringify(h0) === JSON.stringify(h1), `${d} highlights ${JSON.stringify(h0)} vs ${JSON.stringify(h1)}`);
    console.log(`${d.padEnd(6)} ${daily ? "daily" : "free "} ${moves.length}수 → ${code.length}자  고민 ${h1.longestThink?.sec}초`);
  }
}
// 무브 없는 기록 (v1 상당)
const plain = decodeRecord(encodeRecord({ difficulty: "hard", timeSec: 900, mistakes: 0, hints: 0, dateKey: "2026-01-01", streak: 1, daily: true, best: false }));
check(!!plain && plain.dateKey === "2026-01-01" && plain.moves === undefined && plain.timeSec === 900, "plain record");
console.log(`무브 없음 → ${encodeRecord({ difficulty: "hard", timeSec: 900, mistakes: 0, hints: 0, dateKey: "2026-01-01", streak: 1, daily: true, best: false }).length}자`);

// 레거시 링크 호환 (이전 encodeRecord 출력 고정값)
const v2 = "Mnx4fDYzMXwzfDF8MjAyNjA5MDR8NXxkfGJ8MWwzajJjanxBQ1FBRUhBRlJBSEpBS1NBTUlBTlJBT0tBUE1BUVdBU0ZBVFFBVUlBV1RBWEdBWU1BWkRBYUhBYktBY1FBZU1BZlRBZ0ZBaEhBaUtBa0ZBbFVBbU9Bbk5BcEVBcklBc0dBdFBBdVFBdkxBeVdBektBMEpBMURBMkVDSUpBM0NBNFBBNU5BNklBN0dBOUtBLU9BX0lCQ0ZDVklCRUNCSEVCSU5CTE1CTUxCTkhCT1VDaExCUUM";
const l2 = decodeRecord(v2);
check(!!l2 && l2.difficulty === "expert" && l2.timeSec === 631 && l2.dateKey === "2026-09-04" && !!l2.moves && l2.moves.length === 60 && recordHighlights(l2) !== null, `legacy v2 ${JSON.stringify(l2)?.slice(0, 120)}`);
const v1 = Buffer.from("1|n|420|1|0|20260301|3|d|-").toString("base64url");
const l1 = decodeRecord(v1);
check(!!l1 && l1.difficulty === "normal" && l1.timeSec === 420 && l1.streak === 3 && l1.daily && !l1.best && l1.moves === undefined, `legacy v1 ${JSON.stringify(l1)}`);
check(decodeRecord("3zzz") === null || true, "garbage tolerated");
check(decodeRecord("garbage!!") === null, "garbage null");

console.log(fails === 0 ? "ALL OK" : `${fails} FAIL`);
process.exit(fails ? 1 : 0);
